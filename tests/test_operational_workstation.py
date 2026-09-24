import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models.section import RailwaySection
from backend.models.department import Department
from backend.models.task import MaintenanceTask
from backend.models.resource import Resource
from backend.models.train import TrainMovement
from backend.models.block_window import BlockWindow
from backend.models.optimization import OptimizationRun, GeneratedBlock

client = TestClient(app)


def test_task_full_crud_and_lifecycle():
    # 1. Get a section and department
    db = SessionLocal()
    section = db.query(RailwaySection).first()
    dept = db.query(Department).filter(Department.code == "ENG").first()
    assert section is not None
    assert dept is not None
    sec_id = str(section.id)
    db.close()

    # 2. Add maintenance work (POST)
    now = datetime.utcnow()
    create_payload = {
        "department_code": "ENG",
        "section_id": sec_id,
        "asset_name": "Turnout No. 12B",
        "maintenance_type": "Deep Track Screening & Tamping",
        "description": "Severe ballast fouling observed near crossover",
        "severity": "High",
        "detected_at": now.isoformat(),
        "due_date": (now + timedelta(days=4)).isoformat(),
        "estimated_duration_min": 90,
        "minimum_contiguous_block_min": 60,
        "requires_power_isolation": False,
        "can_run_parallel": True,
        "operational_notes": "Urgent work prior to monsoon",
        "status": "Pending",
        "source": "Manual",
    }
    create_res = client.post("/api/tasks", json=create_payload)
    assert create_res.status_code == 200, create_res.text
    created = create_res.json()
    assert created["status"] == "success"
    task_id = created["id"]
    task_code = created["task_code"]
    assert created["priority_score"] > 0

    # 3. Edit task (PUT)
    update_res = client.put(f"/api/tasks/{task_id}", json={
        "severity": "Critical",
        "estimated_duration_min": 120,
        "operational_notes": "Escalated to Critical by P-Way Inspector",
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["status"] == "success"

    # 4. Duplicate task (POST duplicate)
    dup_res = client.post(f"/api/tasks/{task_id}/duplicate")
    assert dup_res.status_code == 200
    dup_data = dup_res.json()
    dup_id = dup_data["new_task_id"]
    assert dup_id != task_id

    # 5. Defer task (POST defer)
    new_target = now + timedelta(days=10)
    defer_res = client.post(f"/api/tasks/{task_id}/defer", json={
        "reason": "Track machine delayed at adjacent division",
        "new_target_date": new_target.isoformat(),
    })
    assert defer_res.status_code == 200
    assert defer_res.json()["status_now"] == "Deferred"

    # 6. Complete task (POST complete)
    complete_res = client.post(f"/api/tasks/{task_id}/complete", json={
        "completion_time": now.isoformat(),
        "note": "Work successfully certified",
    })
    assert complete_res.status_code == 200
    assert complete_res.json()["status_now"] == "Completed"

    # 7. Delete duplicated task and completed task (DELETE)
    del_res = client.delete(f"/api/tasks/{dup_id}")
    assert del_res.status_code == 200
    del_orig = client.delete(f"/api/tasks/{task_id}")
    assert del_orig.status_code == 200


def test_resource_crud_and_availability():
    # 1. Create Resource
    res = client.post("/api/resources", json={
        "name": "Tower Wagon TW-NCR-09",
        "department_code": "TRD",
        "resource_type": "Tower Wagon",
        "is_available": True,
    })
    assert res.status_code == 200
    r_id = res.json()["id"]

    # 2. Toggle unavailable
    tog_res = client.post(f"/api/resources/{r_id}/toggle-availability", json={
        "is_available": False,
        "reason": "Engine Overhaul in Workshop",
        "unavailable_from": "2026-09-08T08:00:00Z",
        "unavailable_until": "2026-09-10T18:00:00Z",
    })
    assert tog_res.status_code == 200
    assert tog_res.json()["is_available"] is False
    assert tog_res.json()["unavailability_reason"] == "Engine Overhaul in Workshop"

    # 3. Restore availability
    restore_res = client.post(f"/api/resources/{r_id}/toggle-availability", json={
        "is_available": True,
    })
    assert restore_res.status_code == 200
    assert restore_res.json()["is_available"] is True

    # 4. Delete resource
    del_res = client.delete(f"/api/resources/{r_id}")
    assert del_res.status_code == 200


def test_train_and_window_management():
    db = SessionLocal()
    section = db.query(RailwaySection).first()
    sec_id = str(section.id)
    db.close()

    # 1. Add train movement
    entry_dt = datetime(2026, 9, 8, 14, 0, 0)
    exit_dt = datetime(2026, 9, 8, 14, 45, 0)
    train_res = client.post("/api/corridor/trains", json={
        "train_number": "12926",
        "train_type": "Passenger",
        "section_id": sec_id,
        "entry_time": entry_dt.isoformat(),
        "exit_time": exit_dt.isoformat(),
        "priority": 1,
        "notes": "Paschim Express",
    })
    assert train_res.status_code == 200
    train_id = train_res.json()["id"]

    # 2. List all trains
    list_res = client.get("/api/corridor/trains/all")
    assert list_res.status_code == 200
    assert any(t["id"] == train_id for t in list_res.json())

    # 3. Clean up train
    client.delete(f"/api/corridor/trains/{train_id}")

    # 4. Windows list & unavailability toggle
    win_list = client.get("/api/corridor/windows/all")
    assert win_list.status_code == 200
    windows = win_list.json()
    if windows:
        w_id = windows[0]["id"]
        toggle_res = client.post(f"/api/corridor/windows/{w_id}/unavailability", json={
            "is_available": False,
            "reason": "VIP Train Movement (Inspection Special)",
        })
        assert toggle_res.status_code == 200
        assert toggle_res.json()["is_available"] is False

        # Restore
        client.post(f"/api/corridor/windows/{w_id}/unavailability", json={
            "is_available": True,
        })


def test_planning_rules_endpoint():
    # 1. Get rules
    rules_res = client.get("/api/rules")
    assert rules_res.status_code == 200
    data = rules_res.json()
    assert "hard_rules" in data
    assert "planning_preferences" in data
    assert data["hard_rules"]["min_train_buffer_min"]["value"] == 10

    # 2. Update rules
    up_res = client.put("/api/rules", json={
        "min_train_buffer_min": 12,
        "avoid_passenger_peak": False,
    })
    assert up_res.status_code == 200

    # 3. Reset rules
    reset_res = client.post("/api/rules/reset")
    assert reset_res.status_code == 200
    rules_res_after = client.get("/api/rules")
    assert rules_res_after.json()["hard_rules"]["min_train_buffer_min"]["value"] == 10
