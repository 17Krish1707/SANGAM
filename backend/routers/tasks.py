from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.task import MaintenanceTask
from backend.models.department import Department
from backend.services.priority_engine import (
    compute_priority_score,
    get_priority_breakdown,
    recompute_all_priority_scores,
)

router = APIRouter(prefix="/api/tasks", tags=["Maintenance Tasks"])


@router.post("/recompute-priority")
def trigger_recompute_priority(db: Session = Depends(get_db)):
    """
    Trigger priority score recomputation across all maintenance tasks.
    """
    count = recompute_all_priority_scores(db)
    return {
        "status": "success",
        "updated_tasks": count,
        "message": f"Successfully recomputed priority scores for {count} tasks.",
    }


@router.get("")
def list_tasks(
    department: Optional[str] = Query(None, description="Department code (ENG, TRD, SNT) or name"),
    severity: Optional[str] = Query(None, description="Severity: Low, Medium, High, Critical"),
    min_priority: Optional[float] = Query(None, description="Minimum priority score (0-100)"),
    overdue_only: Optional[bool] = Query(False, description="Filter for overdue tasks only"),
    section_id: Optional[str] = Query(None, description="Filter by section UUID"),
    status: Optional[str] = Query(None, description="Filter by status (Pending, Scheduled, Completed, Deferred)"),
    db: Session = Depends(get_db),
):
    """
    List maintenance tasks with optional filters, sorted by priority_score descending by default.
    """
    query = db.query(MaintenanceTask)

    if department:
        # Check if department matches code or name
        dept = db.query(Department).filter(
            (Department.code == department) | (Department.name == department)
        ).first()
        if not dept:
            dept = db.query(Department).filter(Department.id == department).first()
        if dept:
            query = query.filter(MaintenanceTask.department_id == dept.id)

    if severity:
        query = query.filter(MaintenanceTask.severity == severity)

    if section_id:
        query = query.filter(MaintenanceTask.section_id == section_id)

    if status:
        query = query.filter(MaintenanceTask.status == status)

    if min_priority is not None:
        query = query.filter(MaintenanceTask.priority_score >= min_priority)

    if overdue_only:
        ref_dt = datetime(2026, 9, 7, 8, 0, 0)
        query = query.filter(MaintenanceTask.due_date < ref_dt)

    tasks = query.order_by(MaintenanceTask.priority_score.desc().nullslast()).all()

    # If any task doesn't have a priority score yet, compute it on the fly
    results = []
    for t in tasks:
        score = t.priority_score
        if score is None:
            score = compute_priority_score(t)
            t.priority_score = score
            db.add(t)

        results.append({
            "id": str(t.id),
            "task_code": t.task_code,
            "department_id": str(t.department_id),
            "department_code": t.department.code if t.department else None,
            "department_name": t.department.name if t.department else None,
            "section_id": str(t.section_id),
            "section_name": t.section.name if t.section else None,
            "asset_id": str(t.asset_id) if t.asset_id else None,
            "asset_name": t.asset.asset_type if t.asset else None,
            "maintenance_type": t.maintenance_type,
            "severity": t.severity,
            "detected_at": t.detected_at.isoformat() if t.detected_at else None,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "estimated_duration_min": t.estimated_duration_min,
            "minimum_contiguous_block_min": t.minimum_contiguous_block_min,
            "requires_power_isolation": t.requires_power_isolation,
            "can_run_parallel": t.can_run_parallel,
            "status": t.status,
            "priority_score": score,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })

    db.commit()
    return results


