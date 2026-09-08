from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models.optimization import OptimizationRun
from backend.models.task import MaintenanceTask
from backend.services.kpi_engine import compute_kpis, compute_downtime_saved
from backend.services.explainability import explain_task_priority, explain_task_scheduling, get_full_task_explanation

client = TestClient(app)


def test_kpi_and_explainability_endpoints():
    db = SessionLocal()

    # 1. Generate fresh runs to test against real optimizer output
    gen_res = client.post(
        "/api/plans/generate",
        json={
            "horizon": "weekly",
            "run_types": ["independent_baseline", "sangam_optimized"],
        },
    )
    assert gen_res.status_code == 200
    runs = gen_res.json()["runs"]
    base_run_id = [r["run_id"] for r in runs if r["run_type"] == "independent_baseline"][0]
    opt_run_id = [r["run_id"] for r in runs if r["run_type"] == "sangam_optimized"][0]

    # 2. Test compute_kpis
    kpis = compute_kpis(db, opt_run_id)
    assert "total_block_hours" in kpis
    assert "critical_task_coverage_pct" in kpis
    assert "joint_block_utilization_pct" in kpis
    assert "unscheduled_priority_sum" in kpis
    assert "train_impact_score" in kpis
    assert "resource_utilization_pct" in kpis

    # 3. Test compute_downtime_saved
    savings = compute_downtime_saved(db, base_run_id, opt_run_id)
    assert "baseline_hours" in savings
    assert "optimized_hours" in savings
    assert "hours_saved" in savings
    assert "percent_saved" in savings
    assert savings["hours_saved"] >= 0

    # 4. Test API GET /api/plans/{run_id}/kpis
    kpi_api_res = client.get(f"/api/plans/{opt_run_id}/kpis")
    assert kpi_api_res.status_code == 200
    kpi_data = kpi_api_res.json()
    assert kpi_data["run_id"] == opt_run_id

    # 5. Test API GET /api/plans/compare-downtime
    downtime_res = client.get(
        f"/api/plans/compare-downtime?baseline_run_id={base_run_id}&optimized_run_id={opt_run_id}"
    )
    assert downtime_res.status_code == 200
    d_data = downtime_res.json()
    assert d_data["hours_saved"] == savings["hours_saved"]

    # 6. Test Explainability for a scheduled or unscheduled task
    task = db.query(MaintenanceTask).first()
    assert task is not None
    t_id = str(task.id)

    exp_res = client.get(f"/api/plans/{opt_run_id}/tasks/{t_id}/explanation")
    assert exp_res.status_code == 200
    exp_data = exp_res.json()

    assert "priority_score" in exp_data
    assert "priority_reasons" in exp_data
    assert len(exp_data["priority_reasons"]) >= 4
    assert "scheduling" in exp_data
    assert "reasons" in exp_data["scheduling"]
    assert len(exp_data["scheduling"]["reasons"]) > 0

    # 7. Test Asset Availability API
    avail_res = client.get("/api/kpis/asset-availability")
    assert avail_res.status_code == 200
    avail_data = avail_res.json()
    assert "asset_availability_pct" in avail_data
    assert avail_data["asset_availability_pct"] >= 0

    db.close()
