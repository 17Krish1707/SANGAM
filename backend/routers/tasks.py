from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
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
        ref_dt = datetime.utcnow()
        query = query.filter(MaintenanceTask.due_date <= ref_dt)

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
            "description": getattr(t, "description", None),
            "operational_notes": getattr(t, "operational_notes", None),
            "source": getattr(t, "source", "Synthetic Demo"),
            "deferred_reason": getattr(t, "deferred_reason", None),
            "deferred_until": t.deferred_until.isoformat() if getattr(t, "deferred_until", None) else None,
            "completed_at": t.completed_at.isoformat() if getattr(t, "completed_at", None) else None,
            "completion_notes": getattr(t, "completion_notes", None),
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
            "description": getattr(task, "description", None),
            "operational_notes": getattr(task, "operational_notes", None),
            "source": getattr(task, "source", "Synthetic Demo"),
            "deferred_reason": getattr(task, "deferred_reason", None),
            "deferred_until": task.deferred_until.isoformat() if getattr(task, "deferred_until", None) else None,
            "completed_at": task.completed_at.isoformat() if getattr(task, "completed_at", None) else None,
            "completion_notes": getattr(task, "completion_notes", None),
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


# ── Task CRUD & Lifecycle Endpoints ──────────────────────────────────────────

class TaskCreateRequest(BaseModel):
    department_code: str  # ENG | TRD | SNT
    section_id: str
    asset_name: Optional[str] = "Track / Catenary / Point"
    maintenance_type: str
    description: Optional[str] = None
    severity: str = "Medium"  # Low | Medium | High | Critical
    detected_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    estimated_duration_min: int
    minimum_contiguous_block_min: Optional[int] = None
    requires_power_isolation: bool = False
    can_run_parallel: bool = False
    crew_type: Optional[str] = None
    equipment: Optional[str] = None
    required_resource_ids: Optional[List[str]] = None
    operational_notes: Optional[str] = None
    status: str = "Pending"  # Pending | Ready for Planning | New
    source: str = "Manual"


class TaskUpdateRequest(BaseModel):
    department_code: Optional[str] = None
    section_id: Optional[str] = None
    asset_name: Optional[str] = None
    maintenance_type: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    detected_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    estimated_duration_min: Optional[int] = None
    minimum_contiguous_block_min: Optional[int] = None
    requires_power_isolation: Optional[bool] = None
    can_run_parallel: Optional[bool] = None
    operational_notes: Optional[str] = None
    status: Optional[str] = None


class TaskDeferRequest(BaseModel):
    reason: str
    new_target_date: datetime


class TaskCompleteRequest(BaseModel):
    completion_time: Optional[datetime] = None
    note: Optional[str] = None


class TaskImportRow(BaseModel):
    department: str
    section: str
    maintenance_type: str
    severity: str = "Medium"
    due_date: str
    duration_min: int
    requires_power_isolation: bool = False
    description: Optional[str] = None


class TaskImportBatch(BaseModel):
    tasks: List[TaskImportRow]


