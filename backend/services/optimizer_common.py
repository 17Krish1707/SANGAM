from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import networkx as nx

from backend.models.task import MaintenanceTask
from backend.models.block_window import BlockWindow
from backend.models.resource import Resource, TaskResourceRequirement
from backend.services.corridor_availability import populate_block_windows
from backend.services.compatibility_graph import build_section_graph
from backend.services.priority_engine import compute_priority_score


@dataclass
class OptimizationInputBundle:
    section_ids: List[str]
    start_date: datetime
    end_date: datetime
    horizon: str
    tasks: List[MaintenanceTask]
    windows: List[BlockWindow]
    graphs_by_section: Dict[str, nx.Graph]
    resources_by_id: Dict[str, Resource]
    task_resource_map: Dict[str, List[str]]
    department_map: Dict[str, str]


def prepare_optimization_input(
    db: Session,
    section_ids: List[str],
    start_date: datetime,
    end_date: datetime,
    horizon: str = "weekly",
) -> OptimizationInputBundle:
    """
    Prepare canonical input bundle for baseline schedulers and CP-SAT optimizer.
    """
    # 1. Fetch pending tasks on the given sections within the horizon
    tasks = (
        db.query(MaintenanceTask)
        .filter(
            MaintenanceTask.section_id.in_(section_ids),
            MaintenanceTask.status == "Pending",
            MaintenanceTask.due_date <= end_date,
        )
        .all()
    )

    # Ensure all tasks have priority scores
    for t in tasks:
        if t.priority_score is None:
            t.priority_score = compute_priority_score(t, reference_date=start_date)

    # 2. Ensure candidate block windows exist in scope
    windows = (
        db.query(BlockWindow)
        .filter(
            BlockWindow.section_id.in_(section_ids),
            BlockWindow.window_start >= start_date,
            BlockWindow.window_end <= end_date,
            BlockWindow.is_available == True,
        )
        .all()
    )

    if not windows:
        windows = populate_block_windows(db, section_ids, start_date, end_date)

    # 3. Build compatibility and conflict graphs per section
    graphs = {}
    for sec_id in section_ids:
        graphs[sec_id] = build_section_graph(db, section_id=sec_id, start_date=start_date, end_date=end_date)

    # 4. Resources and task resource requirements
    resources = {str(r.id): r for r in db.query(Resource).filter(Resource.is_available == True).all()}
    
    task_ids = [str(t.id) for t in tasks]
    trr_rows = (
        db.query(TaskResourceRequirement)
        .filter(TaskResourceRequirement.task_id.in_(task_ids))
        .all()
    ) if task_ids else []

    task_resource_map: Dict[str, List[str]] = {t_id: [] for t_id in task_ids}
    for trr in trr_rows:
        t_id = str(trr.task_id)
        r_id = str(trr.resource_id)
        if t_id in task_resource_map:
            task_resource_map[t_id].append(r_id)

    dept_map = {}
    for t in tasks:
        dept_map[str(t.department_id)] = t.department.code if t.department else "GEN"

    return OptimizationInputBundle(
        section_ids=section_ids,
        start_date=start_date,
        end_date=end_date,
        horizon=horizon,
        tasks=tasks,
        windows=windows,
        graphs_by_section=graphs,
        resources_by_id=resources,
        task_resource_map=task_resource_map,
        department_map=dept_map,
    )
