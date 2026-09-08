from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.corridor_availability import (
    compute_candidate_windows,
    compute_window_risk_score,
    populate_block_windows,
)
from backend.models.section import RailwaySection
from backend.models.block_window import BlockWindow
from backend.models.train import TrainMovement
from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask

router = APIRouter(prefix="/api/corridor", tags=["Corridor Availability"])


def get_window_risk_breakdown(
    db: Session,
    section_id: str,
    w_start: datetime,
    w_end: datetime,
) -> dict:
    """Compute detailed 4-factor risk breakdown for a window."""
    two_hours_before = w_start - timedelta(hours=2)
    two_hours_after = w_end + timedelta(hours=2)

    nearby_trains = (
        db.query(TrainMovement)
        .filter(
            TrainMovement.section_id == section_id,
            TrainMovement.exit_time >= two_hours_before,
            TrainMovement.entry_time <= two_hours_after,
        )
        .all()
    )

    train_count = len(nearby_trains)
    train_density = round(min(1.0, train_count / 6.0), 3)

    goods_trains = [t for t in nearby_trains if t.train_type == "Goods"]
    if goods_trains:
        uncertainties = [(1.0 - (t.forecast_confidence or 0.8)) for t in goods_trains]
        freight_uncertainty = round(sum(uncertainties) / len(uncertainties), 3)
    else:
        freight_uncertainty = 0.0

    peak_hour_penalty = 0.0
    check_cursor = w_start
    while check_cursor < w_end:
        hour = check_cursor.hour
        if (6 <= hour < 10) or (17 <= hour < 21):
            peak_hour_penalty = 0.3
            break
        check_cursor += timedelta(minutes=15)
    if peak_hour_penalty == 0.0 and ((6 <= w_end.hour < 10) or (17 <= w_end.hour < 21)):
        peak_hour_penalty = 0.3

    delay_propagation_risk = 0.0
    fifteen_min = timedelta(minutes=15)
    passenger_trains = [t for t in nearby_trains if t.train_type == "Passenger"]
    for pt in passenger_trains:
        if abs((pt.entry_time - w_end).total_seconds()) <= 15 * 60 or abs((w_start - pt.exit_time).total_seconds()) <= 15 * 60:
            delay_propagation_risk = 0.2
            break

    total_risk = round(train_density + freight_uncertainty + peak_hour_penalty + delay_propagation_risk, 3)
    return {
        "train_density": train_density,
        "freight_uncertainty": freight_uncertainty,
        "peak_hour_penalty": peak_hour_penalty,
        "delay_propagation_risk": delay_propagation_risk,
        "total_risk": total_risk,
        "nearby_train_count": train_count,
    }


