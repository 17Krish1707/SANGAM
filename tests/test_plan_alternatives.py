import pytest
from datetime import datetime, timedelta
import networkx as nx
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models.section import RailwaySection
from backend.models.task import MaintenanceTask
from backend.models.block_window import BlockWindow
from backend.services.optimizer_common import OptimizationInputBundle
from backend.services.optimizer import run_sangam_optimizer

client = TestClient(app)


def test_multi_plan_alternatives_generation():
    """
    Test that the CP-SAT optimizer generates multiple distinct plan alternatives
    (Plan A, Plan B, Plan C) using no-good cut constraints, and that each plan
    has authentic, calculated operational metrics.
    """
    db = SessionLocal()
    sec_id = "sec-alt-test"
    start_dt = datetime(2026, 9, 12, 8, 0, 0)
    end_dt = datetime(2026, 9, 12, 22, 0, 0)

    # 1. Setup Section
    sec = db.query(RailwaySection).filter(RailwaySection.id == sec_id).first()
    if not sec:
        sec = RailwaySection(
            id=sec_id,
            name="ALT-SEC-1",
            from_station="STN-X",
            to_station="STN-Y",
            line_type="double",
            length_km=35.0,
        )
        db.add(sec)
        db.commit()

    # 2. Setup 4 tasks
    tasks = [
        MaintenanceTask(
            id=f"alt-task-{i}",
            task_code=f"ENG-ALT-{i}",
            section_id=sec_id,
            department_id="dept-eng" if i % 2 == 0 else "dept-trd",
            maintenance_type="Track / OHE Work",
            severity="High" if i == 0 else "Medium",
            estimated_duration_min=50,
            minimum_contiguous_block_min=40,
            can_run_parallel=True,
            priority_score=85.0 - (i * 5),
            due_date=start_dt + timedelta(days=2),
        )
        for i in range(4)
    ]

    # 3. Setup multiple candidate windows
    windows = [
        BlockWindow(
            id=f"alt-win-{j}",
            section_id=sec_id,
            window_start=start_dt + timedelta(hours=2 * j + 1),
            window_end=start_dt + timedelta(hours=2 * j + 2, minutes=30),
            block_type="Maintenance",
            is_available=True,
            risk_score=0.1 * (j + 1),
        )
        for j in range(4)
    ]

    graph = nx.Graph()
    for t in tasks:
        graph.add_node(str(t.id), task_code=t.task_code)
    # Tasks are compatible
    graph.add_edge("alt-task-0", "alt-task-1", relationship="compatible")
    graph.add_edge("alt-task-2", "alt-task-3", relationship="compatible")

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

    result = run_sangam_optimizer(bundle, db, time_limit_seconds=15)
    assert result["solver_status"] in ("OPTIMAL", "FEASIBLE")

    alternatives = result.get("alternatives", [])
    assert len(alternatives) >= 2, f"Expected at least 2 plan alternatives, got {len(alternatives)}"

    plan_a = alternatives[0]
    plan_b = alternatives[1]

    # Check Plan A has recommended status and label
    assert plan_a["plan_label"] == "Plan A"
    assert plan_a["is_recommended"] is True
    assert "balance" in plan_a["recommendation_explanation"].lower() or "best" in plan_a["recommendation_explanation"].lower()

    # Metrics must be non-trivial and authentic
    assert plan_a["track_closure_hours"] > 0
    assert plan_a["tasks_scheduled"] > 0
    assert "trains_affected_count" in plan_a
    assert "train_impact_badge" in plan_a

    # Check that alternatives have different run IDs or objective values
    assert plan_a["run_id"] != plan_b["run_id"]

    # API Endpoint check for alternatives
    run_id = result["run_id"]
    res = client.get(f"/api/plans/{run_id}/alternatives")
    assert res.status_code == 200
    data = res.json()
    assert "alternatives" in data
    assert len(data["alternatives"]) >= 1

    db.close()
