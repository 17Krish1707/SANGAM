from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid

from backend.database import get_db
from backend.models.section import RailwaySection
from backend.services.compatibility_graph import build_section_graph, graph_to_dict

router = APIRouter(prefix="/api/sections", tags=["Sections & Corridor Management"])


class SectionCreate(BaseModel):
    name: str
    corridor_name: Optional[str] = "Main Corridor"
    from_station: str
    to_station: str
    length_km: Optional[float] = 25.0
    line_type: Optional[str] = "double"  # single | double
    is_electrified: Optional[bool] = True
    traction_type: Optional[str] = "25 kV AC OHE"
    section_capacity_notes: Optional[str] = None


class SectionUpdate(BaseModel):
    name: Optional[str] = None
    corridor_name: Optional[str] = None
    from_station: Optional[str] = None
    to_station: Optional[str] = None
    length_km: Optional[float] = None
    line_type: Optional[str] = None
    is_electrified: Optional[bool] = None
    traction_type: Optional[str] = None
    section_capacity_notes: Optional[str] = None


class CorridorSetupRequest(BaseModel):
    corridor_name: str
    stations: List[str]
    sections: Optional[List[SectionCreate]] = None
    line_type: Optional[str] = "double"
    is_electrified: Optional[bool] = True


@router.get("")
def list_sections(db: Session = Depends(get_db)):
    """
    List all railway sections in the network.
    """
    sections = db.query(RailwaySection).all()
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "corridor_name": getattr(s, "corridor_name", "Main Corridor") or "Main Corridor",
            "from_station": s.from_station,
            "to_station": s.to_station,
            "length_km": getattr(s, "length_km", 25.0) or 25.0,
            "line_type": s.line_type,
            "is_electrified": getattr(s, "is_electrified", True) if getattr(s, "is_electrified", None) is not None else True,
            "traction_type": getattr(s, "traction_type", "25 kV AC OHE") or "25 kV AC OHE",
            "section_capacity_notes": s.section_capacity_notes,
        }
        for s in sections
    ]


@router.post("")
def create_section(payload: SectionCreate, db: Session = Depends(get_db)):
    """
    Create a new railway section manually.
    """
    existing = db.query(RailwaySection).filter(RailwaySection.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Section '{payload.name}' already exists.")

    sec = RailwaySection(
        id=uuid.uuid4(),
        name=payload.name,
        corridor_name=payload.corridor_name or "Main Corridor",
        from_station=payload.from_station,
        to_station=payload.to_station,
        length_km=payload.length_km or 25.0,
        line_type=payload.line_type or "double",
        is_electrified=payload.is_electrified if payload.is_electrified is not None else True,
        traction_type=payload.traction_type or "25 kV AC OHE",
        section_capacity_notes=payload.section_capacity_notes,
    )
    db.add(sec)
    db.commit()
    db.refresh(sec)
    return {
        "status": "success",
        "id": str(sec.id),
        "name": sec.name,
        "message": f"Section '{sec.name}' created successfully.",
    }


@router.put("/{section_id}")
def update_section(section_id: str, payload: SectionUpdate, db: Session = Depends(get_db)):
    sec = db.query(RailwaySection).filter(RailwaySection.id == section_id).first()
    if not sec:
        raise HTTPException(status_code=404, detail="Railway section not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(sec, field, val)

    db.commit()
    db.refresh(sec)
    return {"status": "success", "id": str(sec.id), "message": f"Section '{sec.name}' updated."}


@router.delete("/{section_id}")
def delete_section(section_id: str, db: Session = Depends(get_db)):
    sec = db.query(RailwaySection).filter(RailwaySection.id == section_id).first()
    if not sec:
        raise HTTPException(status_code=404, detail="Railway section not found")

    sec_name = sec.name
    db.delete(sec)
    db.commit()
    return {"status": "success", "message": f"Section '{sec_name}' deleted."}


@router.post("/corridor-setup")
def setup_corridor(payload: CorridorSetupRequest, db: Session = Depends(get_db)):
    """
    User-driven corridor setup: creates or replaces sections for a custom corridor.
    """
    sections_to_create = payload.sections or []
    if not sections_to_create and len(payload.stations) >= 2:
        for i in range(len(payload.stations) - 1):
            s_from = payload.stations[i].strip()
            s_to = payload.stations[i+1].strip()
            sections_to_create.append(
                SectionCreate(
                    name=f"{s_from}-{s_to}",
                    corridor_name=payload.corridor_name,
                    from_station=s_from,
                    to_station=s_to,
                    length_km=25.0,
                    line_type=payload.line_type or "double",
                    is_electrified=payload.is_electrified if payload.is_electrified is not None else True,
                    traction_type="25 kV AC OHE",
                    section_capacity_notes="Configured via custom corridor setup."
                )
            )

    created_sections = []
    for sc in sections_to_create:
        existing = db.query(RailwaySection).filter(RailwaySection.name == sc.name).first()
        if existing:
            existing.corridor_name = payload.corridor_name
            existing.from_station = sc.from_station
            existing.to_station = sc.to_station
            existing.length_km = sc.length_km or 25.0
            existing.line_type = sc.line_type or "double"
            existing.is_electrified = sc.is_electrified if sc.is_electrified is not None else True
            existing.traction_type = sc.traction_type or "25 kV AC OHE"
            existing.section_capacity_notes = sc.section_capacity_notes
            created_sections.append(existing)
        else:
            sec = RailwaySection(
                id=uuid.uuid4(),
                name=sc.name,
                corridor_name=payload.corridor_name,
                from_station=sc.from_station,
                to_station=sc.to_station,
                length_km=sc.length_km or 25.0,
                line_type=sc.line_type or "double",
                is_electrified=sc.is_electrified if sc.is_electrified is not None else True,
                traction_type=sc.traction_type or "25 kV AC OHE",
                section_capacity_notes=sc.section_capacity_notes,
            )
            db.add(sec)
            created_sections.append(sec)

    db.commit()
    return {
        "status": "success",
        "corridor_name": payload.corridor_name,
        "sections_count": len(created_sections),
        "message": f"Corridor '{payload.corridor_name}' configured with {len(created_sections)} sections.",
    }


@router.get("/{section_id}/compatibility-graph")
def get_section_compatibility_graph(
    section_id: str,
    start_date: Optional[datetime] = Query(None, description="Start date/time in ISO format"),
    end_date: Optional[datetime] = Query(None, description="End date/time in ISO format"),
    db: Session = Depends(get_db),
):
    """
    Returns nodes (tasks) and edges (compatible, conflict, dependency)
    in a JSON shape ready for frontend visualization.
    """
    section = db.query(RailwaySection).filter(RailwaySection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Railway section not found")

    graph = build_section_graph(db, section_id=section_id, start_date=start_date, end_date=end_date)
    return graph_to_dict(graph)
