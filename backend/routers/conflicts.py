from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.conflict import TaskConflict
from backend.models.task import MaintenanceTask

router = APIRouter(prefix="/api/conflicts", tags=["Conflicts & Alerts"])


@router.get("")
def list_conflicts(
    relationship: Optional[str] = Query(None, description="Filter by relationship type: conflict | compatible | dependency"),
    db: Session = Depends(get_db),
):
    """
    Returns task_conflicts rows, optionally filtered by relationship type.
    Used by the Conflicts & Alerts page to show safety rules being enforced.
    """
    query = db.query(TaskConflict)
    if relationship:
        query = query.filter(TaskConflict.relationship == relationship)

    rows = query.all()

    result = []
    for row in rows:
        task_a = db.query(MaintenanceTask).filter(MaintenanceTask.id == row.task_a_id).first()
        task_b = db.query(MaintenanceTask).filter(MaintenanceTask.id == row.task_b_id).first()
        result.append({
            "id": str(row.id),
            "task_a_id": str(row.task_a_id),
            "task_a_code": task_a.task_code if task_a else "—",
            "task_a_section": task_a.section.name if (task_a and task_a.section) else "—",
            "task_a_dept": task_a.department.code if (task_a and task_a.department) else "—",
            "task_b_id": str(row.task_b_id),
            "task_b_code": task_b.task_code if task_b else "—",
            "task_b_section": task_b.section.name if (task_b and task_b.section) else "—",
            "task_b_dept": task_b.department.code if (task_b and task_b.department) else "—",
            "relationship": row.relationship,
            "notes": row.notes,
        })

    return result


@router.get("/compatibility-matrix")
def get_corridor_compatibility_matrix(
    section_id: Optional[str] = Query(None, description="Optional railway section ID filter"),
    db: Session = Depends(get_db),
):
    """
    Returns full data-driven inter-department compatibility and joint work graph
    for active tasks across the corridor.
    """
    from backend.services.compatibility_graph import build_corridor_compatibility_matrix
    return build_corridor_compatibility_matrix(db, section_id=section_id)

