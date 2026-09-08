from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models.task import MaintenanceTask
from backend.models.conflict import TaskConflict
from backend.models.section import RailwaySection
from backend.services.compatibility_graph import (
    build_section_graph,
    get_compatible_clusters,
    has_conflict,
    get_dependencies,
    graph_to_dict,
)

client = TestClient(app)


def test_compatibility_graph_hand_built_scenario():
    # 5 Mock Tasks
    t1 = MaintenanceTask(
        id="t1-uuid",
        task_code="ENG-T1",
        department_id="dept-eng",
        estimated_duration_min=60,
        can_run_parallel=True,
        requires_power_isolation=False,
    )
    t2 = MaintenanceTask(
        id="t2-uuid",
        task_code="ENG-T2",
        department_id="dept-eng",
        estimated_duration_min=60,
        can_run_parallel=True,
        requires_power_isolation=False,
    )
    t3 = MaintenanceTask(
        id="t3-uuid",
        task_code="ENG-T3",
        department_id="dept-eng",
        estimated_duration_min=60,
        can_run_parallel=True,
        requires_power_isolation=False,
    )
    t4 = MaintenanceTask(
        id="t4-uuid",
        task_code="TRD-T4",
        department_id="dept-trd",
        estimated_duration_min=90,
        can_run_parallel=False,
        requires_power_isolation=True,
    )
    t5 = MaintenanceTask(
        id="t5-uuid",
        task_code="TRD-T5",
        department_id="dept-trd",
        estimated_duration_min=90,
        can_run_parallel=False,
        requires_power_isolation=True,
    )

    # Explicit conflicts and dependencies
    conflicts = [
        # Explicit conflict between T1 and T4
        TaskConflict(
            task_a_id="t1-uuid",
            task_b_id="t4-uuid",
            relationship="conflict",
            notes="Track renewal interferes with OHE wagon placement",
        ),
        # Explicit dependency: T3 must complete before T4
        TaskConflict(
            task_a_id="t3-uuid",
            task_b_id="t4-uuid",
            relationship="dependency",
            notes="T3 must complete before T4",
        ),
    ]

    graph = build_section_graph(
        db=None,
        section_id="sec-demo",
        tasks=[t1, t2, t3, t4, t5],
        conflicts=conflicts,
    )

    # 1. Test Inferred and Explicit Conflicts
    # Inferred conflict between T4 and T5 (both requires_power_isolation=True)
    assert has_conflict(graph, "t4-uuid", "t5-uuid") is True
    # Explicit conflict between T1 and T4
    assert has_conflict(graph, "t1-uuid", "t4-uuid") is True
    # Non-conflicting pair
    assert has_conflict(graph, "t1-uuid", "t3-uuid") is False

    # 2. Test Inferred Compatible Clusters
    # T1, T2, T3 are all same department, parallel-safe, and <= 180 min combined duration
    clusters = get_compatible_clusters(graph)
    assert len(clusters) >= 1
    # Check that T1, T2, T3 form a compatible clique
    found_compat = any({"t1-uuid", "t2-uuid"}.issubset(c) for c in clusters)
    assert found_compat is True

    # 3. Test Dependencies
    deps_t4 = get_dependencies(graph, "t4-uuid")
    assert "t3-uuid" in deps_t4

    # 4. Test serialization
    dict_repr = graph_to_dict(graph)
    assert dict_repr["total_nodes"] == 5
    assert dict_repr["total_edges"] >= 2


def test_section_graph_api_endpoint():
    db = SessionLocal()
    section = db.query(RailwaySection).first()
    assert section is not None
    sec_id = str(section.id)
    db.close()

    # Test list sections endpoint
    list_res = client.get("/api/sections")
    assert list_res.status_code == 200
    sec_data = list_res.json()
    assert len(sec_data) >= 5

    # Test compatibility graph endpoint for section
    graph_res = client.get(f"/api/sections/{sec_id}/compatibility-graph")
    assert graph_res.status_code == 200
    data = graph_res.json()

    assert "nodes" in data
    assert "edges" in data
    assert "total_nodes" in data
    assert "total_edges" in data
    assert data["total_nodes"] > 0