@router.post("")
def create_task(req: TaskCreateRequest, db: Session = Depends(get_db)):
    """
    Add a new maintenance request with automatic priority calculation and DB persistence.
    """
    import uuid
    from backend.models.section import RailwaySection
    from backend.models.asset import Asset
    from backend.models.resource import Resource, TaskResourceRequirement

    if req.estimated_duration_min <= 0:
        raise HTTPException(status_code=400, detail="Estimated duration must be greater than 0 minutes")

    detected = req.detected_at or datetime.utcnow()
    if detected.tzinfo is not None:
        detected = detected.replace(tzinfo=None)

    due = req.due_date or (detected + timedelta(days=7))
    if due.tzinfo is not None:
        due = due.replace(tzinfo=None)

    if due < detected:
        raise HTTPException(status_code=400, detail="Due date cannot be before detected date")

    # Find department
    dept = db.query(Department).filter(
        (Department.code == req.department_code.upper().strip()) |
        (Department.name.ilike(f"%{req.department_code}%"))
    ).first()
    if not dept:
        dept = db.query(Department).first()
        if not dept:
            raise HTTPException(status_code=400, detail=f"Department {req.department_code} not found")

    # Find section
    sec = db.query(RailwaySection).filter(
        (RailwaySection.id == req.section_id) |
        (RailwaySection.name.ilike(f"%{req.section_id}%"))
    ).first()
    if not sec:
        raise HTTPException(status_code=400, detail=f"Railway section {req.section_id} not found")

    # Asset
    asset = None
    if req.asset_name:
        asset = db.query(Asset).filter(Asset.section_id == sec.id, Asset.asset_type.ilike(f"%{req.asset_name}%")).first()
        if not asset:
            asset = Asset(
                id=uuid.uuid4(),
                section_id=sec.id,
                department_id=dept.id,
                asset_type=req.asset_name,
                health_state="Good",
            )
            db.add(asset)
            db.flush()

    # Generate unique task_code
    seq_count = db.query(MaintenanceTask).filter(MaintenanceTask.department_id == dept.id).count() + 1
    task_code = f"{dept.code}-{seq_count:04d}"
    while db.query(MaintenanceTask).filter(MaintenanceTask.task_code == task_code).first():
        seq_count += 1
        task_code = f"{dept.code}-{seq_count:04d}"

    min_block = req.minimum_contiguous_block_min or req.estimated_duration_min

    task = MaintenanceTask(
        id=uuid.uuid4(),
        task_code=task_code,
        department_id=dept.id,
        section_id=sec.id,
        asset_id=asset.id if asset else None,
        maintenance_type=req.maintenance_type,
        severity=req.severity,
        detected_at=detected,
        due_date=due,
        estimated_duration_min=req.estimated_duration_min,
        minimum_contiguous_block_min=min_block,
        requires_power_isolation=req.requires_power_isolation,
        can_run_parallel=req.can_run_parallel,
        status=req.status,
        description=req.description,
        operational_notes=req.operational_notes,
        source=req.source,
    )

    # Compute priority score
    task.priority_score = compute_priority_score(task)

    db.add(task)
    db.flush()

    # Link resource requirements if specified
    if req.crew_type:
        crew_res = db.query(Resource).filter(
            Resource.department_id == dept.id,
            Resource.resource_type == "Crew",
            Resource.name.ilike(f"%{req.crew_type}%")
        ).first()
        if crew_res:
            db.add(TaskResourceRequirement(id=uuid.uuid4(), task_id=task.id, resource_id=crew_res.id))

    if req.equipment:
        eq_res = db.query(Resource).filter(
            Resource.department_id == dept.id,
            Resource.name.ilike(f"%{req.equipment}%")
        ).first()
        if eq_res:
            db.add(TaskResourceRequirement(id=uuid.uuid4(), task_id=task.id, resource_id=eq_res.id))

    if req.required_resource_ids:
        for r_id in req.required_resource_ids:
            r_obj = db.query(Resource).filter(
                (Resource.id == r_id) | (Resource.name.ilike(f"%{r_id}%"))
            ).first()
            if r_obj:
                existing_req = db.query(TaskResourceRequirement).filter(
                    TaskResourceRequirement.task_id == task.id,
                    TaskResourceRequirement.resource_id == r_obj.id
                ).first()
                if not existing_req:
                    db.add(TaskResourceRequirement(id=uuid.uuid4(), task_id=task.id, resource_id=r_obj.id))

    db.commit()
    db.refresh(task)

    return {
        "status": "success",
        "id": str(task.id),
        "task_code": task.task_code,
        "priority_score": task.priority_score,
        "message": f"Maintenance work {task.task_code} added and scored successfully.",
    }


