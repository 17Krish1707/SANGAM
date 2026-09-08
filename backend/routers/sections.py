from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.section import RailwaySection
from backend.services.compatibility_graph import build_section_graph, graph_to_dict

router = APIRouter(prefix="/api/sections", tags=["Sections & Compatibility Graph"])


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
            "from_station": s.from_station,
            "to_station": s.to_station,
            "line_type": s.line_type,
            "section_capacity_notes": s.section_capacity_notes,
        }
        for s in sections
    ]


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
