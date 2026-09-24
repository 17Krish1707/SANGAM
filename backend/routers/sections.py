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


@router.get("/corridor/infrastructure")
def get_corridor_infrastructure(
    from_station: Optional[str] = Query(None),
    to_station: Optional[str] = Query(None),
    corridor_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Step 2 Controller API:
    Retrieves internal railway infrastructure entities (Tracks/Lines, S&T Signals, 
    TRD OHE Masts & Electrical Sections, ENG Track/Chainage spans) between selected stations.
    """
    from backend.models.asset import Asset
    from backend.models.department import Department

    query = db.query(RailwaySection)
    if corridor_name:
        query = query.filter(RailwaySection.corridor_name == corridor_name)
    all_sections = query.all()

    # Filter by station range if requested
    matched_sections = []
    if from_station and to_station:
        # Check direct or ordered chain
        matched_sections = [
            s for s in all_sections 
            if (s.from_station.lower() == from_station.lower() and s.to_station.lower() == to_station.lower()) or
               (from_station.lower() in s.from_station.lower() or to_station.lower() in s.to_station.lower())
        ]
    if not matched_sections:
        matched_sections = all_sections

    sec_ids = [s.id for s in matched_sections]

    # Collect configured lines across matched sections
    lines_set = set()
    total_km = sum(getattr(s, "length_km", 25.0) or 25.0 for s in matched_sections)

    for s in matched_sections:
        lt = (s.line_type or "double").lower()
        if lt == "single":
            lines_set.add("Single Line")
        elif lt in ("double", "quadruple"):
            lines_set.add("UP Line")
            lines_set.add("DOWN Line")
            if lt == "quadruple":
                lines_set.add("UP Fast")
                lines_set.add("DOWN Fast")
        else:
            lines_set.add("UP Line")
            lines_set.add("DOWN Line")

    # Fetch departmental infrastructure assets
    assets = db.query(Asset).filter(Asset.section_id.in_(sec_ids)).all()

    eng_infra = []
    snt_infra = []
    trd_infra = []

    for a in assets:
        dept_code = a.department.code if a.department else "GEN"
        item = {
            "id": str(a.id),
            "section_id": str(a.section_id),
            "section_name": a.section.name if a.section else "",
            "asset_type": a.asset_type,
            "track_line": getattr(a, "track_line", "UP") or "UP",
            "start_ref": getattr(a, "start_location_ref", "") or "",
            "end_ref": getattr(a, "end_location_ref", "") or "",
            "chainage_start_km": getattr(a, "chainage_start_km", None),
            "chainage_end_km": getattr(a, "chainage_end_km", None),
            "health_state": a.health_state,
            "notes": a.notes,
        }
        if dept_code == "ENG":
            eng_infra.append(item)
        elif dept_code == "SNT":
            snt_infra.append(item)
        elif dept_code == "TRD":
            trd_infra.append(item)

    return {
        "corridor_name": matched_sections[0].corridor_name if matched_sections else "Railway Corridor",
        "from_station": from_station or (matched_sections[0].from_station if matched_sections else ""),
        "to_station": to_station or (matched_sections[-1].to_station if matched_sections else ""),
        "total_length_km": round(total_km, 2),
        "configured_lines": sorted(list(lines_set)) if lines_set else ["UP Line", "DOWN Line"],
        "sections": [
            {
                "id": str(s.id),
                "name": s.name,
                "from_station": s.from_station,
                "to_station": s.to_station,
                "length_km": getattr(s, "length_km", 25.0),
                "line_type": s.line_type,
                "traction_type": getattr(s, "traction_type", "25 kV AC OHE"),
            }
            for s in matched_sections
        ],
        "departments": {
            "engineering": {
                "name": "Civil Engineering (P-Way)",
                "reference_unit": "Track Section & Chainage (KM)",
                "entities": eng_infra,
                "count": len(eng_infra),
            },
            "signalling": {
                "name": "Signalling & Telecom (S&T)",
                "reference_unit": "Signals & Signal Spans (Signal → Signal)",
                "entities": snt_infra,
                "count": len(snt_infra),
            },
            "traction": {
                "name": "Traction Distribution (TRD)",
                "reference_unit": "OHE Masts & Electrical Sections (25kV Isolations)",
                "entities": trd_infra,
                "count": len(trd_infra),
            },
        },
    }


@router.get("/corridor/coordination-analysis")
def get_corridor_coordination_analysis(
    section_ids: Optional[str] = Query(None, description="Comma-separated section IDs"),
    db: Session = Depends(get_db),
):
    """
    Step 7 Controller API:
    Computes pair-by-pair physical, operational, and electrical coordination analysis across
    all pending tasks in the selected corridor. Highlights exact spatial overlap, track relationship,
    power isolation requirements, and candidate joint possession status.
    """
    from backend.models.task import MaintenanceTask
    from backend.services.spatial_reference import evaluate_tasks_spatial_compatibility

    query = db.query(MaintenanceTask).filter(
        MaintenanceTask.status.in_(["Pending", "Ready for Planning", "New"])
    )
    if section_ids:
        sec_list = [s.strip() for s in section_ids.split(",") if s.strip()]
        if sec_list:
            query = query.filter(MaintenanceTask.section_id.in_(sec_list))

    tasks = query.all()
    n = len(tasks)
    pairs = []

    for i in range(n):
        for j in range(i + 1, n):
            t1 = tasks[i]
            t2 = tasks[j]

            eval_res = evaluate_tasks_spatial_compatibility(t1, t2)
            dept1 = t1.department.code if t1.department else "GEN"
            dept2 = t2.department.code if t2.department else "GEN"
            is_cross_dept = dept1 != dept2

            # Determine coordination verdict
            if eval_res.get("compatible", False):
                verdict = "CANDIDATE JOINT WORK" if is_cross_dept else "PARALLEL SAME-DEPT WORK"
                verdict_color = "emerald"
            else:
                verdict = "CANNOT BE COMBINED"
                verdict_color = "slate"

            pairs.append({
                "task_a": {
                    "id": str(t1.id),
                    "code": t1.task_code,
                    "dept": dept1,
                    "type": t1.maintenance_type,
                    "location": getattr(t1, "location_display", None) or f"KM {getattr(t1, 'chainage_from_km', 0.0):.1f}–{getattr(t1, 'chainage_to_km', 1.0):.1f}",
                    "track": getattr(t1, "track_line", "UP"),
                    "requires_power": t1.requires_power_isolation,
                },
                "task_b": {
                    "id": str(t2.id),
                    "code": t2.task_code,
                    "dept": dept2,
                    "type": t2.maintenance_type,
                    "location": getattr(t2, "location_display", None) or f"KM {getattr(t2, 'chainage_from_km', 0.0):.1f}–{getattr(t2, 'chainage_to_km', 1.0):.1f}",
                    "track": getattr(t2, "track_line", "UP"),
                    "requires_power": t2.requires_power_isolation,
                },
                "spatial_overlap": "YES" if eval_res.get("spatial_overlap", False) else "NO",
                "overlap_km": eval_res.get("overlap_km", 0.0),
                "track_relation": eval_res.get("track_relation", "Same Section"),
                "protection_check": eval_res.get("protection_type", "Standard Track Protection"),
                "requires_power_cut": eval_res.get("requires_power_cut", False),
                "result": verdict,
                "result_color": verdict_color,
                "reason": eval_res.get("reason", ""),
                "is_cross_department": is_cross_dept,
            })

    # Sort so candidate joint work comes first
    pairs.sort(key=lambda p: (0 if p["result"] == "CANDIDATE JOINT WORK" else 1 if p["result"] == "PARALLEL SAME-DEPT WORK" else 2))

    return {
        "total_tasks_evaluated": n,
        "total_coordination_pairs": len(pairs),
        "candidate_joint_pairs": sum(1 for p in pairs if p["result"] == "CANDIDATE JOINT WORK"),
        "pairs": pairs,
    }