@router.get("/{section_id}/windows")
def get_corridor_windows(
    section_id: str,
    start_date: Optional[datetime] = Query(None, description="Start date/time in ISO format"),
    end_date: Optional[datetime] = Query(None, description="End date/time in ISO format"),
    db: Session = Depends(get_db),
):
    """
    Fetch candidate maintenance windows with computed risk scores for a railway section,
    sorted by risk_score ascending (safest/best windows first).
    """
    section = db.query(RailwaySection).filter(RailwaySection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Railway section not found")

    if start_date is None:
        start_date = datetime(2026, 9, 7, 0, 0, 0)
    if end_date is None:
        end_date = start_date + timedelta(days=7)

    existing_windows = (
        db.query(BlockWindow)
        .filter(
            BlockWindow.section_id == section_id,
            BlockWindow.window_start >= start_date,
            BlockWindow.window_end <= end_date,
            BlockWindow.is_available == True,
        )
        .order_by(BlockWindow.risk_score.asc().nullslast())
        .all()
    )

    if not existing_windows:
        existing_windows = populate_block_windows(db, [section_id], start_date, end_date)
        existing_windows.sort(key=lambda w: (w.risk_score if w.risk_score is not None else 999.0))

    results = []
    for w in existing_windows:
        duration_min = int((w.window_end - w.window_start).total_seconds() // 60)
        breakdown = get_window_risk_breakdown(db, section_id, w.window_start, w.window_end)
        results.append({
            "id": str(w.id),
            "section_id": str(w.section_id),
            "section_name": section.name,
            "window_start": w.window_start.isoformat(),
            "window_end": w.window_end.isoformat(),
            "duration_min": duration_min,
            "block_type": w.block_type,
            "is_available": w.is_available,
            "risk_score": w.risk_score,
            "risk_breakdown": breakdown,
        })

    return results


@router.get("/{section_id}/trains")
def get_section_trains(
    section_id: str,
    start_date: Optional[datetime] = Query(None, description="Start date/time in ISO format"),
    end_date: Optional[datetime] = Query(None, description="End date/time in ISO format"),
    db: Session = Depends(get_db),
):
    """
    Fetch all train movements on the specified section in the requested time interval.
    """
    section = db.query(RailwaySection).filter(RailwaySection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Railway section not found")

    if start_date is None:
        start_date = datetime(2026, 9, 7, 0, 0, 0)
    if end_date is None:
        end_date = start_date + timedelta(days=1)

    trains = (
        db.query(TrainMovement)
        .filter(
            TrainMovement.section_id == section_id,
            TrainMovement.exit_time >= start_date,
            TrainMovement.entry_time <= end_date,
        )
        .order_by(TrainMovement.entry_time.asc())
        .all()
    )

    return [
        {
            "id": str(t.id),
            "section_id": str(t.section_id),
            "train_type": t.train_type,
            "entry_time": t.entry_time.isoformat(),
            "exit_time": t.exit_time.isoformat(),
            "transit_min": int((t.exit_time - t.entry_time).total_seconds() // 60),
            "train_number": getattr(t, "train_number", None) or ("12925" if t.train_type == "Passenger" else "G-4021"),
            "source": getattr(t, "source", "Synthetic Demo"),
            "notes": getattr(t, "notes", None),
            "priority": t.priority,
            "forecast_confidence": t.forecast_confidence,
        }
        for t in trains
    ]


@router.get("/{section_id}/occupancy")
def get_section_24h_occupancy(
    section_id: str,
    target_date: Optional[str] = Query("2026-09-07", description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
):
    """
    24-hour occupancy profile for Part 8 Corridor Capacity:
    - Passenger trains
    - Goods trains
    - 10-minute protected safety buffers
    - Candidate maintenance gaps
    - Optimizer scheduled blocks
    """
    section = db.query(RailwaySection).filter(RailwaySection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Railway section not found")

    try:
        base_d = datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        base_d = datetime(2026, 9, 7)

    day_start = datetime(base_d.year, base_d.month, base_d.day, 0, 0, 0)
    day_end = day_start + timedelta(days=1)

    # 1. Train movements
    trains = (
        db.query(TrainMovement)
        .filter(
            TrainMovement.section_id == section_id,
            TrainMovement.exit_time >= day_start,
            TrainMovement.entry_time <= day_end,
        )
        .order_by(TrainMovement.entry_time.asc())
        .all()
    )

    trains_data = []
    for t in trains:
        t_entry = max(t.entry_time, day_start)
        t_exit = min(t.exit_time, day_end)
        trains_data.append({
            "id": str(t.id),
            "train_type": t.train_type,
            "entry_time": t.entry_time.isoformat(),
            "exit_time": t.exit_time.isoformat(),
            "visible_start": t_entry.isoformat(),
            "visible_end": t_exit.isoformat(),
            "transit_min": int((t.exit_time - t.entry_time).total_seconds() // 60),
            "priority": t.priority,
            "forecast_confidence": t.forecast_confidence,
            "buffer_before": (t.entry_time - timedelta(minutes=10)).isoformat(),
            "buffer_after": (t.exit_time + timedelta(minutes=10)).isoformat(),
        })

    # 2. Candidate windows
    candidate_windows = (
        db.query(BlockWindow)
        .filter(
            BlockWindow.section_id == section_id,
            BlockWindow.window_start >= day_start,
            BlockWindow.window_end <= day_end,
            BlockWindow.is_available == True,
        )
        .order_by(BlockWindow.window_start.asc())
        .all()
    )
    if not candidate_windows:
        candidate_windows = populate_block_windows(db, [section_id], day_start, day_end)

    windows_data = []
    for w in candidate_windows:
        dur = int((w.window_end - w.window_start).total_seconds() // 60)
        breakdown = get_window_risk_breakdown(db, section_id, w.window_start, w.window_end)
        windows_data.append({
            "id": str(w.id),
            "window_start": w.window_start.isoformat(),
            "window_end": w.window_end.isoformat(),
            "duration_min": dur,
            "risk_score": w.risk_score,
            "risk_breakdown": breakdown,
        })

    # 3. Scheduled blocks in latest SANGAM run
    latest_sangam = (
        db.query(OptimizationRun)
        .filter(OptimizationRun.run_type == "sangam_optimized", OptimizationRun.status == "completed")
        .order_by(OptimizationRun.started_at.desc())
        .first()
    )

    blocks_data = []
    if latest_sangam:
        sched_blocks = (
            db.query(GeneratedBlock)
            .filter(
                GeneratedBlock.run_id == latest_sangam.id,
                GeneratedBlock.section_id == section_id,
                GeneratedBlock.block_end >= day_start,
                GeneratedBlock.block_start <= day_end,
            )
            .order_by(GeneratedBlock.block_start.asc())
            .all()
        )
        for b in sched_blocks:
            btasks = (
                db.query(MaintenanceTask)
                .join(GeneratedBlockTask, GeneratedBlockTask.task_id == MaintenanceTask.id)
                .filter(GeneratedBlockTask.block_id == b.id)
                .all()
            )
            blocks_data.append({
                "id": str(b.id),
                "block_start": b.block_start.isoformat(),
                "block_end": b.block_end.isoformat(),
                "duration_min": int((b.block_end - b.block_start).total_seconds() // 60),
                "is_joint_block": b.is_joint_block,
                "approval_status": getattr(b, "approval_status", "recommended"),
                "tasks": [
                    {
                        "task_code": t.task_code,
                        "dept": t.department.code if t.department else "—",
                        "type": t.maintenance_type,
                        "severity": t.severity,
                    }
                    for t in btasks
                ],
            })

    total_avail_min = sum(w["duration_min"] for w in windows_data)
    return {
        "section_id": section_id,
        "section_name": section.name,
        "date": target_date,
        "day_start": day_start.isoformat(),
        "day_end": day_end.isoformat(),
        "total_available_minutes": total_avail_min,
        "passenger_train_count": sum(1 for t in trains_data if t["train_type"] == "Passenger"),
        "goods_train_count": sum(1 for t in trains_data if t["train_type"] == "Goods"),
        "trains": trains_data,
        "candidate_windows": windows_data,
        "scheduled_blocks": blocks_data,
    }


# ── Train & Window Management Endpoints ──────────────────────────────────────

from pydantic import BaseModel
import uuid

class TrainMovementCreate(BaseModel):
    train_number: str
    train_type: str = "Passenger"  # Passenger | Goods
    section_id: str
    entry_time: datetime
    exit_time: datetime
    priority: int = 1
    forecast_confidence: Optional[float] = 1.0
    source: str = "Manual"
    notes: Optional[str] = None


class TrainMovementUpdate(BaseModel):
    train_number: Optional[str] = None
    train_type: Optional[str] = None
    section_id: Optional[str] = None
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    priority: Optional[int] = None
    forecast_confidence: Optional[float] = None
    notes: Optional[str] = None


class WindowUnavailabilityToggle(BaseModel):
    is_available: bool
    reason: Optional[str] = None  # Operational restriction, VIP train, Weather, etc.


@router.get("/trains/all")
def list_all_trains(
    section_id: Optional[str] = Query(None, description="Optional filter by section"),
    train_type: Optional[str] = Query(None, description="Passenger | Goods"),
    db: Session = Depends(get_db),
):
    """
    List all train movements across corridor sections for the timetable management table.
    """
    query = db.query(TrainMovement)
    if section_id:
        query = query.filter(TrainMovement.section_id == section_id)
    if train_type:
        query = query.filter(TrainMovement.train_type == train_type)

    trains = query.order_by(TrainMovement.entry_time.asc()).all()
    return [
        {
            "id": str(t.id),
            "train_number": getattr(t, "train_number", None) or ("12925" if t.train_type == "Passenger" else "G-4021"),
            "section_id": str(t.section_id),
            "section_name": t.section.name if t.section else "—",
            "train_type": t.train_type,
            "entry_time": t.entry_time.isoformat(),
            "exit_time": t.exit_time.isoformat(),
            "transit_min": int((t.exit_time - t.entry_time).total_seconds() // 60),
            "priority": t.priority,
            "forecast_confidence": t.forecast_confidence,
            "source": getattr(t, "source", "Synthetic Demo"),
            "notes": getattr(t, "notes", None),
        }
        for t in trains
    ]


@router.post("/trains")
def create_train_movement(req: TrainMovementCreate, db: Session = Depends(get_db)):
    """
    Add a new train movement to the timetable.
    """
    sec = db.query(RailwaySection).filter((RailwaySection.id == req.section_id) | (RailwaySection.name == req.section_id)).first()
    if not sec:
        raise HTTPException(status_code=400, detail="Railway section not found")

    if req.exit_time <= req.entry_time:
        raise HTTPException(status_code=400, detail="Exit time must be after entry time")

    tm = TrainMovement(
        id=uuid.uuid4(),
        section_id=sec.id,
        train_type=req.train_type,
        train_number=req.train_number,
        entry_time=req.entry_time,
        exit_time=req.exit_time,
        priority=req.priority,
        forecast_confidence=req.forecast_confidence,
        source=req.source,
        notes=req.notes,
    )
    db.add(tm)
    db.commit()
    db.refresh(tm)

    # Recompute candidate corridor windows for this section
    try:
        w_start = tm.entry_time.replace(hour=0, minute=0, second=0)
        w_end = w_start + timedelta(days=7)
        populate_block_windows(db, [str(sec.id)], w_start, w_end)
    except Exception as e:
        print(f"Window recompute notice: {e}")

    return {
        "status": "success",
        "id": str(tm.id),
        "train_number": tm.train_number,
        "message": f"Train movement {tm.train_number} added and corridor windows updated.",
    }


@router.put("/trains/{train_id}")
def update_train_movement(train_id: str, req: TrainMovementUpdate, db: Session = Depends(get_db)):
    """
    Edit a train movement.
    """
    tm = db.query(TrainMovement).filter(TrainMovement.id == train_id).first()
    if not tm:
        raise HTTPException(status_code=404, detail="Train movement not found")

    if req.train_number is not None:
        tm.train_number = req.train_number
    if req.train_type is not None:
        tm.train_type = req.train_type
    if req.section_id is not None:
        sec = db.query(RailwaySection).filter((RailwaySection.id == req.section_id) | (RailwaySection.name == req.section_id)).first()
        if sec:
            tm.section_id = sec.id
    if req.entry_time is not None:
        tm.entry_time = req.entry_time
    if req.exit_time is not None:
        tm.exit_time = req.exit_time
    if req.priority is not None:
        tm.priority = req.priority
    if req.forecast_confidence is not None:
        tm.forecast_confidence = req.forecast_confidence
    if req.notes is not None:
        tm.notes = req.notes

    db.commit()
    db.refresh(tm)

    try:
        w_start = tm.entry_time.replace(hour=0, minute=0, second=0)
        w_end = w_start + timedelta(days=7)
        populate_block_windows(db, [str(tm.section_id)], w_start, w_end)
    except Exception as e:
        print(f"Window recompute notice: {e}")

    return {"status": "success", "id": str(tm.id), "train_number": tm.train_number}


@router.delete("/trains/{train_id}")
def delete_train_movement(train_id: str, db: Session = Depends(get_db)):
    """
    Delete a train movement from timetable.
    """
    tm = db.query(TrainMovement).filter(TrainMovement.id == train_id).first()
    if not tm:
        raise HTTPException(status_code=404, detail="Train movement not found")

    sec_id = str(tm.section_id)
    w_start = tm.entry_time.replace(hour=0, minute=0, second=0)
    w_end = w_start + timedelta(days=7)

    db.delete(tm)
    db.commit()

    try:
        populate_block_windows(db, [sec_id], w_start, w_end)
    except Exception as e:
        print(f"Window recompute notice: {e}")

    return {"status": "success", "message": f"Train movement {train_id} deleted"}


@router.post("/recompute-windows")
def trigger_recompute_windows(
    section_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Manually trigger candidate window extraction across all or specific sections.
    """
    if not start_date:
        start_date = datetime.utcnow().replace(hour=0, minute=0, second=0)
    if not end_date:
        end_date = start_date + timedelta(days=7)

    if section_id:
        sections = db.query(RailwaySection).filter((RailwaySection.id == section_id) | (RailwaySection.name == section_id)).all()
    else:
        sections = db.query(RailwaySection).all()

    sec_ids = [str(s.id) for s in sections]
    if not sec_ids:
        return {"status": "success", "windows_count": 0, "message": "No sections to compute windows for."}

    windows = populate_block_windows(db, sec_ids, start_date, end_date)
    return {
        "status": "success",
        "sections_evaluated": len(sec_ids),
        "windows_count": len(windows),
        "message": f"Generated {len(windows)} candidate maintenance windows.",
    }


@router.get("/windows/all")
def list_all_windows(
    section_id: Optional[str] = Query(None, description="Optional section filter"),
    db: Session = Depends(get_db),
):
    """
    List all available and restricted maintenance candidate windows across the corridor.
    """
    query = db.query(BlockWindow)
    if section_id:
        query = query.filter(BlockWindow.section_id == section_id)

    windows = query.order_by(BlockWindow.window_start.asc()).all()
    results = []
    for w in windows:
        dur = int((w.window_end - w.window_start).total_seconds() // 60)
        results.append({
            "id": str(w.id),
            "section_id": str(w.section_id),
            "section_name": w.section.name if w.section else "—",
            "window_start": w.window_start.isoformat(),
            "window_end": w.window_end.isoformat(),
            "duration_min": dur,
            "block_type": w.block_type,
            "is_available": w.is_available,
            "unavailability_reason": getattr(w, "unavailability_reason", None),
            "source": getattr(w, "source", "Computed Gap"),
            "risk_score": w.risk_score,
            "status": "Available" if w.is_available else "Unavailable",
        })
    return results


@router.post("/windows/{window_id}/unavailability")
def toggle_window_availability(window_id: str, req: WindowUnavailabilityToggle, db: Session = Depends(get_db)):
    """
    Controller action to mark a corridor maintenance window unavailable (with operational reason)
    or restore availability.
    Directly respected by the CP-SAT optimizer and heuristic baselines!
    """
    w = db.query(BlockWindow).filter(BlockWindow.id == window_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Block window not found")

    w.is_available = req.is_available
    w.unavailability_reason = req.reason if not req.is_available else None

    db.commit()
    db.refresh(w)

    return {
        "status": "success",
        "id": str(w.id),
        "is_available": w.is_available,
        "unavailability_reason": w.unavailability_reason,
        "message": "Window availability updated. Optimizer will respect this setting.",
    }

