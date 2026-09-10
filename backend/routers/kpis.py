from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.optimization import OptimizationRun, GeneratedBlock
from backend.services.kpi_engine import compute_kpis

router = APIRouter(prefix="/api/kpis", tags=["KPIs"])


@router.get("/asset-availability")
def get_asset_availability(
    run_id: Optional[str] = Query(None, description="Optional optimization run ID"),
    db: Session = Depends(get_db),
):
    """
    Computes asset availability % for the corridor over the planning horizon:
    AssetAvailability = (1 - total_block_hours / total_available_hours_in_horizon) * 100
    Default horizon = 5 sections * 7 days * 24 hours = 840 section-hours.
    """
    if run_id:
        opt_run = db.query(OptimizationRun).filter(OptimizationRun.id == run_id).first()
    else:
        # Pick latest completed sangam_optimized run
        opt_run = (
            db.query(OptimizationRun)
            .filter(
                OptimizationRun.run_type == "sangam_optimized",
                OptimizationRun.status == "completed",
            )
            .order_by(OptimizationRun.started_at.desc())
            .first()
        )

    if not opt_run:
        return {
            "asset_availability_pct": 100.0,
            "total_block_hours": 0.0,
            "total_corridor_hours": 840.0,
            "run_id": None,
        }

    blocks = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == opt_run.id).all()
    total_minutes = sum(int((b.block_end - b.block_start).total_seconds() // 60) for b in blocks)
    total_block_hours = round(total_minutes / 60.0, 2)

    from backend.models.section import RailwaySection
    section_count = db.query(RailwaySection).count() or 1
    total_corridor_hours = section_count * 7 * 24.0  # sections × 168 hours/week
    availability_pct = max(0.0, min(100.0, round((1.0 - (total_block_hours / total_corridor_hours)) * 100.0, 1)))

    return {
        "asset_availability_pct": availability_pct,
        "total_block_hours": total_block_hours,
        "total_corridor_hours": total_corridor_hours,
        "run_id": str(opt_run.id),
        "run_type": opt_run.run_type,
    }
