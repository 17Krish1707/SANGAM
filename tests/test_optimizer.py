from datetime import datetime, timedelta
import networkx as nx
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal
from backend.models.task import MaintenanceTask
from backend.models.block_window import BlockWindow
from backend.models.optimization import GeneratedBlock, GeneratedBlockTask
from backend.services.optimizer_common import OptimizationInputBundle
from backend.services.baselines import run_independent_baseline, run_greedy_baseline
from backend.services.optimizer import run_sangam_optimizer

client = TestClient(app)


def test_optimizer_small_synthetic_scenario():
    db = SessionLocal()

    sec_id = "sec-test-optimization"
    start_dt = datetime(2026, 9, 7, 8, 0, 0)
    end_dt = datetime(2026, 9, 7, 20, 0, 0)

    # 1. Hand-constructed tasks
    t1 = MaintenanceTask(
        id="opt-task-1",
        task_code="ENG-1",
        section_id=sec_id,
        department_id="dept-eng",
        maintenance_type="Weld Repair",
        severity="High",
        estimated_duration_min=60,
        minimum_contiguous_block_min=50,
        requires_power_isolation=False,
        can_run_parallel=True,
        priority_score=80.0,
        due_date=start_dt + timedelta(days=2),
    )
    t2 = MaintenanceTask(
        id="opt-task-2",
        task_code="ENG-2",
        section_id=sec_id,
        department_id="dept-eng",
        maintenance_type="Track Inspection",
        severity="Medium",
        estimated_duration_min=40,
        minimum_contiguous_block_min=30,
        requires_power_isolation=False,
        can_run_parallel=True,
        priority_score=75.0,
        due_date=start_dt + timedelta(days=2),
    )
    t3 = MaintenanceTask(
        id="opt-task-3",
        task_code="TRD-1",
        section_id=sec_id,
        department_id="dept-trd",
        maintenance_type="OHE Work A",
        severity="Critical",
        estimated_duration_min=80,
        minimum_contiguous_block_min=60,
        requires_power_isolation=True,
        can_run_parallel=False,
        priority_score=90.0,
        due_date=start_dt + timedelta(days=1),
    )
    t4 = MaintenanceTask(
        id="opt-task-4",
        task_code="TRD-2",
        section_id=sec_id,
        department_id="dept-trd",
        maintenance_type="OHE Work B",
        severity="Critical",
        estimated_duration_min=80,
        minimum_contiguous_block_min=60,
        requires_power_isolation=True,
        can_run_parallel=False,
        priority_score=90.0,
        due_date=start_dt + timedelta(days=1),
    )
    tasks = [t1, t2, t3, t4]

    # 2. Windows on this section:
    # Window 1: 120 min (fits T1 60m + T2 40m = 100m together)
    # Window 2: 90 min (fits T3 80m)
    # Window 3: 90 min (fits T4 80m)
    w1 = BlockWindow(
        id="opt-win-1",
        section_id=sec_id,
        window_start=datetime(2026, 9, 7, 9, 0, 0),
        window_end=datetime(2026, 9, 7, 11, 0, 0),  # 120 min
        block_type="Maintenance",
        is_available=True,
        risk_score=0.2,
    )
    w2 = BlockWindow(
        id="opt-win-2",
        section_id=sec_id,
        window_start=datetime(2026, 9, 7, 12, 0, 0),
        window_end=datetime(2026, 9, 7, 13, 30, 0),  # 90 min
        block_type="Maintenance",
        is_available=True,
        risk_score=0.2,
    )
    w3 = BlockWindow(
        id="opt-win-3",
        section_id=sec_id,
        window_start=datetime(2026, 9, 7, 15, 0, 0),
        window_end=datetime(2026, 9, 7, 16, 30, 0),   # 90 min
        block_type="Maintenance",
        is_available=True,
        risk_score=0.2,
    )
    windows = [w1, w2, w3]

    # 3. Compatibility graph:
    # T1 and T2 are COMPATIBLE (both ENG, can run parallel, 60+40 = 100 <= 150 min)
    # T3 and T4 CONFLICT (both requires_power_isolation)
    graph = nx.Graph()
    for t in tasks:
        graph.add_node(str(t.id), task_code=t.task_code)
    graph.add_edge("opt-task-1", "opt-task-2", relationship="compatible", notes="Compatible pair")
    graph.add_edge("opt-task-3", "opt-task-4", relationship="conflict", notes="Power isolation conflict")

    bundle = OptimizationInputBundle(
        section_ids=[sec_id],
        start_date=start_dt,
        end_date=end_dt,
        horizon="weekly",
        tasks=tasks,
        windows=windows,
        graphs_by_section={sec_id: graph},
        resources_by_id={},
        task_resource_map={str(t.id): [] for t in tasks},
        department_map={"dept-eng": "ENG", "dept-trd": "TRD", "dept-snt": "SNT"},
    )

    # Run Independent Baseline
    base_res = run_independent_baseline(bundle, db)
    # Run Greedy Baseline
    greedy_res = run_greedy_baseline(bundle, db)
    # Run SANGAM Optimizer
    opt_res = run_sangam_optimizer(bundle, db, time_limit_seconds=15)

    assert opt_res["solver_status"] in ("OPTIMAL", "FEASIBLE")

    # Fetch generated blocks for SANGAM run
    opt_run_id = opt_res["run_id"]
    opt_blocks = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == opt_run_id).all()

    # Collect task assignments per block
    block_task_map = {}
    for b in opt_blocks:
        bts = db.query(GeneratedBlockTask).filter(GeneratedBlockTask.block_id == b.id).all()
        block_task_map[str(b.id)] = {str(bt.task_id) for bt in bts}

    # Assertion 1: The optimizer NEVER co-schedules the known conflict pair (T3 and T4)
    for b_id, assigned_t_ids in block_task_map.items():
        assert not ("opt-task-3" in assigned_t_ids and "opt-task-4" in assigned_t_ids), \
            "Conflict pair T3 and T4 was co-scheduled in the same block!"

    # Assertion 2: The optimizer DOES co-schedule the known compatible pair (T1 and T2)
    t1_and_t2_co_scheduled = any(
        "opt-task-1" in assigned_t_ids and "opt-task-2" in assigned_t_ids
        for assigned_t_ids in block_task_map.values()
    )
    assert t1_and_t2_co_scheduled is True, "Compatible pair T1 and T2 was not co-scheduled!"

    # Assertion 3: total_block_minutes for sangam_optimized <= independent_baseline
    assert opt_res["total_block_minutes"] <= base_res["total_block_minutes"], \
        f"Optimized minutes ({opt_res['total_block_minutes']}) should be <= baseline ({base_res['total_block_minutes']})"

    db.close()


