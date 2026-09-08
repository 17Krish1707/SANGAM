import uuid
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.resource import Resource, TaskResourceRequirement
from backend.models.department import Department
from backend.models.task import MaintenanceTask

router = APIRouter(prefix="/api/resources", tags=["Resource Management"])


class ResourceCreate(BaseModel):
    name: str
    department_code: str  # ENG, TRD, SNT
    resource_type: str  # Crew | Equipment | Tower Wagon | Tamping Machine | Testing Equipment
    is_available: bool = True
    unavailability_reason: Optional[str] = None
    unavailable_from: Optional[str] = None
    unavailable_until: Optional[str] = None


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    department_code: Optional[str] = None
    resource_type: Optional[str] = None
    is_available: Optional[bool] = None
    unavailability_reason: Optional[str] = None
    unavailable_from: Optional[str] = None
    unavailable_until: Optional[str] = None


class AvailabilityToggle(BaseModel):
    is_available: bool
    reason: Optional[str] = None
    unavailable_from: Optional[str] = None
    unavailable_until: Optional[str] = None


@router.get("")
def list_resources(
    department: Optional[str] = Query(None, description="Department code"),
    resource_type: Optional[str] = Query(None, description="Crew | Equipment"),
    available_only: Optional[bool] = Query(False, description="Filter for available only"),
    db: Session = Depends(get_db),
):
    """
    List resources with department info and current assignment status.
    """
    query = db.query(Resource)

    if department:
        dept = db.query(Department).filter((Department.code == department) | (Department.name == department)).first()
        if dept:
            query = query.filter(Resource.department_id == dept.id)

    if resource_type:
        query = query.filter(Resource.resource_type == resource_type)

    if available_only:
        query = query.filter(Resource.is_available == True)

    resources = query.order_by(Resource.name.asc()).all()

    results = []
    for r in resources:
        # Find tasks requiring this resource
        reqs = db.query(TaskResourceRequirement).filter(TaskResourceRequirement.resource_id == r.id).all()
        task_codes = []
        for rq in reqs:
            t = db.query(MaintenanceTask).filter(MaintenanceTask.id == rq.task_id).first()
            if t:
                task_codes.append(t.task_code)

        results.append({
            "id": str(r.id),
            "name": r.name,
            "department_id": str(r.department_id),
            "department_code": r.department.code if r.department else "GEN",
            "department_name": r.department.name if r.department else None,
            "resource_type": r.resource_type,
            "is_available": r.is_available,
            "unavailability_reason": r.unavailability_reason,
            "unavailable_from": r.unavailable_from,
            "unavailable_until": r.unavailable_until,
            "assigned_tasks_count": len(task_codes),
            "assigned_task_codes": task_codes[:5],
            "status": "Available" if r.is_available else "Unavailable",
        })

    return results


@router.post("")
def create_resource(payload: ResourceCreate, db: Session = Depends(get_db)):
    """
    Add a new resource to the database.
    """
    code = payload.department_code.upper().strip()
    if code in ["SIG", "S&T", "SIGNALLING"]:
        code = "SNT"
    dept = db.query(Department).filter((Department.code == code) | (Department.name.ilike(f"%{code}%"))).first()
    if not dept:
        dept = db.query(Department).first()
        if not dept:
            raise HTTPException(status_code=400, detail=f"Department {payload.department_code} not found")

    res = Resource(
        id=uuid.uuid4(),
        department_id=dept.id,
        resource_type=payload.resource_type,
        name=payload.name,
        is_available=payload.is_available,
        unavailability_reason=payload.unavailability_reason,
        unavailable_from=payload.unavailable_from,
        unavailable_until=payload.unavailable_until,
    )
    db.add(res)
    db.commit()
    db.refresh(res)

    return {
        "status": "success",
        "id": str(res.id),
        "name": res.name,
        "department_code": dept.code,
        "is_available": res.is_available,
    }


@router.put("/{resource_id}")
def update_resource(resource_id: str, payload: ResourceUpdate, db: Session = Depends(get_db)):
    """
    Edit resource metadata.
    """
    res = db.query(Resource).filter(Resource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Resource not found")

    if payload.name is not None:
        res.name = payload.name
    if payload.resource_type is not None:
        res.resource_type = payload.resource_type
    if payload.department_code is not None:
        dept = db.query(Department).filter(Department.code == payload.department_code.upper().strip()).first()
        if dept:
            res.department_id = dept.id
    if payload.is_available is not None:
        res.is_available = payload.is_available
    if payload.unavailability_reason is not None:
        res.unavailability_reason = payload.unavailability_reason
    if payload.unavailable_from is not None:
        res.unavailable_from = payload.unavailable_from
    if payload.unavailable_until is not None:
        res.unavailable_until = payload.unavailable_until

    db.commit()
    db.refresh(res)
    return {"status": "success", "id": str(res.id), "name": res.name, "is_available": res.is_available}


@router.post("/{resource_id}/toggle-availability")
def toggle_availability(resource_id: str, payload: AvailabilityToggle, db: Session = Depends(get_db)):
    """
    Controller/planner marks a resource unavailable or restores availability.
    Directly impacts CP-SAT and heuristic schedulers.
    """
    res = db.query(Resource).filter(Resource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Resource not found")

    res.is_available = payload.is_available
    res.unavailability_reason = payload.reason if not payload.is_available else None
    res.unavailable_from = payload.unavailable_from if not payload.is_available else None
    res.unavailable_until = payload.unavailable_until if not payload.is_available else None

    db.commit()
    db.refresh(res)

    return {
        "status": "success",
        "id": str(res.id),
        "name": res.name,
        "is_available": res.is_available,
        "unavailability_reason": res.unavailability_reason,
    }


@router.delete("/{resource_id}")
def delete_resource(resource_id: str, db: Session = Depends(get_db)):
    """
    Delete a resource.
    """
    res = db.query(Resource).filter(Resource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Resource not found")

    db.delete(res)
    db.commit()
    return {"status": "success", "message": f"Resource {resource_id} deleted"}