@router.put("/{task_id}")
def update_task(task_id: str, req: TaskUpdateRequest, db: Session = Depends(get_db)):
    """
    Update maintenance request fields and recompute priority score.
    """
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        task = db.query(MaintenanceTask).filter(MaintenanceTask.task_code == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    if req.department_code is not None:
        dept = db.query(Department).filter(Department.code == req.department_code.upper().strip()).first()
        if dept:
            task.department_id = dept.id

    if req.section_id is not None:
        sec = db.query(RailwaySection).filter((RailwaySection.id == req.section_id) | (RailwaySection.name == req.section_id)).first()
        if sec:
            task.section_id = sec.id

    if req.maintenance_type is not None:
        task.maintenance_type = req.maintenance_type
    if req.description is not None:
        task.description = req.description
    if req.severity is not None:
        task.severity = req.severity
    if req.detected_at is not None:
        det = req.detected_at
        if det.tzinfo is not None:
            det = det.replace(tzinfo=None)
        task.detected_at = det
    if req.due_date is not None:
        due = req.due_date
        if due.tzinfo is not None:
            due = due.replace(tzinfo=None)
        task.due_date = due
    if req.estimated_duration_min is not None:
        task.estimated_duration_min = req.estimated_duration_min
    if req.minimum_contiguous_block_min is not None:
        task.minimum_contiguous_block_min = req.minimum_contiguous_block_min
    if req.requires_power_isolation is not None:
        task.requires_power_isolation = req.requires_power_isolation
    if req.can_run_parallel is not None:
        task.can_run_parallel = req.can_run_parallel
    if req.operational_notes is not None:
        task.operational_notes = req.operational_notes
    if req.status is not None:
        task.status = req.status

    # Recalculate priority
    task.priority_score = compute_priority_score(task)

    db.commit()
    db.refresh(task)

    return {
        "status": "success",
        "id": str(task.id),
        "task_code": task.task_code,
        "priority_score": task.priority_score,
        "message": f"Maintenance work {task.task_code} updated successfully.",
    }


@router.post("/{task_id}/duplicate")
def duplicate_task(task_id: str, db: Session = Depends(get_db)):
    """
    Duplicate an existing maintenance request with a new task code.
    """
    orig = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not orig:
        orig = db.query(MaintenanceTask).filter(MaintenanceTask.task_code == task_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    import uuid
    dept_code = orig.department.code if orig.department else "GEN"
    seq_count = db.query(MaintenanceTask).filter(MaintenanceTask.department_id == orig.department_id).count() + 1
    new_code = f"{dept_code}-{seq_count:04d}"

    clone = MaintenanceTask(
        id=uuid.uuid4(),
        task_code=new_code,
        department_id=orig.department_id,
        section_id=orig.section_id,
        asset_id=orig.asset_id,
        maintenance_type=f"{orig.maintenance_type} (Copy)",
        severity=orig.severity,
        detected_at=datetime.utcnow(),
        due_date=orig.due_date,
        estimated_duration_min=orig.estimated_duration_min,
        minimum_contiguous_block_min=orig.minimum_contiguous_block_min,
        requires_power_isolation=orig.requires_power_isolation,
        can_run_parallel=orig.can_run_parallel,
        status="Pending",
        description=orig.description,
        operational_notes=f"Cloned from {orig.task_code}",
        source="Manual",
    )
    clone.priority_score = compute_priority_score(clone)

    db.add(clone)
    db.commit()
    db.refresh(clone)

    return {
        "status": "success",
        "new_task_id": str(clone.id),
        "new_task_code": clone.task_code,
        "message": f"Task duplicated as {clone.task_code}",
    }


@router.post("/{task_id}/defer")
def defer_task(task_id: str, req: TaskDeferRequest, db: Session = Depends(get_db)):
    """
    Defer a maintenance request with operational justification and new target date.
    """
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        task = db.query(MaintenanceTask).filter(MaintenanceTask.task_code == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    target = req.new_target_date
    if target and target.tzinfo is not None:
        target = target.replace(tzinfo=None)

    task.status = "Deferred"
    task.deferred_reason = req.reason
    task.deferred_until = target
    task.due_date = target
    task.priority_score = compute_priority_score(task)

    db.commit()
    return {
        "status": "success",
        "task_id": str(task.id),
        "task_code": task.task_code,
        "status_now": task.status,
        "deferred_until": task.deferred_until.isoformat(),
        "reason": task.deferred_reason,
    }


@router.post("/{task_id}/complete")
def complete_task(task_id: str, req: TaskCompleteRequest, db: Session = Depends(get_db)):
    """
    Mark maintenance task completed with completion timestamp and operational log.
    """
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        task = db.query(MaintenanceTask).filter(MaintenanceTask.task_code == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    task.status = "Completed"
    task.completed_at = req.completion_time or datetime.utcnow()
    task.completion_notes = req.note or "Work verified and certified by Section Engineer"

    db.commit()
    return {
        "status": "success",
        "task_id": str(task.id),
        "task_code": task.task_code,
        "status_now": task.status,
        "completed_at": task.completed_at.isoformat(),
    }


@router.delete("/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    """
    Delete a maintenance task from database.
    """
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        task = db.query(MaintenanceTask).filter(MaintenanceTask.task_code == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    db.delete(task)
    db.commit()
    return {"status": "success", "message": f"Maintenance task {task_id} deleted"}


@router.post("/emergency")
def create_emergency_task(
    department_code: str = Query("ENG", description="ENG | TRD | SNT"),
    section_id: str = Query(..., description="Section ID"),
    maintenance_type: str = Query("Emergency Track Fracture / OHE Snap", description="Defect description"),
    duration_min: int = Query(90, description="Duration in minutes"),
    db: Session = Depends(get_db),
):
    """
    Emergency maintenance creation:
    Immediately creates a Critical task detected right now, triggering priority recalculation.
    """
    req = TaskCreateRequest(
        department_code=department_code,
        section_id=section_id,
        maintenance_type=maintenance_type,
        severity="Critical",
        detected_at=datetime.utcnow(),
        due_date=datetime.utcnow() + timedelta(hours=6),
        estimated_duration_min=duration_min,
        minimum_contiguous_block_min=duration_min,
        requires_power_isolation=(department_code == "TRD"),
        operational_notes="EMERGENCY REPORT: Requires immediate possession slot",
        status="Pending",
        source="Manual",
    )
    return create_task(req, db)


@router.post("/import-csv")
def import_csv_tasks(payload: TaskImportBatch, db: Session = Depends(get_db)):
    """
    Bulk import maintenance tasks from structured table or CSV parse.
    """
    created = []
    for r in payload.tasks:
        try:
            d_due = datetime.fromisoformat(r.due_date.replace("Z", "+00:00"))
        except Exception:
            d_due = datetime.utcnow() + timedelta(days=3)

        req = TaskCreateRequest(
            department_code=r.department,
            section_id=r.section,
            maintenance_type=r.maintenance_type,
            severity=r.severity,
            due_date=d_due,
            estimated_duration_min=r.duration_min,
            minimum_contiguous_block_min=r.duration_min,
            requires_power_isolation=r.requires_power_isolation,
            description=r.description,
            status="Pending",
            source="CSV Import",
        )
        try:
            res = create_task(req, db)
            created.append(res["task_code"])
        except Exception as e:
            continue

    return {
        "status": "success",
        "imported_count": len(created),
        "task_codes": created,
        "message": f"Successfully imported {len(created)} tasks.",
    }

