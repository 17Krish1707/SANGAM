from datetime import datetime
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session

from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask
from backend.services.optimizer_common import OptimizationInputBundle
from backend.services.compatibility_graph import has_conflict


def intervals_overlap(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    return start_a < end_b and end_a > start_b


def run_independent_baseline(
    bundle: OptimizationInputBundle,
    db: Session,
) -> Dict[str, Any]:
    """
    BASELINE 1: Independent Department Scheduler
    Simulates today's siloed operations. Each department independently sorts tasks by priority
    and greedily takes the earliest window fitting duration and resource constraints.
    Each department opens its own separate block even if another department is already
    working in that section at that time.
    """
    opt_run = OptimizationRun(
        run_type="independent_baseline",
        horizon=bundle.horizon,
        started_at=datetime.utcnow(),
        status="running",
    )
    db.add(opt_run)
    db.flush()

    # Group tasks by department
    tasks_by_dept: Dict[str, List[Any]] = {}
    for t in bundle.tasks:
        d_id = str(t.department_id)
        tasks_by_dept.setdefault(d_id, []).append(t)

    scheduled_task_ids = set()
    total_block_minutes = 0
    created_blocks = []

    # Sort windows by start time
    sorted_windows = sorted(bundle.windows, key=lambda w: w.window_start)

    for dept_id, d_tasks in tasks_by_dept.items():
        # Sort department tasks by priority_score descending
        d_tasks.sort(key=lambda t: (t.priority_score or 0.0), reverse=True)
        # Track resource busy intervals within this department only
        dept_resource_busy: Dict[str, List[Tuple[datetime, datetime]]] = {}

        for task in d_tasks:
            t_id = str(task.id)
            task_res = bundle.task_resource_map.get(t_id, [])
            sec_id = str(task.section_id)

            # Find earliest available window on its section
            chosen_window = None
            for w in sorted_windows:
                if str(w.section_id) != sec_id:
                    continue

                dur_min = int((w.window_end - w.window_start).total_seconds() // 60)
                if dur_min < task.minimum_contiguous_block_min:
                    continue

                # Check resource clash within department
                has_clash = False
                for r_id in task_res:
                    busy_list = dept_resource_busy.get(r_id, [])
                    for b_start, b_end in busy_list:
                        if intervals_overlap(w.window_start, w.window_end, b_start, b_end):
                            has_clash = True
                            break
                    if has_clash:
                        break

                if not has_clash:
                    chosen_window = w
                    break

            if chosen_window:
                # Schedule task: open a separate department block
                scheduled_task_ids.add(t_id)
                w_dur = int((chosen_window.window_end - chosen_window.window_start).total_seconds() // 60)
                total_block_minutes += w_dur

                for r_id in task_res:
                    dept_resource_busy.setdefault(r_id, []).append(
                        (chosen_window.window_start, chosen_window.window_end)
                    )

                block = GeneratedBlock(
                    run_id=opt_run.id,
                    section_id=chosen_window.section_id,
                    block_start=chosen_window.window_start,
                    block_end=chosen_window.window_end,
                    is_joint_block=False,
                )
                db.add(block)
                db.flush()

                bt = GeneratedBlockTask(block_id=block.id, task_id=task.id)
                db.add(bt)
                created_blocks.append(block)

    opt_run.completed_at = datetime.utcnow()
    opt_run.status = "completed"
    opt_run.objective_value = float(total_block_minutes)
    db.commit()

    return {
        "run_id": str(opt_run.id),
        "run_type": "independent_baseline",
        "total_block_minutes": total_block_minutes,
        "total_block_hours": round(total_block_minutes / 60.0, 2),
        "tasks_scheduled": len(scheduled_task_ids),
        "tasks_unscheduled": len(bundle.tasks) - len(scheduled_task_ids),
        "blocks_count": len(created_blocks),
        "joint_blocks_count": 0,
    }


def run_greedy_baseline(
    bundle: OptimizationInputBundle,
    db: Session,
) -> Dict[str, Any]:
    """
    BASELINE 2: Greedy Earliest-Window Scheduler
    Pools all tasks together across all departments. Greedily opportunistically joins tasks into
    the same window if compatible and duration fits.
    """
    opt_run = OptimizationRun(
        run_type="greedy_baseline",
        horizon=bundle.horizon,
        started_at=datetime.utcnow(),
        status="running",
    )
    db.add(opt_run)
    db.flush()

    # Sort all pooled tasks by priority_score descending
    all_tasks = sorted(bundle.tasks, key=lambda t: (t.priority_score or 0.0), reverse=True)
    sorted_windows = sorted(bundle.windows, key=lambda w: w.window_start)

    scheduled_task_ids = set()
    resource_busy: Dict[str, List[Tuple[datetime, datetime]]] = {}

    # Map window_id -> GeneratedBlock instance and list of assigned tasks
    open_window_blocks: Dict[str, Dict[str, Any]] = {}
    created_blocks = []

    for task in all_tasks:
        t_id = str(task.id)
        task_res = bundle.task_resource_map.get(t_id, [])
        sec_id = str(task.section_id)
        graph = bundle.graphs_by_section.get(sec_id)

        assigned_window = None
        joined_existing = False

        for w in sorted_windows:
            w_id = str(w.id)
            if str(w.section_id) != sec_id:
                continue

            w_dur = int((w.window_end - w.window_start).total_seconds() // 60)
            if w_dur < task.minimum_contiguous_block_min:
                continue

            # Check global resource clashes
            has_clash = False
            for r_id in task_res:
                for b_start, b_end in resource_busy.get(r_id, []):
                    if intervals_overlap(w.window_start, w.window_end, b_start, b_end):
                        has_clash = True
                        break
                if has_clash:
                    break

            if has_clash:
                continue

            # If window already has an open block, check compatibility and capacity
            if w_id in open_window_blocks:
                existing_info = open_window_blocks[w_id]
                existing_tasks = existing_info["tasks"]
                sum_dur = sum(t.estimated_duration_min for t in existing_tasks) + task.estimated_duration_min

                # Check conflict with any existing task in this block
                conflict_found = False
                if graph:
                    for ext in existing_tasks:
                        if has_conflict(graph, t_id, str(ext.id)):
                            conflict_found = True
                            break

                if not conflict_found and sum_dur <= w_dur:
                    assigned_window = w
                    joined_existing = True
                    break
            else:
                # Can open new block in this window
                assigned_window = w
                joined_existing = False
                break

        if assigned_window:
            w_id = str(assigned_window.id)
            scheduled_task_ids.add(t_id)

            for r_id in task_res:
                resource_busy.setdefault(r_id, []).append(
                    (assigned_window.window_start, assigned_window.window_end)
                )

            if joined_existing:
                block_info = open_window_blocks[w_id]
                block = block_info["block"]
                block.is_joint_block = True
                block_info["tasks"].append(task)
                bt = GeneratedBlockTask(block_id=block.id, task_id=task.id)
                db.add(bt)
            else:
                block = GeneratedBlock(
                    run_id=opt_run.id,
                    section_id=assigned_window.section_id,
                    block_start=assigned_window.window_start,
                    block_end=assigned_window.window_end,
                    is_joint_block=False,
                )
                db.add(block)
                db.flush()

                bt = GeneratedBlockTask(block_id=block.id, task_id=task.id)
                db.add(bt)
                open_window_blocks[w_id] = {"block": block, "tasks": [task]}
                created_blocks.append(block)

    total_block_minutes = sum(
        int((b.block_end - b.block_start).total_seconds() // 60) for b in created_blocks
    )
    joint_blocks_count = sum(1 for b in created_blocks if b.is_joint_block)

    opt_run.completed_at = datetime.utcnow()
    opt_run.status = "completed"
    opt_run.objective_value = float(total_block_minutes)
    db.commit()

    return {
        "run_id": str(opt_run.id),
        "run_type": "greedy_baseline",
        "total_block_minutes": total_block_minutes,
        "total_block_hours": round(total_block_minutes / 60.0, 2),
        "tasks_scheduled": len(scheduled_task_ids),
        "tasks_unscheduled": len(bundle.tasks) - len(scheduled_task_ids),
        "blocks_count": len(created_blocks),
        "joint_blocks_count": joint_blocks_count,
    }
