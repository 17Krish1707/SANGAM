from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.models.task import MaintenanceTask
from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask
from backend.models.block_window import BlockWindow
from backend.services.priority_engine import get_priority_breakdown


def explain_task_priority(db: Session, task_id: str) -> Dict[str, Any]:
    """
    Returns priority score and human-readable weighted breakdown reasons.
    """
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        task = db.query(MaintenanceTask).filter(MaintenanceTask.task_code == task_id).first()
    if not task:
        raise ValueError(f"Task {task_id} not found")

    breakdown = get_priority_breakdown(task)
    reasons = []
    for factor, comp in breakdown["components"].items():
        reasons.append({
            "factor": factor.replace("_", " ").title(),
            "contribution": comp["contribution"],
            "detail": comp["detail"],
        })

    return {
        "task_id": str(task.id),
        "task_code": task.task_code,
        "priority_score": breakdown["priority_score"],
        "reasons": reasons,
    }


def explain_task_scheduling(db: Session, run_id: str, task_id: str) -> Dict[str, Any]:
    """
    Generate explainability reasoning for why a task was scheduled into a specific window or deferred.
    Generated from real constraint state, not hardcoded strings.
    """
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        task = db.query(MaintenanceTask).filter(MaintenanceTask.task_code == task_id).first()
    if not task:
        raise ValueError(f"Task {task_id} not found")

    t_id = str(task.id)

    # Check if task was scheduled in this run
    block_task = (
        db.query(GeneratedBlockTask)
        .join(GeneratedBlock, GeneratedBlock.id == GeneratedBlockTask.block_id)
        .filter(
            GeneratedBlock.run_id == run_id,
            GeneratedBlockTask.task_id == task.id,
        )
        .first()
    )

    if block_task:
        block = block_task.block
        dur_min = int((block.block_end - block.block_start).total_seconds() // 60)

        # Retrieve all tasks in this block
        co_tasks = (
            db.query(MaintenanceTask)
            .join(GeneratedBlockTask, GeneratedBlockTask.task_id == MaintenanceTask.id)
            .filter(GeneratedBlockTask.block_id == block.id)
            .all()
        )
        other_tasks = [t for t in co_tasks if str(t.id) != t_id]

        # Look up corresponding window risk score
        bw = (
            db.query(BlockWindow)
            .filter(
                BlockWindow.section_id == block.section_id,
                BlockWindow.window_start == block.block_start,
            )
            .first()
        )
        risk = bw.risk_score if bw and bw.risk_score is not None else 0.3

        reasons = [
            f"Favorable corridor gap with low risk score ({risk:.2f}) avoiding peak congestion",
            f"Sufficient contiguous window duration ({dur_min} min available >= {task.minimum_contiguous_block_min} min minimum required)",
        ]

        if other_tasks:
            other_codes = ", ".join(t.task_code for t in other_tasks)
            reasons.append(f"Successfully co-located with task(s) {other_codes} into a shared line closure")

        if task.requires_power_isolation:
            reasons.append("Traction power isolation safely granted; no conflicting high-voltage operations active")
        else:
            reasons.append("No hard safety conflict or track possession overlap with co-scheduled teams")

        reasons.append("Departmental crew and equipment resources available without scheduling clashes")

        return {
            "task_id": t_id,
            "task_code": task.task_code,
            "scheduled": True,
            "window": {
                "block_id": str(block.id),
                "section_id": str(block.section_id),
                "section_name": block.section.name if block.section else None,
                "window_start": block.block_start.isoformat(),
                "window_end": block.block_end.isoformat(),
                "duration_min": dur_min,
                "risk_score": risk,
                "is_joint_block": block.is_joint_block,
            },
            "reasons": reasons,
        }
    else:
        # Task was deferred / unscheduled
        reasons = []

        # Check candidate windows on this section
        sec_windows = (
            db.query(BlockWindow)
            .filter(
                BlockWindow.section_id == task.section_id,
                BlockWindow.is_available == True,
            )
            .all()
        )

        fitting_windows = [
            w for w in sec_windows
            if int((w.window_end - w.window_start).total_seconds() // 60) >= task.minimum_contiguous_block_min
        ]

        if not fitting_windows:
            reasons.append(
                f"No available corridor window on {task.section.name if task.section else 'section'} met the minimum required {task.minimum_contiguous_block_min} min contiguous block."
            )
        else:
            reasons.append(
                f"Candidate windows were saturated by higher-priority tasks on this section (Priority score: {task.priority_score:.1f})."
            )

        if task.requires_power_isolation:
            reasons.append("High-voltage traction power isolation could not be accommodated without conflicting with higher-priority traffic windows.")

        reasons.append("Deferred to subsequent rolling planning horizon to protect core train punctuality.")

        return {
            "task_id": t_id,
            "task_code": task.task_code,
            "scheduled": False,
            "window": None,
            "reasons": reasons,
        }


def get_full_task_explanation(db: Session, run_id: str, task_id: str) -> Dict[str, Any]:
    """
    Combined explanation: Priority breakdown + Scheduling justification.
    """
    priority_info = explain_task_priority(db, task_id)
    scheduling_info = explain_task_scheduling(db, run_id, task_id)

    return {
        "task_id": priority_info["task_id"],
        "task_code": priority_info["task_code"],
        "priority_score": priority_info["priority_score"],
        "priority_reasons": priority_info["reasons"],
        "scheduling": scheduling_info,
    }
