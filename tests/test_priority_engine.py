from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal
from backend.models.task import MaintenanceTask
from backend.models.asset import Asset
from backend.services.priority_engine import (
    compute_priority_score,
    get_priority_breakdown,
    recompute_all_priority_scores,
    load_priority_weights,
)

client = TestClient(app)


def test_priority_score_formula_hand_crafted():
    weights = {
        "criticality": 0.30,
        "overdue_severity": 0.25,
        "safety_consequence": 0.20,
        "asset_importance": 0.15,
        "failure_risk": 0.10,
    }

    ref_date = datetime(2026, 9, 7, 8, 0, 0)

    # Case A: Critical, 15 days overdue, requires power isolation, asset Critical
    # Criticality = 1.0 (weight 0.30) -> 30.0
    # Overdue = 15/30 = 0.5 (weight 0.25) -> 12.5
    # Safety = 1.0 (power iso, weight 0.20) -> 20.0
    # Asset = 1.0 (Critical asset, weight 0.15) -> 15.0
    # Failure risk = 1.0 * 0.5 = 0.5 (weight 0.10) -> 5.0
    # Expected sum = 30 + 12.5 + 20 + 15 + 5 = 82.50
    mock_asset_crit = Asset(health_state="Critical")
    task_crit = MaintenanceTask(
        task_code="TEST-CRIT-01",
        severity="Critical",
        due_date=ref_date - timedelta(days=15),
        requires_power_isolation=True,
    )
    task_crit.asset = mock_asset_crit

    score_crit = compute_priority_score(task_crit, weights=weights, reference_date=ref_date)
    assert score_crit == 82.50

    # Case B: Low, not overdue (due in future), no power isolation, asset Good
    # Criticality = 0.25 (weight 0.30) -> 7.5
    # Overdue = 0.0 (weight 0.25) -> 0.0
    # Safety = 0.20 (weight 0.20) -> 4.0
    # Asset = 0.30 (Good asset, weight 0.15) -> 4.5
    # Failure risk = 0.25 * 0.0 = 0.0 (weight 0.10) -> 0.0
    # Expected sum = 7.5 + 0.0 + 4.0 + 4.5 + 0.0 = 16.00
    mock_asset_good = Asset(health_state="Good")
    task_low = MaintenanceTask(
        task_code="TEST-LOW-01",
        severity="Low",
        due_date=ref_date + timedelta(days=5),
        requires_power_isolation=False,
    )
    task_low.asset = mock_asset_good

    score_low = compute_priority_score(task_low, weights=weights, reference_date=ref_date)
    assert score_low == 16.00
    assert score_crit > score_low


def test_priority_breakdown_structure():
    ref_date = datetime(2026, 9, 7, 8, 0, 0)
    mock_asset = Asset(health_state="Degraded")
    task = MaintenanceTask(
        id="mock-task-uuid-1",
        task_code="ENG-101",
        severity="High",
        due_date=ref_date - timedelta(days=6),
        requires_power_isolation=False,
    )
    task.asset = mock_asset

    breakdown = get_priority_breakdown(task, reference_date=ref_date)
    assert breakdown["task_code"] == "ENG-101"
    assert "components" in breakdown
    assert "criticality" in breakdown["components"]
    assert "overdue_severity" in breakdown["components"]
    assert "safety_consequence" in breakdown["components"]
    assert "asset_importance" in breakdown["components"]
    assert "failure_risk" in breakdown["components"]

    # Verify contributions sum to total score
    total_contrib = sum(comp["contribution"] for comp in breakdown["components"].values())
    assert abs(round(total_contrib, 2) - breakdown["priority_score"]) < 0.05


def test_recompute_and_list_tasks_api():
    # 1. Trigger recompute endpoint
    post_res = client.post("/api/tasks/recompute-priority")
    assert post_res.status_code == 200
    assert post_res.json()["status"] == "success"
    assert post_res.json()["updated_tasks"] >= 100

    # 2. Query tasks with filters
    list_res = client.get("/api/tasks?department=ENG")
    assert list_res.status_code == 200
    eng_tasks = list_res.json()
    assert len(eng_tasks) > 0
    assert all(t["department_code"] == "ENG" for t in eng_tasks)

    # Verify descending sort order by priority_score
    scores = [t["priority_score"] for t in eng_tasks]
    assert scores == sorted(scores, reverse=True)

    # 3. Test overdue filter
    overdue_res = client.get("/api/tasks?overdue_only=true")
    assert overdue_res.status_code == 200
    overdue_tasks = overdue_res.json()
    assert len(overdue_tasks) > 0

    # 4. Test priority breakdown API
    sample_task_id = eng_tasks[0]["id"]
    breakdown_res = client.get(f"/api/tasks/{sample_task_id}/priority-breakdown")
    assert breakdown_res.status_code == 200
    b_data = breakdown_res.json()
    assert b_data["task_id"] == sample_task_id
    assert "components" in b_data
    assert b_data["priority_score"] > 0
