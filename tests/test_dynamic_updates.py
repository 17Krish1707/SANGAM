import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models.section import RailwaySection
from backend.models.train import TrainMovement
from backend.models.department import Department
from backend.models.task import MaintenanceTask
from backend.models.optimization import GeneratedBlock
from backend.services.train_impact import compute_block_train_impact

client = TestClient(app)


def test_train_delay_dynamic_impact_update():
    """
    Test that when an operational train is delayed into a block window,
    the train impact analysis dynamically detects the new direct overlap conflict.
    """
    db = SessionLocal()
    sec_id = "sec-dynamic-train"

    # Setup Section
    sec = db.query(RailwaySection).filter(RailwaySection.id == sec_id).first()
    if not sec:
        sec = RailwaySection(
            id=sec_id,
            name="DYNAMIC-SEC",
            from_station="STN-D1",
            to_station="STN-D2",
            line_type="double",
            length_km=25.0,
        )
        db.add(sec)
        db.commit()

    # Clean up prior test data
    db.query(TrainMovement).filter(TrainMovement.id == "train-dynamic-1").delete()
    db.commit()

    # Train initially scheduled well outside block (Block: 10:00 - 11:30)
    # Train initially: 08:30 - 09:00 (1 hour before block)
    train = TrainMovement(
        id="train-dynamic-1",
        train_number="12951",
        section_id=sec_id,
        entry_time=datetime(2026, 9, 20, 8, 30, 0),
        exit_time=datetime(2026, 9, 20, 9, 0, 0),
        train_type="Passenger",
        priority=1,
        delay_minutes=0,
    )
    db.add(train)
    db.commit()

    block = GeneratedBlock(
        id="block-dynamic-1",
        run_id="run-dynamic-1",
        section_id=sec_id,
        block_start=datetime(2026, 9, 20, 10, 0, 0),
        block_end=datetime(2026, 9, 20, 11, 30, 0),
        is_joint_block=False,
    )

    try:
        # Initially: 0 affected trains
        impact_before = compute_block_train_impact(db, block)
        assert impact_before["directly_affected_count"] == 0

        # Simulate train delay of 90 minutes! (Now runs 10:00 - 10:30, right into the block!)
        train_in_db = db.query(TrainMovement).filter(TrainMovement.id == "train-dynamic-1").first()
        train_in_db.entry_time = datetime(2026, 9, 20, 10, 0, 0)
        train_in_db.exit_time = datetime(2026, 9, 20, 10, 30, 0)
        train_in_db.delay_minutes = 90
        db.commit()

        # After delay: now directly affected!
        impact_after = compute_block_train_impact(db, block)
        assert impact_after["directly_affected_count"] == 1
        assert impact_after["directly_affected_trains"][0]["train_number"] == "12951"
        assert impact_after["impact_tier"] in ("amber", "red")
    finally:
        db.query(TrainMovement).filter(TrainMovement.id == "train-dynamic-1").delete()
        db.query(RailwaySection).filter(RailwaySection.id == sec_id).delete()
        db.commit()
        db.close()


def test_task_priority_dynamic_update():
    """
    Test updating task due date or criticality dynamically updates priority score
    via the tasks API.
    """
    db = SessionLocal()
    # Ensure department and section exist
    dept = db.query(Department).first()
    sec = db.query(RailwaySection).first()
    dept_code = dept.code if dept else "ENG"
    sec_id = str(sec.id) if sec else "sec-dynamic-train"
    db.close()

    # 1. Create a task via API
    task_payload = {
        "department_code": dept_code,
        "section_id": sec_id,
        "maintenance_type": "Track Screening",
        "severity": "Low",
        "due_date": (datetime.now() + timedelta(days=20)).isoformat(),
        "estimated_duration_min": 60,
        "minimum_contiguous_block_min": 45,
    }
    create_res = client.post("/api/tasks", json=task_payload)
    assert create_res.status_code in (200, 201)
    created = create_res.json()
    task_id = created["id"]
    initial_score = created["priority_score"]

    try:
        # 2. Update to Critical severity and overdue date
        update_payload = {
            "severity": "Critical",
            "due_date": (datetime.now() - timedelta(days=2)).isoformat(),
        }
        update_res = client.patch(f"/api/tasks/{task_id}", json=update_payload)
        assert update_res.status_code == 200
        updated = update_res.json()

        # Priority score must significantly increase
        assert updated["priority_score"] > initial_score
        assert updated["priority_score"] >= 65.0

        # 3. Verify priority breakdown endpoint gives plain English explanation and components
        breakdown_res = client.get(f"/api/tasks/{task_id}/priority-breakdown")
        assert breakdown_res.status_code == 200
        breakdown = breakdown_res.json()
        assert "components" in breakdown
        assert "explanation_text" in breakdown
        assert len(breakdown["explanation_text"]) > 10
    finally:
        client.delete(f"/api/tasks/{task_id}")
