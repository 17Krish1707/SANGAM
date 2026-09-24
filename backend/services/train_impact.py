from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models.train import TrainMovement
from backend.models.optimization import GeneratedBlock


def compute_plan_train_impact(
    db: Session,
    blocks: List[GeneratedBlock],
    safety_buffer_minutes: int = 10,
    nearby_threshold_minutes: int = 30,
) -> Dict[str, Any]:
    """
    TRAIN IMPACT ENGINE:
    Analyzes exact railway traffic consequences for every proposed maintenance plan.
    Calculates:
    - directly_affected_trains: distinct train movements whose path conflicts with block + buffer
    - nearby_trains: trains within tight operational margin before/after block
    - min_train_margin_min: minimum clearance headway to nearest train
    - expected_delay_min: operational delay required (0 for strict feasible plans)
    """
    if not blocks:
        return {
            "directly_affected_count": 0,
            "directly_affected_trains": [],
            "nearby_count": 0,
            "nearby_trains": [],
            "min_train_margin_min": 999,
            "expected_delay_min": 0,
            "impact_tier": "zero",
            "impact_badge_text": "✓ 0 trains require timetable change",
            "provenance_label": "Representative prototype operational data",
        }

    buffer_delta = timedelta(minutes=safety_buffer_minutes)
    nearby_delta = timedelta(minutes=nearby_threshold_minutes)

    # Collect section IDs
    sec_ids = list({str(b.section_id) for b in blocks})

    # Fetch all train movements across relevant sections
    trains = db.query(TrainMovement).filter(TrainMovement.section_id.in_(sec_ids)).all()

    directly_affected_map: Dict[str, Dict[str, Any]] = {}
    nearby_map: Dict[str, Dict[str, Any]] = {}
    overall_min_margin = 999999
    total_expected_delay = 0

    for b in blocks:
        b_start = b.block_start
        b_end = b.block_end
        sec_id = str(b.section_id)

        # Active closure envelope with safety buffer
        closure_start = b_start - buffer_delta
        closure_end = b_end + buffer_delta

        sec_trains = [t for t in trains if str(t.section_id) == sec_id]

        for t in sec_trains:
            t_id = str(t.id)
            t_num = t.train_number or (f"P-{t_id[:4]}" if t.train_type == "Passenger" else f"G-{t_id[:4]}")
            t_entry = t.entry_time
            t_exit = t.exit_time

            # 1. Check direct path overlap with active block envelope
            is_direct_overlap = (t_entry < closure_end) and (t_exit > closure_start)

            if is_direct_overlap:
                # Direct conflict
                # Calculate conflict duration
                overlap_start = max(t_entry, closure_start)
                overlap_end = min(t_exit, closure_end)
                conflict_dur = max(1, int((overlap_end - overlap_start).total_seconds() // 60))
                
                # Delay needed to reschedule past block
                delay_needed = max(0, int((closure_end - t_entry).total_seconds() // 60))

                if t_id not in directly_affected_map:
                    directly_affected_map[t_id] = {
                        "train_id": t_id,
                        "train_number": t_num,
                        "train_type": t.train_type,
                        "section_id": sec_id,
                        "conflict_type": "Direct Protected Path Overlap" if (t_entry < b_end and t_exit > b_start) else "Safety Buffer Encroachment",
                        "scheduled_time": f"{t_entry.strftime('%H:%M')}–{t_exit.strftime('%H:%M')}",
                        "conflict_minutes": conflict_dur,
                        "required_holding_delay_min": delay_needed,
                        "block_id": str(b.id),
                    }
                    total_expected_delay += delay_needed

            else:
                # 2. Check margin to block
                # Preceding train: exits before block starts
                if t_exit <= closure_start:
                    margin = int((closure_start - t_exit).total_seconds() // 60)
                    pos = "Preceding"
                # Succeeding train: enters after block ends
                elif t_entry >= closure_end:
                    margin = int((t_entry - closure_end).total_seconds() // 60)
                    pos = "Succeeding"
                else:
                    margin = 0
                    pos = "Adjacent"

                if margin < overall_min_margin:
                    overall_min_margin = margin

                if margin <= nearby_threshold_minutes:
                    if t_id not in directly_affected_map and t_id not in nearby_map:
                        nearby_map[t_id] = {
                            "train_id": t_id,
                            "train_number": t_num,
                            "train_type": t.train_type,
                            "section_id": sec_id,
                            "scheduled_time": f"{t_entry.strftime('%H:%M')}–{t_exit.strftime('%H:%M')}",
                            "margin_min": margin,
                            "relative_position": pos,
                            "block_id": str(b.id),
                        }

    # Ensure no train is in both directly affected and nearby
    for aff_id in directly_affected_map:
        nearby_map.pop(aff_id, None)

    direct_count = len(directly_affected_map)
    nearby_count = len(nearby_map)
    min_margin = overall_min_margin if overall_min_margin != 999999 else 60

    if direct_count == 0:
        tier = "zero"
        badge = "✓ 0 trains require timetable change"
    elif direct_count <= 2:
        tier = "amber"
        badge = f"⚠ {direct_count} train(s) affected (Minor holding)"
    else:
        tier = "red"
        badge = f"⛔ {direct_count} trains affected (Timetable adjustment needed)"

    return {
        "directly_affected_count": direct_count,
        "directly_affected_trains": list(directly_affected_map.values()),
        "nearby_count": nearby_count,
        "nearby_trains": list(nearby_map.values()),
        "min_train_margin_min": min_margin,
        "expected_delay_min": total_expected_delay,
        "impact_tier": tier,
        "impact_badge_text": badge,
        "provenance_label": "Representative prototype operational data",
    }


def compute_block_train_impact(
    db: Session,
    block: GeneratedBlock,
    safety_buffer_minutes: int = 10,
    nearby_threshold_minutes: int = 30,
) -> Dict[str, Any]:
    """Convenience wrapper to compute train impact for a single block."""
    return compute_plan_train_impact(
        db,
        [block],
        safety_buffer_minutes=safety_buffer_minutes,
        nearby_threshold_minutes=nearby_threshold_minutes,
    )

