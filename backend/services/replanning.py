"""
replanning.py — Scoped re-planning services for SANGAM.

Two capabilities:
  1. simulate_disruption  — train delay shifts a window; affected blocks are re-optimised
                            using a scoped CP-SAT solve with a plan-stability penalty.
  2. whatif_kpi_delta     — mark a window unavailable or raise a task severity;
                            recompute KPIs for the resulting scoped re-solve.

Modelling notes
---------------
* The original run's NON-affected blocks are locked as fixed constraints so the solver
  prefers minimal change (plan-stability principle from the blueprint).
* Disruptions are simulation-only — nothing is persisted to train_movements;
  the parent_run_id FK is set on the new run row so the lineage is traceable.
* Coefficients here are prototype defaults; see the optimizer.py comments on the same.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from ortools.sat.python import cp_model

from backend.models.task import MaintenanceTask
from backend.models.train import TrainMovement
from backend.models.block_window import BlockWindow
from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask
from backend.services.optimizer_common import prepare_optimization_input
from backend.services.baselines import intervals_overlap
from backend.services.compatibility_graph import has_conflict
from backend.services.kpi_engine import compute_kpis


# ── helpers ───────────────────────────────────────────────────────────────────

def _block_duration_min(b: GeneratedBlock) -> int:
    return int((b.block_end - b.block_start).total_seconds() // 60)


def _fmt_time(dt: datetime) -> str:
    return dt.strftime("%H:%M")


# ── simulate_disruption ───────────────────────────────────────────────────────

def simulate_disruption(
    db: Session,
    run_id: str,
    section_id: str,
    delay_minutes: int = 45,
    train_number: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Simulate a train delay on `section_id`:
      1. Find target train_movement on that section; shift its entry & exit times by delay_minutes.
      2. Identify blocks in the original run for that section whose window now overlaps
         the shifted movement (including 10-min safety buffer).
      3. Run a scoped CP-SAT re-solve covering only affected tasks, with:
         - All non-affected blocks locked as fixed (cannot be changed)
         - A plan-instability penalty for changing any task's window
      4. Save as a new optimization_runs row with parent_run_id = original run.
      5. Return a structured diff.
    """
    orig_run = db.query(OptimizationRun).filter(OptimizationRun.id == run_id).first()
    if not orig_run:
        raise ValueError(f"Run {run_id} not found")

    # ── 1. Identify shifted movement ─────────────────────────────────────────
    train_mv = None
    if train_number:
        train_mv = db.query(TrainMovement).filter(TrainMovement.train_number == train_number).first()
        if train_mv:
            section_id = str(train_mv.section_id)

    if not train_mv:
        train_mv = (
            db.query(TrainMovement)
            .filter(TrainMovement.section_id == section_id)
            .order_by(TrainMovement.entry_time.asc())
            .first()
        )

    buffer_delta = timedelta(minutes=10)
    if train_mv is None:
        shifted_start = orig_run.started_at.replace(hour=8, minute=0, second=0)
        shifted_end   = shifted_start + timedelta(minutes=60 + delay_minutes)
    else:
        sched_entry = getattr(train_mv, 'scheduled_entry_time', None) or train_mv.entry_time
        sched_exit = getattr(train_mv, 'scheduled_exit_time', None) or train_mv.exit_time
        shifted_start = sched_entry + timedelta(minutes=delay_minutes)
        shifted_end   = sched_exit + timedelta(minutes=delay_minutes)

    # ── 2. Find affected blocks ───────────────────────────────────────────────
    orig_blocks = (
        db.query(GeneratedBlock)
        .filter(GeneratedBlock.run_id == run_id, GeneratedBlock.section_id == section_id)
        .all()
    )

    affected_blocks   = []
    unaffected_blocks = []

    for b in orig_blocks:
        # Overlap includes 10-min safety buffer around train path
        if intervals_overlap(b.block_start, b.block_end, shifted_start - buffer_delta, shifted_end + buffer_delta):
            affected_blocks.append(b)
        else:
            unaffected_blocks.append(b)

    # ── 3. Collect affected task IDs ─────────────────────────────────────────
    affected_task_ids: List[str] = []
    for b in affected_blocks:
        bts = db.query(GeneratedBlockTask).filter(GeneratedBlockTask.block_id == b.id).all()
        affected_task_ids.extend([str(bt.task_id) for bt in bts])

    affected_task_ids = list(set(affected_task_ids))

    # Original window assignments for stability penalty
    original_window_map: Dict[str, str] = {}  # task_id -> window start ISO
    for b in affected_blocks:
        bts = db.query(GeneratedBlockTask).filter(GeneratedBlockTask.block_id == b.id).all()
        for bt in bts:
            original_window_map[str(bt.task_id)] = b.block_start.isoformat()

    # ── 4. Re-optimise affected tasks in scoped window set ───────────────────
    if not affected_task_ids:
        # Nothing affected — create an identical child run
        new_run = OptimizationRun(
            run_type="sangam_optimized",
            horizon=orig_run.horizon,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            status="completed",
            objective_value=orig_run.objective_value,
            parent_run_id=orig_run.id,
        )
        db.add(new_run)
        db.flush()
        # Clone all non-affected blocks
        for b in orig_blocks:
            nb = GeneratedBlock(
                run_id=new_run.id,
                section_id=b.section_id,
                block_start=b.block_start,
                block_end=b.block_end,
                is_joint_block=b.is_joint_block,
            )
            db.add(nb)
            db.flush()
            for bt in db.query(GeneratedBlockTask).filter(GeneratedBlockTask.block_id == b.id).all():
                db.add(GeneratedBlockTask(block_id=nb.id, task_id=bt.task_id))
        db.commit()
        return {
            "new_run_id":       str(new_run.id),
            "affected_blocks":  [],
            "new_assignments":  [],
            "unchanged_count":  len(orig_blocks),
            "changed_count":    0,
            "disruption_summary": f"Train delayed {delay_minutes} min on this section, but no blocks were affected.",
        }

    # Fetch affected tasks
    tasks = (
        db.query(MaintenanceTask)
        .filter(MaintenanceTask.id.in_(affected_task_ids))
        .all()
    )

    # Available windows for this section, excluding times that now conflict with the shifted train
    all_windows = (
        db.query(BlockWindow)
        .filter(
            BlockWindow.section_id == section_id,
            BlockWindow.is_available == True,
        )
        .all()
    )

    safe_windows = [
        w for w in all_windows
        if not intervals_overlap(w.window_start, w.window_end, shifted_start, shifted_end)
    ]

    # ── 5. Scoped CP-SAT solve ────────────────────────────────────────────────
    model = cp_model.CpModel()

    w_dur = {j: int((w.window_end - w.window_start).total_seconds() // 60)
             for j, w in enumerate(safe_windows)}

    x = {}
    valid_pairs = []
    for i, t in enumerate(tasks):
        for j, w in enumerate(safe_windows):
            if t.minimum_contiguous_block_min <= w_dur[j]:
                x[i, j] = model.NewBoolVar(f"x_{i}_{j}")
                valid_pairs.append((i, j))

    unscheduled = {i: model.NewBoolVar(f"u_{i}") for i in range(len(tasks))}
    y = {j: model.NewBoolVar(f"y_{j}") for j in range(len(safe_windows))}

    # Coverage constraint
    for i in range(len(tasks)):
        assigned = [x[i, j] for (ti, j) in valid_pairs if ti == i]
        model.Add(sum(assigned) + unscheduled[i] == 1)

    # Linking
    for (i, j) in valid_pairs:
        model.AddImplication(x[i, j], y[j])

    # Capacity
    for j in range(len(safe_windows)):
        load = [x[i, j] * tasks[i].estimated_duration_min for (i, wj) in valid_pairs if wj == j]
        if load:
            model.Add(sum(load) <= w_dur[j] * y[j])
        else:
            model.Add(y[j] == 0)

    # Objective: priority weighted unscheduled + risk + downtime - stability bonus
    # Stability bonus: reward keeping a task in its original window
    obj = []
    for i, t in enumerate(tasks):
        score = int(round((t.priority_score or 50.0) * 10))
        weight = 1000 if t.severity in ("Critical", "High") else 100
        obj.append(weight * score * unscheduled[i])

    for j, w in enumerate(safe_windows):
        risk = int(round((w.risk_score or 0.5) * 100))
        obj.append(200 * risk * y[j])
        obj.append(100 * w_dur[j] * y[j])

    # Stability: small bonus for keeping a task in its originally-assigned window
    STABILITY_BONUS = 500
    for i, t in enumerate(tasks):
        t_id = str(t.id)
        orig_win_start = original_window_map.get(t_id)
        if orig_win_start:
            for j, w in enumerate(safe_windows):
                if w.window_start.isoformat() == orig_win_start and (i, j) in dict(((p, q), True) for (p, q) in valid_pairs):
                    if (i, j) in {(p, q) for p, q in valid_pairs}:
                        obj.append(-STABILITY_BONUS * x[i, j])

    model.Minimize(sum(obj))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 20
    status = solver.Solve(model)

    new_run = OptimizationRun(
        run_type="sangam_optimized",
        horizon=orig_run.horizon,
        started_at=datetime.utcnow(),
        status="running",
        parent_run_id=orig_run.id,
    )
    db.add(new_run)
    db.flush()

    # Clone unaffected blocks verbatim
    for b in unaffected_blocks:
        nb = GeneratedBlock(
            run_id=new_run.id,
            section_id=b.section_id,
            block_start=b.block_start,
            block_end=b.block_end,
            is_joint_block=b.is_joint_block,
        )
        db.add(nb)
        db.flush()
        for bt in db.query(GeneratedBlockTask).filter(GeneratedBlockTask.block_id == b.id).all():
            db.add(GeneratedBlockTask(block_id=nb.id, task_id=bt.task_id))

    new_assignments = []
    changed_task_ids = set()

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for j, w in enumerate(safe_windows):
            if solver.Value(y[j]) == 1:
                assigned = [i for (i, wj) in valid_pairs if wj == j and solver.Value(x[i, j]) == 1]
                if not assigned:
                    continue
                atasks = [tasks[i] for i in assigned]
                distinct_depts = {str(t.department_id) for t in atasks}
                is_joint = len(atasks) > 1 and len(distinct_depts) > 1

                nb = GeneratedBlock(
                    run_id=new_run.id,
                    section_id=w.section_id,
                    block_start=w.window_start,
                    block_end=w.window_end,
                    is_joint_block=is_joint,
                )
                db.add(nb)
                db.flush()
                for t in atasks:
                    db.add(GeneratedBlockTask(block_id=nb.id, task_id=t.id))
                    t_id = str(t.id)
                    orig_start = original_window_map.get(t_id)
                    if orig_start and orig_start != w.window_start.isoformat():
                        changed_task_ids.add(t_id)
                    new_assignments.append({
                        "task_id":    t_id,
                        "task_code":  t.task_code,
                        "new_window_start": w.window_start.isoformat(),
                        "new_window_end":   w.window_end.isoformat(),
                        "changed": orig_start != w.window_start.isoformat() if orig_start else True,
                    })

        new_run.status = "completed"
        new_run.objective_value = float(solver.ObjectiveValue())
    else:
        new_run.status = "infeasible" if status == cp_model.INFEASIBLE else "failed"

    new_run.completed_at = datetime.utcnow()
    db.commit()

    # ── Build plain-language summary ─────────────────────────────────────────
    crit_affected = sum(1 for t in tasks if t.severity in ("Critical", "High"))
    summary_parts = [f"Train delayed {delay_minutes} min on section."]
    if affected_blocks:
        summary_parts.append(
            f"{len(affected_blocks)} block(s) in the original plan conflicted with the shifted movement."
        )
    if changed_task_ids:
        summary_parts.append(
            f"{len(changed_task_ids)} task(s) moved to new windows. "
            f"{len(affected_task_ids) - len(changed_task_ids)} task(s) retained their original slot."
        )
    if crit_affected == 0:
        summary_parts.append("No Critical or High severity tasks were affected.")
    else:
        summary_parts.append(f"{crit_affected} Critical/High task(s) were in the affected scope.")

    return {
        "new_run_id":      str(new_run.id),
        "parent_run_id":   str(orig_run.id),
        "new_run_status":  new_run.status,
        "delay_minutes":   delay_minutes,
        "affected_blocks": [
            {
                "block_id":    str(b.id),
                "block_start": b.block_start.isoformat(),
                "block_end":   b.block_end.isoformat(),
                "duration_min": _block_duration_min(b),
            }
            for b in affected_blocks
        ],
        "new_assignments":  new_assignments,
        "unchanged_count":  len(unaffected_blocks),
        "changed_count":    len(changed_task_ids),
        "disruption_summary": " ".join(summary_parts),
    }


# ── whatif_kpi_delta ──────────────────────────────────────────────────────────

def whatif_kpi_delta(
    db: Session,
    run_id: str,
    changes: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Apply a hypothetical change (mark window unavailable or raise task severity),
    run a scoped re-solve, and return { current_kpis, scenario_kpis, deltas }.

    Supported change types:
      { "type": "lock_window",    "window_id": "<uuid>" }
      { "type": "raise_severity", "task_id":   "<uuid>", "new_severity": "Critical" }
    """
    orig_run = db.query(OptimizationRun).filter(OptimizationRun.id == run_id).first()
    if not orig_run:
        raise ValueError(f"Run {run_id} not found")

    current_kpis = compute_kpis(db, run_id)

    change_type = changes.get("type")
    section_ids = [
        str(b.section_id)
        for b in db.query(GeneratedBlock).filter(GeneratedBlock.run_id == run_id).all()
    ]
    section_ids = list(set(section_ids))

    # Apply the change in-memory (NOT persisted)
    locked_window_id = None
    original_severity = None
    task_for_change = None

    if change_type == "lock_window":
        locked_window_id = changes.get("window_id")

    elif change_type == "raise_severity":
        task_id = changes.get("task_id")
        new_severity = changes.get("new_severity", "Critical")
        task_for_change = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
        if task_for_change:
            original_severity = task_for_change.severity
            task_for_change.severity = new_severity
            # Recompute priority score in memory
            from backend.services.priority_engine import compute_priority_score
            task_for_change.priority_score = compute_priority_score(task_for_change)

    # Prepare input
    bundle = prepare_optimization_input(
        db=db,
        section_ids=section_ids,
        start_date=orig_run.started_at,
        end_date=orig_run.started_at + timedelta(days=7),
        horizon=orig_run.horizon or "weekly",
    )

    # Filter out the locked window if applicable
    if locked_window_id:
        bundle.windows = [w for w in bundle.windows if str(w.id) != locked_window_id]

    # Run the optimizer on the modified bundle
    from backend.services.optimizer import run_sangam_optimizer
    result = run_sangam_optimizer(bundle, db, time_limit_seconds=20)

    # Restore in-memory change
    if task_for_change and original_severity is not None:
        task_for_change.severity = original_severity
        db.expire(task_for_change)

    scenario_run_id = result.get("run_id")
    if not scenario_run_id:
        return {"error": "Scenario solve failed", "current_kpis": current_kpis}

    scenario_kpis = compute_kpis(db, scenario_run_id)

    # Compute deltas
    delta_keys = [
        "total_block_hours", "critical_task_coverage_pct",
        "joint_block_utilization_pct", "unscheduled_priority_sum",
        "train_impact_score", "resource_utilization_pct",
    ]
    deltas = {}
    for k in delta_keys:
        cur = current_kpis.get(k, 0) or 0
        scen = scenario_kpis.get(k, 0) or 0
        deltas[k] = round(scen - cur, 2)

    return {
        "change_applied": changes,
        "current_kpis":  current_kpis,
        "scenario_kpis": scenario_kpis,
        "deltas":        deltas,
    }
