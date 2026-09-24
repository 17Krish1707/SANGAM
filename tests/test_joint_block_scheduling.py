import pytest
from datetime import datetime, timedelta
import networkx as nx
from backend.database import SessionLocal
from backend.models.task import MaintenanceTask
from backend.models.block_window import BlockWindow
from backend.models.optimization import GeneratedBlock, GeneratedBlockTask
from backend.services.optimizer_common import OptimizationInputBundle
from backend.services.optimizer import run_sangam_optimizer


def test_concurrent_joint_block_duration():
    """
    Test true joint block scheduling:
    ENG (90 min), TRD (60 min), and S&T (45 min) compatible tasks
    scheduled inside a 120-minute candidate window must execute in parallel,
    resulting in a block duration of 90 minutes (max(end) - min(start)),
    NOT the sum (90 + 60 + 45 = 195 minutes).
    """
    db = SessionLocal()
    sec_id = "sec-joint-test"
    start_dt = datetime(2026, 9, 10, 8, 0, 0)
    end_dt = datetime(2026, 9, 10, 20, 0, 0)

    # 1. Compatible tasks from 3 different departments on the same section
    t_eng = MaintenanceTask(
        id="task-joint-eng",
        task_code="ENG-WELD-90",
        section_id=sec_id,
        department_id="dept-eng",
        maintenance_type="Rail Weld Repair",
        severity="High",
        estimated_duration_min=90,
        minimum_contiguous_block_min=70,
        can_run_parallel=True,
        priority_score=85.0,
        due_date=start_dt + timedelta(days=1),
    )
    t_trd = MaintenanceTask(
        id="task-joint-trd",
        task_code="TRD-CANT-60",
        section_id=sec_id,
        department_id="dept-trd",
        maintenance_type="Cantilever Inspection",
        severity="High",
        estimated_duration_min=60,
        minimum_contiguous_block_min=45,
        can_run_parallel=True,
        priority_score=80.0,
        due_date=start_dt + timedelta(days=1),
    )
    t_snt = MaintenanceTask(
        id="task-joint-snt",
        task_code="SNT-POINT-45",
        section_id=sec_id,
        department_id="dept-snt",
        maintenance_type="Point Machine Check",
        severity="Medium",
        estimated_duration_min=45,
        minimum_contiguous_block_min=30,
        can_run_parallel=True,
        priority_score=75.0,
        due_date=start_dt + timedelta(days=1),
    )
    tasks = [t_eng, t_trd, t_snt]

    # 2. Window: 120 minutes (09:00 to 11:00)
    # 120 minutes can easily fit 90m parallel, but CANNOT fit 195m sequential!
    w1 = BlockWindow(
        id="win-joint-120",
        section_id=sec_id,
        window_start=datetime(2026, 9, 10, 9, 0, 0),
        window_end=datetime(2026, 9, 10, 11, 0, 0),
        block_type="Maintenance",
        is_available=True,
        risk_score=0.1,
    )
    windows = [w1]

    # Compatibility graph: all 3 are compatible
    graph = nx.Graph()
    for t in tasks:
        graph.add_node(str(t.id), task_code=t.task_code)
    graph.add_edge("task-joint-eng", "task-joint-trd", relationship="compatible")
    graph.add_edge("task-joint-eng", "task-joint-snt", relationship="compatible")
    graph.add_edge("task-joint-trd", "task-joint-snt", relationship="compatible")

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

    opt_res = run_sangam_optimizer(bundle, db, time_limit_seconds=15)
    assert opt_res["solver_status"] in ("OPTIMAL", "FEASIBLE")

    run_id = opt_res["run_id"]
    blocks = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == run_id).all()
    assert len(blocks) == 1, "All 3 tasks should be co-scheduled in 1 joint block"

    block = blocks[0]
    assert block.is_joint_block is True, "Block must be flagged as joint block"

    block_tasks = db.query(GeneratedBlockTask).filter(GeneratedBlockTask.block_id == block.id).all()
    scheduled_task_ids = {str(bt.task_id) for bt in block_tasks}
    assert scheduled_task_ids == {"task-joint-eng", "task-joint-trd", "task-joint-snt"}

    # Duration of the block must be 90 minutes (max duration of tasks running in parallel)
    actual_block_dur_min = int((block.block_end - block.block_start).total_seconds() // 60)
    assert actual_block_dur_min == 90, f"Joint block duration should be 90 min, got {actual_block_dur_min} min"

    # Verify individual task start/end timestamps
    for bt in block_tasks:
        assert bt.task_start >= block.block_start
        assert bt.task_end <= block.block_end
        task_span = int((bt.task_end - bt.task_start).total_seconds() // 60)
        assert task_span in (90, 60, 45)

    db.close()
