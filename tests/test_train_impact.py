import pytest
from datetime import datetime, timedelta
from backend.database import SessionLocal
from backend.models.section import RailwaySection
from backend.models.train import TrainMovement
from backend.models.optimization import GeneratedBlock
from backend.services.train_impact import compute_block_train_impact, compute_plan_train_impact


def test_train_impact_calculations():
    db = SessionLocal()
    sec_id = "sec-impact-test"

    # Setup section
    sec = db.query(RailwaySection).filter(RailwaySection.id == sec_id).first()
    if not sec:
        sec = RailwaySection(
            id=sec_id,
            name="NDLS-GZB-IMPACT",
            from_station="NDLS",
            to_station="GZB",
            line_type="double",
            length_km=40.0,
        )
        db.add(sec)
        db.commit()

    # Train 1: Direct Overlap (10:15 to 10:45) during Block (10:00 to 11:30)
    # Train 2: Nearby train within margin (11:45 to 12:10) -> 5 minutes after closure_end (11:40 with 10m buffer)
    # Train 3: Distant train outside margin (14:00 to 14:30) -> unaffected
    t1 = TrainMovement(
        id="train-impact-1",
        train_number="12001",
        section_id=sec_id,
        entry_time=datetime(2026, 9, 15, 10, 15, 0),
        exit_time=datetime(2026, 9, 15, 10, 45, 0),
        train_type="Passenger",
        priority=1,
    )
    t2 = TrainMovement(
        id="train-impact-2",
        train_number="12002",
        section_id=sec_id,
        entry_time=datetime(2026, 9, 15, 11, 45, 0),
        exit_time=datetime(2026, 9, 15, 12, 10, 0),
        train_type="Passenger",
        priority=2,
    )
    t3 = TrainMovement(
        id="train-impact-3",
        train_number="BOXN-1",
        section_id=sec_id,
        entry_time=datetime(2026, 9, 15, 14, 0, 0),
        exit_time=datetime(2026, 9, 15, 14, 30, 0),
        train_type="Goods",
        priority=3,
    )

    db.merge(t1)
    db.merge(t2)
    db.merge(t3)
    db.commit()

    # Block from 10:00 to 11:30
    block = GeneratedBlock(
        id="block-impact-test",
        run_id="run-impact-test",
        section_id=sec_id,
        block_start=datetime(2026, 9, 15, 10, 0, 0),
        block_end=datetime(2026, 9, 15, 11, 30, 0),
        is_joint_block=False,
    )

    impact = compute_block_train_impact(db, block, safety_buffer_minutes=10, nearby_threshold_minutes=30)

    # 1. Directly affected: Train 1 only (overlapping 10:15 - 10:45)
    assert impact["directly_affected_count"] == 1
    assert impact["directly_affected_trains"][0]["train_number"] == "12001"
    assert "Direct" in impact["directly_affected_trains"][0]["conflict_type"]

    # 2. Nearby trains: Train 2 only (5 min after closure_end <= 30 min margin)
    assert impact["nearby_count"] == 1
    assert impact["nearby_trains"][0]["train_number"] == "12002"
    assert impact["nearby_trains"][0]["margin_min"] == 5

    # 3. Min clearance margin should be 5 min
    assert impact["min_train_margin_min"] == 5

    # 4. Expected delay should be computed for direct overlap train (> 0)
    assert impact["expected_delay_min"] > 0

    # 5. Plan-level aggregation: no duplicate counting
    plan_impact = compute_plan_train_impact(db, [block], safety_buffer_minutes=10, nearby_threshold_minutes=30)
    assert plan_impact["directly_affected_count"] == 1
    assert plan_impact["nearby_count"] == 1
    assert plan_impact["impact_tier"] in ("amber", "red")

    # Cleanup test records
    db.query(TrainMovement).filter(TrainMovement.id.in_(["train-impact-1", "train-impact-2", "train-impact-3"])).delete(synchronize_session=False)
    db.commit()
    db.close()