def test_plans_api_endpoints():
    # 1. POST /api/plans/generate
    gen_res = client.post(
        "/api/plans/generate",
        json={
            "horizon": "weekly",
            "run_types": ["independent_baseline", "greedy_baseline", "sangam_optimized"],
        },
    )
    assert gen_res.status_code == 200
    data = gen_res.json()
    assert data["status"] == "success"
    assert len(data["runs"]) == 3

    run_ids = [r["run_id"] for r in data["runs"]]
    opt_run = [r for r in data["runs"] if r["run_type"] == "sangam_optimized"][0]
    base_run = [r for r in data["runs"] if r["run_type"] == "independent_baseline"][0]

    # Verify total block minutes for SANGAM <= independent baseline
    assert opt_run["total_block_minutes"] <= base_run["total_block_minutes"]

    # 2. GET /api/plans/{run_id}
    plan_res = client.get(f"/api/plans/{opt_run['run_id']}")
    assert plan_res.status_code == 200
    plan_data = plan_res.json()
    assert plan_data["run_type"] == "sangam_optimized"
    assert "blocks" in plan_data

    # 3. GET /api/plans/compare/summary
    comp_res = client.get(f"/api/plans/compare/summary?run_ids={','.join(run_ids)}")
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert len(comp_data) == 3
    for entry in comp_data:
        assert "total_block_hours" in entry
        assert "joint_blocks_count" in entry
        assert "critical_tasks_completed_pct" in entry
        assert "train_impact_score" in entry
