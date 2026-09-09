from datetime import datetime
from typing import List, Dict, Any, Optional, Set
import networkx as nx
from sqlalchemy.orm import Session

from backend.models.task import MaintenanceTask
from backend.models.conflict import TaskConflict


def build_section_graph(
    db: Optional[Session],
    section_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    tasks: Optional[List[MaintenanceTask]] = None,
    conflicts: Optional[List[TaskConflict]] = None,
) -> nx.Graph:
    """
    Build a NetworkX graph of pending tasks for a given section.
    Nodes: Tasks
    Edges: Relationships ('compatible', 'conflict', 'dependency')
    """
    graph = nx.Graph()

    # 1. Fetch tasks if not provided
    if tasks is None and db is not None:
        query = db.query(MaintenanceTask).filter(
            MaintenanceTask.section_id == section_id,
            MaintenanceTask.status.in_(["Pending", "Ready for Planning"]),
        )
        if end_date:
            query = query.filter(MaintenanceTask.due_date <= end_date)
        task_list = query.all()
    else:
        task_list = tasks or []

    task_map = {str(t.id): t for t in task_list}

    # Add nodes
    for t in task_list:
        t_id = str(t.id)
        graph.add_node(
            t_id,
            task_code=t.task_code,
            department=t.department.code if t.department else "GEN",
            maintenance_type=t.maintenance_type,
            severity=t.severity,
            duration=t.estimated_duration_min,
            requires_power_isolation=t.requires_power_isolation,
            can_run_parallel=t.can_run_parallel,
            priority_score=t.priority_score or 0.0,
            due_date=t.due_date.isoformat() if t.due_date else None,
        )

    # 2. Add explicit edges from task_conflicts
    if conflicts is None and db is not None:
        t_ids = list(task_map.keys())
        if t_ids:
            conflict_rows = (
                db.query(TaskConflict)
                .filter(
                    TaskConflict.task_a_id.in_(t_ids),
                    TaskConflict.task_b_id.in_(t_ids),
                )
                .all()
            )
        else:
            conflict_rows = []
    else:
        conflict_rows = conflicts or []

    for c in conflict_rows:
        a_id = str(c.task_a_id)
        b_id = str(c.task_b_id)
        if a_id in task_map and b_id in task_map and a_id != b_id:
            graph.add_edge(
                a_id,
                b_id,
                relationship=c.relationship,
                notes=c.notes,
                predecessor=a_id if c.relationship == "dependency" else None,
                successor=b_id if c.relationship == "dependency" else None,
            )

    # 3. Apply inference rules for any pair not explicitly connected
    n = len(task_list)
    for i in range(n):
        for j in range(i + 1, n):
            t_a = task_list[i]
            t_b = task_list[j]
            id_a = str(t_a.id)
            id_b = str(t_b.id)

            if not graph.has_edge(id_a, id_b):
                # Rule 1: Both require power isolation -> Conflict
                if t_a.requires_power_isolation and t_b.requires_power_isolation:
                    graph.add_edge(
                        id_a,
                        id_b,
                        relationship="conflict",
                        notes="Inferred: Both tasks mandate power isolation on the same section.",
                    )
                # Rule 2: Same dept, can run parallel, combined duration <= 180 min -> Compatible
                elif (
                    t_a.department_id == t_b.department_id
                    and t_a.can_run_parallel
                    and t_b.can_run_parallel
                    and (t_a.estimated_duration_min + t_b.estimated_duration_min) <= 180
                ):
                    graph.add_edge(
                        id_a,
                        id_b,
                        relationship="compatible",
                        notes="Inferred: Parallel-safe, same department, within 180 min block.",
                    )

    return graph


def get_compatible_clusters(graph: nx.Graph) -> List[Set[str]]:
    """
    Find maximal compatible cliques (or connected components of compatible edges).
    Returns list of task-id sets of size >= 2 that can safely share a joint block.
    """
    # Build a subgraph containing only compatible edges
    compat_edges = [
        (u, v) for u, v, d in graph.edges(data=True)
        if d.get("relationship") == "compatible"
    ]
    compat_subgraph = nx.Graph()
    compat_subgraph.add_nodes_from(graph.nodes())
    compat_subgraph.add_edges_from(compat_edges)

    # Find cliques of size >= 2
    cliques = [c for c in nx.find_cliques(compat_subgraph) if len(c) >= 2]
    # Sort largest cliques first
    cliques.sort(key=lambda c: len(c), reverse=True)
    return [set(c) for c in cliques]


def has_conflict(graph: nx.Graph, task_id_a: str, task_id_b: str) -> bool:
    """
    Returns True if there is a 'conflict' edge between task_a and task_b.
    Used as hard safety constraint in Phase 6 optimizer.
    """
    if graph.has_edge(task_id_a, task_id_b):
        return graph[task_id_a][task_id_b].get("relationship") == "conflict"
    return False


def get_dependencies(graph: nx.Graph, task_id: str) -> List[str]:
    """
    Returns a list of task_ids that must complete before `task_id` (predecessors).
    """
    predecessors = []
    if not graph.has_node(task_id):
        return predecessors

    for neighbor in graph.neighbors(task_id):
        edge_data = graph[task_id][neighbor]
        if edge_data.get("relationship") == "dependency":
            # If task_id is the successor, neighbor is the predecessor
            if edge_data.get("successor") == task_id:
                predecessors.append(neighbor)
            elif edge_data.get("predecessor") == neighbor:
                predecessors.append(neighbor)
    return predecessors


def graph_to_dict(graph: nx.Graph) -> Dict[str, Any]:
    """
    Serializes graph into a JSON-ready shape for frontend visualization:
    { "nodes": [...], "edges": [...] }
    """
    nodes = []
    for node_id, data in graph.nodes(data=True):
        nodes.append({
            "id": node_id,
            "label": data.get("task_code", node_id),
            "task_code": data.get("task_code"),
            "department": data.get("department"),
            "maintenance_type": data.get("maintenance_type"),
            "severity": data.get("severity"),
            "duration": data.get("duration"),
            "priority_score": data.get("priority_score"),
            "requires_power_isolation": data.get("requires_power_isolation"),
            "can_run_parallel": data.get("can_run_parallel"),
            "due_date": data.get("due_date"),
        })

    edges = []
    for u, v, data in graph.edges(data=True):
        edges.append({
            "source": u,
            "target": v,
            "type": data.get("relationship", "compatible"),
            "relationship": data.get("relationship", "compatible"),
            "notes": data.get("notes"),
            "predecessor": data.get("predecessor"),
            "successor": data.get("successor"),
        })

    return {
        "nodes": nodes,
        "edges": edges,
        "total_nodes": len(nodes),
        "total_edges": len(edges),
    }
