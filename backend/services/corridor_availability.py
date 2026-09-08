from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models.train import TrainMovement
from backend.models.block_window import BlockWindow


def compute_candidate_windows(
    db: Optional[Session],
    section_id: str,
    start_date: datetime,
    end_date: datetime,
    min_buffer_minutes: int = 10,
    train_movements: Optional[List[Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Compute gaps between train movements in a given section within the date range.
    Subtracts min_buffer_minutes from both sides of every gap as safety buffer.
    Discards gaps shorter than 20 minutes.
    """
    if train_movements is None and db is not None:
        trains = (
            db.query(TrainMovement)
            .filter(
                TrainMovement.section_id == section_id,
                TrainMovement.entry_time < end_date,
                TrainMovement.exit_time > start_date,
            )
            .order_by(TrainMovement.entry_time.asc())
            .all()
        )
    else:
        trains = sorted(train_movements or [], key=lambda t: t.entry_time if hasattr(t, 'entry_time') else t['entry_time'])

    candidate_windows: List[Dict[str, Any]] = []
    buffer_delta = timedelta(minutes=min_buffer_minutes)
    curr_cursor = start_date

    for train in trains:
        t_entry = train.entry_time if hasattr(train, 'entry_time') else train['entry_time']
        t_exit = train.exit_time if hasattr(train, 'exit_time') else train['exit_time']

        # If there is a gap between current cursor and train entry
        if t_entry > curr_cursor:
            gap_start = curr_cursor
            gap_end = min(t_entry, end_date)

            window_start = gap_start + buffer_delta
            window_end = gap_end - buffer_delta

            duration_sec = (window_end - window_start).total_seconds()
            if duration_sec >= 20 * 60:
                duration_min = int(duration_sec // 60)
                candidate_windows.append({
                    "section_id": section_id,
                    "window_start": window_start,
                    "window_end": window_end,
                    "duration_min": duration_min,
                })

        # Advance cursor past the train
        if t_exit > curr_cursor:
            curr_cursor = t_exit

    # Final gap between last train exit and end_date
    if curr_cursor < end_date:
        gap_start = curr_cursor
        gap_end = end_date

        window_start = gap_start + buffer_delta
        window_end = gap_end - buffer_delta

        duration_sec = (window_end - window_start).total_seconds()
        if duration_sec >= 20 * 60:
            duration_min = int(duration_sec // 60)
            candidate_windows.append({
                "section_id": section_id,
                "window_start": window_start,
                "window_end": window_end,
                "duration_min": duration_min,
            })

    return candidate_windows


def compute_window_risk_score(
    db: Optional[Session],
    window: Dict[str, Any],
    section_id: str,
    train_movements: Optional[List[Any]] = None,
) -> float:
    """
    Compute risk score for a candidate block window:
    WindowRisk = TrainDensity + FreightUncertainty + PeakHourPenalty + DelayPropagationRisk
    Lower risk score = safer/better window.
    """
    w_start = window["window_start"]
    w_end = window["window_end"]

    two_hours_before = w_start - timedelta(hours=2)
    two_hours_after = w_end + timedelta(hours=2)

    if train_movements is None and db is not None:
        nearby_trains = (
            db.query(TrainMovement)
            .filter(
                TrainMovement.section_id == section_id,
                TrainMovement.exit_time >= two_hours_before,
                TrainMovement.entry_time <= two_hours_after,
            )
            .all()
        )
    else:
        nearby_trains = [
            t for t in (train_movements or [])
            if (t.exit_time if hasattr(t, 'exit_time') else t['exit_time']) >= two_hours_before
            and (t.entry_time if hasattr(t, 'entry_time') else t['entry_time']) <= two_hours_after
        ]

    # 1. TrainDensity: normalized 0-1 (e.g. 6+ nearby trains is max density 1.0)
    train_count = len(nearby_trains)
    train_density = min(1.0, train_count / 6.0)

    # 2. FreightUncertainty: average (1 - forecast_confidence) of nearby goods trains
    goods_trains = [
        t for t in nearby_trains
        if (t.train_type if hasattr(t, 'train_type') else t['train_type']) == "Goods"
    ]
    if goods_trains:
        uncertainties = []
        for gt in goods_trains:
            conf = gt.forecast_confidence if hasattr(gt, 'forecast_confidence') else gt.get('forecast_confidence', 0.8)
            conf = conf if conf is not None else 0.8
            uncertainties.append(1.0 - conf)
        freight_uncertainty = sum(uncertainties) / len(uncertainties)
    else:
        freight_uncertainty = 0.0

    # 3. PeakHourPenalty: +0.3 if window overlaps 06:00-10:00 or 17:00-21:00
    peak_hour_penalty = 0.0
    check_cursor = w_start
    while check_cursor < w_end:
        hour = check_cursor.hour
        if (6 <= hour < 10) or (17 <= hour < 21):
            peak_hour_penalty = 0.3
            break
        check_cursor += timedelta(minutes=15)
    # Check end boundary as well
    if peak_hour_penalty == 0.0:
        hour_end = w_end.hour
        if (6 <= hour_end < 10) or (17 <= hour_end < 21):
            peak_hour_penalty = 0.3

    # 4. DelayPropagationRisk: +0.2 if window is directly adjacent (within 15 min) to a passenger train
    delay_propagation_risk = 0.0
    fifteen_min = timedelta(minutes=15)
    passenger_trains = [
        t for t in nearby_trains
        if (t.train_type if hasattr(t, 'train_type') else t['train_type']) == "Passenger"
    ]
    for pt in passenger_trains:
        t_entry = pt.entry_time if hasattr(pt, 'entry_time') else pt['entry_time']
        t_exit = pt.exit_time if hasattr(pt, 'exit_time') else pt['exit_time']
        if abs((t_entry - w_end).total_seconds()) <= 15 * 60 or abs((w_start - t_exit).total_seconds()) <= 15 * 60:
            delay_propagation_risk = 0.2
            break

    total_risk = train_density + freight_uncertainty + peak_hour_penalty + delay_propagation_risk
    return round(float(total_risk), 3)


def populate_block_windows(
    db: Session,
    section_ids: List[str],
    start_date: datetime,
    end_date: datetime,
) -> List[BlockWindow]:
    """
    Populate candidate block windows for the given sections and date range into block_windows table.
    """
    # Remove existing candidate windows in this range for these sections to maintain clean state
    db.query(BlockWindow).filter(
        BlockWindow.section_id.in_(section_ids),
        BlockWindow.window_start >= start_date,
        BlockWindow.window_end <= end_date,
    ).delete(synchronize_session=False)

    new_windows: List[BlockWindow] = []

    for sec_id in section_ids:
        raw_windows = compute_candidate_windows(db, sec_id, start_date, end_date)
        for rw in raw_windows:
            risk = compute_window_risk_score(db, rw, sec_id)
            bw = BlockWindow(
                section_id=sec_id,
                window_start=rw["window_start"],
                window_end=rw["window_end"],
                block_type="Maintenance",
                is_available=True,
                risk_score=risk,
            )
            db.add(bw)
            new_windows.append(bw)

    db.commit()
    for w in new_windows:
        db.refresh(w)
    return new_windows
