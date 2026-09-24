import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models.section import RailwaySection
from backend.models.task import MaintenanceTask
from backend.models.optimization import GeneratedBlock, OptimizationRun
from backend.scripts.reset_demo import reset_demo

client = TestClient(app)

def test_full_demo_journey():
    # 0. Deterministic reset
    reset_demo()

    # 1. Open Maintenance Work (GET /api/tasks)
    # ENG-01, SNT-01, TRD-01 exist on Dadar–Matunga UP line
    res_tasks = client.get("/api/tasks")
    assert res_tasks.status_code == 200
    tasks = res_tasks.json()
    task_map = {t["task_code"]: t for t in tasks}

    assert "ENG-01" in task_map
    assert "SNT-01" in task_map
    assert "TRD-01" in task_map

    eng01 = task_map["ENG-01"]
    snt01 = task_map["SNT-01"]
    trd01 = task_map["TRD-01"]

    assert eng01["section_name"] == "Dadar–Matunga"
    assert eng01["track_line"] == "UP"
    assert snt01["section_name"] == "Dadar–Matunga"
    assert snt01["track_line"] == "UP"
    assert trd01["section_name"] == "Dadar–Matunga"
    assert trd01["track_line"] == "UP"

    # 2. Corridor & Trains: Dadar–Matunga contains matching infrastructure assets
    res_infra = client.get("/api/sections/corridor/infrastructure?from_station=Dadar&to_station=Vikhroli")
    assert res_infra.status_code == 200
    infra = res_infra.json()
    assert len(infra["sections"]) == 5

    eng_count = infra["departments"]["engineering"]["count"]
    snt_count = infra["departments"]["signalling"]["count"]
    trd_count = infra["departments"]["traction"]["count"]

    assert eng_count >= 5
    assert snt_count >= 5
    assert trd_count >= 5

    # 3. Create Block Plan: Select 3 tasks and evaluate coordination
    res_coord = client.get("/api/sections/corridor/coordination-analysis")
    assert res_coord.status_code == 200
    coord_data = res_coord.json()
    assert coord_data["candidate_joint_pairs"] >= 1

    # 4. Available candidate windows exist for Dadar–Matunga on UP line
    res_win = client.get("/api/corridor/windows/all?start_date=2026-09-24T00:00:00&end_date=2026-09-24T23:59:59")
    assert res_win.status_code == 200
    windows = res_win.json()
    assert len(windows) > 0

    # 5. Generate Plans with selected tasks (ENG-01, SNT-01, TRD-01)
    gen_payload = {
        "start_date": "2026-09-24T00:00:00",
        "end_date": "2026-09-24T23:59:59",
        "task_ids": [eng01["id"], snt01["id"], trd01["id"]],
        "objective_profile": "balanced",
        "run_types": ["sangam_optimized"]
    }
    res_gen = client.post("/api/plans/generate", json=gen_payload)
    assert res_gen.status_code == 200
    gen_result = res_gen.json()
    sangam_run = next(r for r in gen_result["runs"] if r["run_type"] == "sangam_optimized")
    run_id = sangam_run["run_id"]

    # 6. Verify CP-SAT returned blocks with the selected tasks
    res_plan = client.get(f"/api/plans/{run_id}")
    assert res_plan.status_code == 200
    plan_data = res_plan.json()
    assert len(plan_data["blocks"]) > 0
    assert plan_data["tasks_scheduled"] >= 3

    # Check alternatives endpoint
    res_alts = client.get(f"/api/plans/{run_id}/alternatives")
    assert res_alts.status_code == 200
    alts = res_alts.json()["alternatives"]
    rec_alt = next(a for a in alts if a["is_recommended"])
    assert sum(b["tasks_count"] for b in rec_alt["blocks"]) >= 3

    # 7. Approve Plan
    res_approve = client.post(f"/api/plans/{run_id}/approve")
    assert res_approve.status_code == 200
    assert res_approve.json()["blocks_approved"] > 0

    # 8. Approved Blocks endpoint immediately displays approved blocks
    res_appr_list = client.get("/api/plans/approved")
    assert res_appr_list.status_code == 200
    approved_blocks = res_appr_list.json()
    assert len(approved_blocks) >= 1

    # 9. Maintenance Work: task statuses are now 'Scheduled'
    res_tasks_after = client.get("/api/tasks")
    assert res_tasks_after.status_code == 200
    tasks_after_map = {t["task_code"]: t for t in res_tasks_after.json()}
    assert tasks_after_map["ENG-01"]["status"] == "Scheduled"
    assert tasks_after_map["SNT-01"]["status"] == "Scheduled"
    assert tasks_after_map["TRD-01"]["status"] == "Scheduled"

    # 10. Direct Database Persistence Check (simulating browser reload)
    db = SessionLocal()
    try:
        db_blocks = db.query(GeneratedBlock).filter(GeneratedBlock.approval_status == "approved").all()
        assert len(db_blocks) >= 1
        t_eng = db.query(MaintenanceTask).filter(MaintenanceTask.task_code == "ENG-01").first()
        assert t_eng.status == "Scheduled"
    finally:
        db.close()