@router.get("/{task_id}/priority-breakdown")
def get_task_priority_breakdown(
    task_id: str,
    db: Session = Depends(get_db),
):
    """
    Get detailed weighted factor breakdown for a specific task explaining its priority score.
    Powers the 'Why this priority?' explainability drawer in the UI.
    """
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        task = db.query(MaintenanceTask).filter(MaintenanceTask.task_code == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    breakdown = get_priority_breakdown(task)
    return breakdown


@router.get("/{task_id}/intelligence")
def get_task_intelligence(
    task_id: str,
    db: Session = Depends(get_db),
):
    """
    Unified intelligence packet for the Part 7 Task Intelligence Drawer:
    - Task operational specifications
    - Priority breakdown factors
    - Section track schematic context
    - Safety compatibility & conflicts (NetworkX cluster context)
    - Fitting candidate corridor windows with risk indicators
    - Active block allocation (if scheduled)
    """
    from backend.models.conflict import TaskConflict
    from backend.models.block_window import BlockWindow
    from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask
    from backend.routers.corridor import get_window_risk_breakdown

    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        task = db.query(MaintenanceTask).filter(MaintenanceTask.task_code == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    # 1. Priority breakdown
    breakdown = get_priority_breakdown(task)

    # 2. Safety relationships on this section
    conflicts_as_a = db.query(TaskConflict).filter(TaskConflict.task_a_id == task.id).all()
    conflicts_as_b = db.query(TaskConflict).filter(TaskConflict.task_b_id == task.id).all()

    compatible_tasks = []
    conflict_tasks = []
    dependencies = []

    for c in conflicts_as_a:
        other = db.query(MaintenanceTask).filter(MaintenanceTask.id == c.task_b_id).first()
        if not other:
            continue
        entry = {
            "task_id": str(other.id),
            "task_code": other.task_code,
            "department": other.department.code if other.department else "—",
            "type": other.maintenance_type,
            "severity": other.severity,
            "duration_min": other.estimated_duration_min,
            "notes": c.notes,
        }
        if c.relationship == "compatible":
            compatible_tasks.append(entry)
        elif c.relationship == "conflict":
            conflict_tasks.append(entry)
        elif c.relationship == "dependency":
            dependencies.append(entry)

    for c in conflicts_as_b:
        other = db.query(MaintenanceTask).filter(MaintenanceTask.id == c.task_a_id).first()
        if not other:
            continue
        entry = {
            "task_id": str(other.id),
            "task_code": other.task_code,
            "department": other.department.code if other.department else "—",
            "type": other.maintenance_type,
            "severity": other.severity,
            "duration_min": other.estimated_duration_min,
            "notes": c.notes,
        }
        if c.relationship == "compatible":
            compatible_tasks.append(entry)
        elif c.relationship == "conflict":
            conflict_tasks.append(entry)
        elif c.relationship == "dependency":
            dependencies.append(entry)

    # 3. Candidate windows on this section fitting this task
    fitting_windows = (
        db.query(BlockWindow)
        .filter(
            BlockWindow.section_id == task.section_id,
            BlockWindow.is_available == True,
        )
        .order_by(BlockWindow.window_start.asc())
        .limit(10)
        .all()
    )

    windows_data = []
    for w in fitting_windows:
        dur = int((w.window_end - w.window_start).total_seconds() // 60)
        fits = dur >= task.minimum_contiguous_block_min
        breakdown_risk = get_window_risk_breakdown(db, str(task.section_id), w.window_start, w.window_end)
        windows_data.append({
            "id": str(w.id),
            "window_start": w.window_start.isoformat(),
            "window_end": w.window_end.isoformat(),
            "duration_min": dur,
            "fits_duration": fits,
            "risk_score": w.risk_score,
            "risk_level": "Low" if (w.risk_score or 0) < 0.25 else ("Moderate" if (w.risk_score or 0) < 0.5 else "High"),
            "risk_breakdown": breakdown_risk,
        })

    # 4. Check if assigned in latest SANGAM plan
    latest_run = (
        db.query(OptimizationRun)
        .filter(OptimizationRun.run_type == "sangam_optimized", OptimizationRun.status == "completed")
        .order_by(OptimizationRun.started_at.desc())
        .first()
    )

    scheduled_assignment = None
    if latest_run:
        block_task = (
            db.query(GeneratedBlockTask)
            .join(GeneratedBlock, GeneratedBlock.id == GeneratedBlockTask.block_id)
            .filter(
                GeneratedBlock.run_id == latest_run.id,
                GeneratedBlockTask.task_id == task.id,
            )
            .first()
        )
        if block_task:
            b = block_task.block
            co_tasks = (
                db.query(MaintenanceTask)
                .join(GeneratedBlockTask, GeneratedBlockTask.task_id == MaintenanceTask.id)
                .filter(GeneratedBlockTask.block_id == b.id)
                .all()
            )
            scheduled_assignment = {
                "block_id": str(b.id),
                "block_start": b.block_start.isoformat(),
                "block_end": b.block_end.isoformat(),
                "duration_min": int((b.block_end - b.block_start).total_seconds() // 60),
                "is_joint_block": b.is_joint_block,
                "co_scheduled_tasks": [
                    {
                        "task_code": ct.task_code,
                        "dept": ct.department.code if ct.department else "—",
                        "type": ct.maintenance_type,
                    }
                    for ct in co_tasks if ct.id != task.id
                ],
            }

    return {
        "task": {
            "id": str(task.id),
            "task_code": task.task_code,
            "department_code": task.department.code if task.department else None,
            "department_name": task.department.name if task.department else None,
            "section_id": str(task.section_id),
            "section_name": task.section.name if task.section else None,
            "from_station": task.section.from_station if task.section else None,
            "to_station": task.section.to_station if task.section else None,
            "asset_id": str(task.asset_id) if task.asset_id else None,
            "asset_name": task.asset.asset_type if task.asset else None,
            "maintenance_type": task.maintenance_type,
            "severity": task.severity,
            "detected_at": task.detected_at.isoformat() if task.detected_at else None,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "estimated_duration_min": task.estimated_duration_min,
            "minimum_contiguous_block_min": task.minimum_contiguous_block_min,
            "requires_power_isolation": task.requires_power_isolation,
            "can_run_parallel": task.can_run_parallel,
            "status": task.status,
            "priority_score": task.priority_score,
        },
        "priority_breakdown": breakdown,
        "relationships": {
            "compatible": compatible_tasks,
            "conflict": conflict_tasks,
            "dependencies": dependencies,
            "compatible_count": len(compatible_tasks),
            "conflict_count": len(conflict_tasks),
        },
        "candidate_windows": windows_data,
        "scheduled_assignment": scheduled_assignment,
    }
