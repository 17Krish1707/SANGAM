from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.task import MaintenanceTask
from backend.models.asset import Asset
from backend.services.priority_engine import (
    compute_priority_score,
    get_priority_breakdown,
    recompute_all_priority_scores,
    load_priority_weights,
)

client = TestClient(app)


def test_priority_critical_high_medium_low_hierarchy():
    """Requirement 28: Critical > High > Medium > Low when other values equal."""
    now = datetime(2026, 5, 10, 8, 0, 0)
    asset = Asset(health_state="Good", asset_type="Track")

    t_crit = MaintenanceTask(severity="Critical", due_date=now + timedelta(days=5), requires_power_isolation=False)
    t_crit.asset = asset
    t_high = MaintenanceTask(severity="High", due_date=now + timedelta(days=5), requires_power_isolation=False)
    t_high.asset = asset
    t_med = MaintenanceTask(severity="Medium", due_date=now + timedelta(days=5), requires_power_isolation=False)
    t_med.asset = asset
    t_low = MaintenanceTask(severity="Low", due_date=now + timedelta(days=5), requires_power_isolation=False)
    t_low.asset = asset

    s_crit = compute_priority_score(t_crit, reference_date=now)
    s_high = compute_priority_score(t_high, reference_date=now)
    s_med = compute_priority_score(t_med, reference_date=now)
    s_low = compute_priority_score(t_low, reference_date=now)

    assert s_crit > s_high > s_med > s_low, f"Expected Critical > High > Medium > Low, got: {s_crit}, {s_high}, {s_med}, {s_low}"


def test_overdue_and_near_due_urgency():
    """Requirement 28: Overdue increases score; near-due increases urgency (due tomorrow > due in 20 days)."""
    now = datetime(2026, 5, 10, 8, 0, 0)
    asset = Asset(health_state="Degraded", asset_type="Turnout Switch")

    # 1. Overdue scaling
    t_overdue_10d = MaintenanceTask(severity="High", due_date=now - timedelta(days=10), requires_power_isolation=False)
    t_overdue_10d.asset = asset
    t_overdue_2d = MaintenanceTask(severity="High", due_date=now - timedelta(days=2), requires_power_isolation=False)
    t_overdue_2d.asset = asset

    s_od10 = compute_priority_score(t_overdue_10d, reference_date=now)
    s_od2 = compute_priority_score(t_overdue_2d, reference_date=now)
    assert s_od10 > s_od2, f"Expected 10-day overdue ({s_od10}) > 2-day overdue ({s_od2})"

    # 2. Near-due: Task due tomorrow must score higher than task due in 20 days
    t_due_tomorrow = MaintenanceTask(severity="High", due_date=now + timedelta(days=1), requires_power_isolation=False)
    t_due_tomorrow.asset = asset
    t_due_in_20d = MaintenanceTask(severity="High", due_date=now + timedelta(days=20), requires_power_isolation=False)
    t_due_in_20d.asset = asset

    s_tomorrow = compute_priority_score(t_due_tomorrow, reference_date=now)
    s_20d = compute_priority_score(t_due_in_20d, reference_date=now)
    assert s_tomorrow > s_20d, f"Expected due tomorrow ({s_tomorrow}) > due in 20 days ({s_20d})"


def test_dynamic_reference_date():
    """Requirement 28: Reference date is dynamic and changes calculations accordingly."""
    base_due = datetime(2026, 6, 1, 8, 0, 0)
    task = MaintenanceTask(severity="High", due_date=base_due, requires_power_isolation=False)
    task.asset = Asset(health_state="Good", asset_type="Track")

    # When reference date is 10 days before due date -> not overdue, normal urgency
    ref_early = base_due - timedelta(days=10)
    score_early = compute_priority_score(task, reference_date=ref_early)

    # When reference date is 5 days AFTER due date -> overdue, higher score!
    ref_late = base_due + timedelta(days=5)
    score_late = compute_priority_score(task, reference_date=ref_late)

    assert score_late > score_early, f"Dynamic reference date shift failed: {score_late} should exceed {score_early}"


def test_priority_breakdown_exact_sum():
    """Requirement 28: Explanation totals equal final score."""
    now = datetime(2026, 5, 10, 8, 0, 0)
    asset = Asset(health_state="Critical", asset_type="Point Machine 220V")
    task = MaintenanceTask(
        id="mock-task-uuid-1",
        task_code="ENG-101",
        severity="High",
        due_date=now - timedelta(days=3),
        requires_power_isolation=True,
    )
    task.asset = asset

    breakdown = get_priority_breakdown(task, reference_date=now)
    assert breakdown["task_code"] == "ENG-101"
    assert "components" in breakdown
    assert "explanation_text" in breakdown
    assert len(breakdown["explanation_text"]) > 10

    # Components check
    comps = breakdown["components"]
    active_keys = ["criticality", "urgency", "safety_consequence", "asset_importance", "failure_risk"]
    for k in active_keys:
        assert k in comps
        assert "contribution" in comps[k]
        assert "detail" in comps[k]

    # Verify contributions sum to total score exactly
    summed_contrib = round(sum(comps[k]["contribution"] for k in active_keys), 1)
    assert summed_contrib == breakdown["priority_score"], f"Sum {summed_contrib} != total {breakdown['priority_score']}"


def test_recompute_and_list_tasks_api():
    """Test recomputing priority across tasks and listing with filters."""
    # 1. Trigger recompute endpoint
    post_res = client.post("/api/tasks/recompute-priority")
    assert post_res.status_code == 200
    assert post_res.json()["status"] == "success"
    assert post_res.json()["updated_tasks"] >= 6

    # 2. Query tasks with filters
    list_res = client.get("/api/tasks?department=ENG")
    assert list_res.status_code == 200
    eng_tasks = list_res.json()
    assert len(eng_tasks) > 0
    assert all(t["department_code"] == "ENG" for t in eng_tasks)

    # Verify descending sort order by priority_score
    scores = [t["priority_score"] for t in eng_tasks]
    assert scores == sorted(scores, reverse=True)

    # 3. Test priority breakdown API
    sample_task_id = eng_tasks[0]["id"]
    breakdown_res = client.get(f"/api/tasks/{sample_task_id}/priority-breakdown")
    assert breakdown_res.status_code == 200
    b_data = breakdown_res.json()
    assert b_data["task_id"] == sample_task_id
    assert "components" in b_data
    assert b_data["priority_score"] > 0
    assert "explanation_text" in b_data
