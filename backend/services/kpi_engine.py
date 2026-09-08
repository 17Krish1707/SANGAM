from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask
from backend.models.task import MaintenanceTask
from backend.models.block_window import BlockWindow
from backend.models.resource import Resource, TaskResourceRequirement


def compute_kpis(db: Session, run_id: str) -> Dict[str, Any]:
    """
    Compute comprehensive operational KPIs for an optimization or baseline run:
    - total_block_hours
    - critical_task_coverage_pct
    - joint_block_utilization_pct
    - unscheduled_priority_sum
    - train_impact_score
    - resource_utilization_pct
    """
    opt_run = db.query(OptimizationRun).filter(OptimizationRun.id == run_id).first()
    if not opt_run:
        raise ValueError(f"Optimization run {run_id} not found")

    blocks = (
        db.query(GeneratedBlock)
        .filter(GeneratedBlock.run_id == run_id)
        .all()
    )

    # 1. Total block minutes & hours
    total_minutes = sum(
        int((b.block_end - b.block_start).total_seconds() // 60)
        for b in blocks
    )
    total_hours = round(total_minutes / 60.0, 2)

    # 2. Joint block utilization %
    total_blocks_count = len(blocks)
    joint_blocks_count = sum(1 for b in blocks if b.is_joint_block)
    joint_utilization_pct = (
        round((joint_blocks_count / total_blocks_count) * 100.0, 1)
        if total_blocks_count > 0 else 0.0
    )

    # 3. Scheduled tasks and critical coverage %
    block_ids = [b.id for b in blocks]
    block_tasks = (
        db.query(GeneratedBlockTask)
        .filter(GeneratedBlockTask.block_id.in_(block_ids))
        .all()
    ) if block_ids else []

    scheduled_task_ids = {str(bt.task_id) for bt in block_tasks}

    all_tasks = db.query(MaintenanceTask).all()
    crit_high_tasks = [t for t in all_tasks if t.severity in ("Critical", "High")]
    crit_high_scheduled = [t for t in crit_high_tasks if str(t.id) in scheduled_task_ids]

    critical_coverage_pct = (
        round((len(crit_high_scheduled) / len(crit_high_tasks)) * 100.0, 1)
        if crit_high_tasks else 100.0
    )

    # 4. Unscheduled priority sum
    unscheduled_tasks = [t for t in all_tasks if str(t.id) not in scheduled_task_ids]
    unscheduled_priority_sum = round(
        sum(t.priority_score or 0.0 for t in unscheduled_tasks), 2
    )

    # 5. Train impact score (sum of risk scores for opened windows)
    train_impact_scores = []
    for b in blocks:
        bw = (
            db.query(BlockWindow)
            .filter(
                BlockWindow.section_id == b.section_id,
                BlockWindow.window_start == b.block_start,
            )
            .first()
        )
        if bw and bw.risk_score is not None:
            train_impact_scores.append(bw.risk_score)
        else:
            train_impact_scores.append(0.3)
    train_impact_score = round(sum(train_impact_scores), 2)

    # 6. Resource utilization %
    # Resource minutes used by scheduled tasks / total resource capacity in 7-day horizon (8h/day shift)
    resources = db.query(Resource).filter(Resource.is_available == True).all()
    total_resources = max(1, len(resources))
    total_available_res_minutes = total_resources * 7 * 8 * 60  # 7 days, 8h/day shift = 3360 min per resource

    used_res_minutes = 0
    for bt in block_tasks:
        t = db.query(MaintenanceTask).filter(MaintenanceTask.id == bt.task_id).first()
        if t:
            req_count = db.query(TaskResourceRequirement).filter(TaskResourceRequirement.task_id == t.id).count()
            used_res_minutes += t.estimated_duration_min * max(1, req_count)

    resource_utilization_pct = min(
        100.0,
        round((used_res_minutes / total_available_res_minutes) * 100.0, 1)
    )

    return {
        "run_id": str(opt_run.id),
        "run_type": opt_run.run_type,
        "status": opt_run.status,
        "total_block_hours": total_hours,
        "total_block_minutes": total_minutes,
        "critical_task_coverage_pct": critical_coverage_pct,
        "joint_block_utilization_pct": joint_utilization_pct,
        "unscheduled_priority_sum": unscheduled_priority_sum,
        "train_impact_score": train_impact_score,
        "resource_utilization_pct": resource_utilization_pct,
        "blocks_count": total_blocks_count,
        "joint_blocks_count": joint_blocks_count,
        "tasks_scheduled_count": len(scheduled_task_ids),
        "tasks_unscheduled_count": len(unscheduled_tasks),
    }


def compute_downtime_saved(
    db: Session,
    baseline_run_id: str,
    optimized_run_id: str,
) -> Dict[str, Any]:
    """
    Compare downtime hours between baseline and SANGAM optimized plan.
    Returns hours saved and percent saved.
    """
    baseline_kpis = compute_kpis(db, baseline_run_id)
    optimized_kpis = compute_kpis(db, optimized_run_id)

    x = baseline_kpis["total_block_hours"]
    y = optimized_kpis["total_block_hours"]
    hours_saved = max(0.0, round(x - y, 2))
    percent_saved = round((hours_saved / x) * 100.0, 1) if x > 0 else 0.0

    return {
        "baseline_run_id": baseline_run_id,
        "baseline_run_type": baseline_kpis["run_type"],
        "baseline_hours": x,
        "optimized_run_id": optimized_run_id,
        "optimized_run_type": optimized_kpis["run_type"],
        "optimized_hours": y,
        "hours_saved": hours_saved,
        "percent_saved": percent_saved,
    }
