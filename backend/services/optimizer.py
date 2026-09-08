import time
from datetime import datetime
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from ortools.sat.python import cp_model

from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask
from backend.services.optimizer_common import OptimizationInputBundle
from backend.services.baselines import intervals_overlap
from backend.services.compatibility_graph import has_conflict


def run_sangam_optimizer(
    bundle: OptimizationInputBundle,
    db: Session,
    time_limit_seconds: int = 30,
    objective_profile: str = "balanced",
) -> Dict[str, Any]:
    """
    PRIMARY: SANGAM CP-SAT Joint Block Optimizer
    Formulates a multi-department co-location constraint satisfaction & optimization model.
    Minimizes total block hours, train impact risk, and unscheduled priority,
    while heavily rewarding multi-department joint blocks.
    Supports objective_profile: 'balanced' | 'max_availability' | 'min_train_impact'.
    """
    start_time = time.perf_counter()
    opt_run = OptimizationRun(
        run_type="sangam_optimized",
        horizon=bundle.horizon,
        objective_profile=objective_profile,
        started_at=datetime.utcnow(),
        status="running",
    )
    db.add(opt_run)
    db.flush()

    tasks = bundle.tasks
    windows = bundle.windows

    if not tasks:
        opt_run.completed_at = datetime.utcnow()
        opt_run.status = "completed"
        opt_run.objective_value = 0.0
        db.commit()
        return {
            "run_id": str(opt_run.id),
            "run_type": "sangam_optimized",
            "total_block_minutes": 0,
            "total_block_hours": 0.0,
            "tasks_scheduled": 0,
            "tasks_unscheduled": 0,
            "blocks_count": 0,
            "joint_blocks_count": 0,
            "solver_status": "OPTIMAL",
        }

    model = cp_model.CpModel()

    # Pre-calculate window durations in minutes
    window_durations = {}
    for j, w in enumerate(windows):
        dur = int((w.window_end - w.window_start).total_seconds() // 60)
        window_durations[j] = dur

    # Decision variables:
    # x[i, j] = 1 if task i assigned to window j
    # y[j] = 1 if window j is opened as an active block
    # unscheduled[i] = 1 if task i is deferred
    x = {}
    valid_pairs = []

    for i, t in enumerate(tasks):
        t_sec_id = str(t.section_id)
        for j, w in enumerate(windows):
            w_sec_id = str(w.section_id)
            # Constraint 2 & 6: Section match and task minimum block fits inside window duration
            if t_sec_id == w_sec_id and t.minimum_contiguous_block_min <= window_durations[j]:
                x[i, j] = model.NewBoolVar(f"x_{i}_{j}")
                valid_pairs.append((i, j))

    y = {j: model.NewBoolVar(f"y_{j}") for j in range(len(windows))}
    unscheduled = {i: model.NewBoolVar(f"unsch_{i}") for i in range(len(tasks))}

    # Constraint 1: Each task assigned to at most one window OR marked unscheduled
    for i in range(len(tasks)):
        assigned_windows = [x[i, j] for (ti, j) in valid_pairs if ti == i]
        model.Add(sum(assigned_windows) + unscheduled[i] == 1)

    # Constraint 4: Linking x[i, j] -> y[j]
    for (i, j) in valid_pairs:
        model.AddImplication(x[i, j], y[j])

    # Constraint 3: Window capacity: sum of task durations assigned to window j <= window_duration[j] * y[j]
    for j in range(len(windows)):
        tasks_in_w = [x[i, j] * tasks[i].estimated_duration_min for (i, wj) in valid_pairs if wj == j]
        if tasks_in_w:
            model.Add(sum(tasks_in_w) <= window_durations[j] * y[j])
        else:
            model.Add(y[j] == 0)

    # Constraint 5: Conflict constraint from compatibility graph
    # For any two tasks with a 'conflict' edge, they cannot both share the same window
    for j, w in enumerate(windows):
        sec_id = str(w.section_id)
        graph = bundle.graphs_by_section.get(sec_id)
        if not graph:
            continue

        tasks_on_sec = [i for (i, wj) in valid_pairs if wj == j]
        n_sec = len(tasks_on_sec)
        for idx1 in range(n_sec):
            i1 = tasks_on_sec[idx1]
            t1_id = str(tasks[i1].id)
            for idx2 in range(idx1 + 1, n_sec):
                i2 = tasks_on_sec[idx2]
                t2_id = str(tasks[i2].id)
                if has_conflict(graph, t1_id, t2_id):
                    model.Add(x[i1, j] + x[i2, j] <= 1)

    # Constraint 7: Precedence dependency
    # If task A must precede task B, window of A must end before window of B starts
    for sec_id, graph in bundle.graphs_by_section.items():
        for u, v, d in graph.edges(data=True):
            if d.get("relationship") == "dependency":
                pred_id = d.get("predecessor", u)
                succ_id = d.get("successor", v)

                # Find task indices
                pred_indices = [i for i, t in enumerate(tasks) if str(t.id) == pred_id]
                succ_indices = [i for i, t in enumerate(tasks) if str(t.id) == succ_id]

                if pred_indices and succ_indices:
                    i_pred = pred_indices[0]
                    i_succ = succ_indices[0]

                    for (ip, j_p) in valid_pairs:
                        if ip != i_pred:
                            continue
                        w_pred = windows[j_p]
                        for (isuc, j_s) in valid_pairs:
                            if isuc != i_succ:
                                continue
                            w_succ = windows[j_s]
                            # If predecessor window ends AFTER successor window starts, prohibit this assignment
                            if w_pred.window_end > w_succ.window_start:
                                model.Add(x[i_pred, j_p] + x[i_succ, j_s] <= 1)

    # Constraint 8: Resource non-overlap
    # A crew or equipment cannot be in two places at once across overlapping windows
    # Map resource_id -> list of (task_idx, window_idx)
    resource_assignments: Dict[str, List[Tuple[int, int]]] = {}
    for (i, j) in valid_pairs:
        t_id = str(tasks[i].id)
        for r_id in bundle.task_resource_map.get(t_id, []):
            resource_assignments.setdefault(r_id, []).append((i, j))

    for r_id, pairs in resource_assignments.items():
        n_p = len(pairs)
        for p1 in range(n_p):
            i1, j1 = pairs[p1]
            w1 = windows[j1]
            for p2 in range(p1 + 1, n_p):
                i2, j2 = pairs[p2]
                w2 = windows[j2]
                if i1 != i2 and intervals_overlap(w1.window_start, w1.window_end, w2.window_start, w2.window_end):
                    model.Add(x[i1, j1] + x[i2, j2] <= 1)

    # Joint block variables to reward multi-department joint blocks
    # joint[i, k, j] = 1 if both task i and task k are assigned to window j
    joint_pairs = []
    for j, w in enumerate(windows):
        sec_id = str(w.section_id)
        graph = bundle.graphs_by_section.get(sec_id)
        if not graph:
            continue

        tasks_in_w = [i for (i, wj) in valid_pairs if wj == j]
        n_w = len(tasks_in_w)
        for a in range(n_w):
            i1 = tasks_in_w[a]
            t1_id = str(tasks[i1].id)
            for b in range(a + 1, n_w):
                i2 = tasks_in_w[b]
                t2_id = str(tasks[i2].id)

                # Check if compatible edge exists or compatible by lack of conflict
                is_compat = False
                if graph.has_edge(t1_id, t2_id):
                    is_compat = (graph[t1_id][t2_id].get("relationship") == "compatible")
                elif not has_conflict(graph, t1_id, t2_id):
                    # Multi-department parallel non-conflicting co-location is beneficial
                    is_compat = (tasks[i1].department_id != tasks[i2].department_id)

                if is_compat:
                    z_joint = model.NewBoolVar(f"joint_{i1}_{i2}_{j}")
                    model.Add(z_joint <= x[i1, j])
                    model.Add(z_joint <= x[i2, j])
                    model.Add(z_joint >= x[i1, j] + x[i2, j] - 1)
                    joint_pairs.append(z_joint)

    # === OBJECTIVE FUNCTION ===
    # Formulate weights based on objective_profile:
    if objective_profile == "max_availability":
        crit_weight = 1200
        norm_weight = 150
        risk_coeff = 80       # lower train risk penalty
        dur_coeff = 250       # high penalty on corridor closure duration
        joint_reward = -25000 # maximum reward for combining possessions
    elif objective_profile == "min_train_impact":
        crit_weight = 900
        norm_weight = 80
        risk_coeff = 550      # high penalty on train risk / passenger disruption
        dur_coeff = 60        # lower penalty on block duration
        joint_reward = -12000
    else:  # balanced
        crit_weight = 1000
        norm_weight = 100
        risk_coeff = 200
        dur_coeff = 100
        joint_reward = -15000

    objective_terms = []

    for i, t in enumerate(tasks):
        score = int(round((t.priority_score or 50.0) * 10))
        weight = crit_weight if t.severity in ("Critical", "High") else norm_weight
        objective_terms.append(weight * score * unscheduled[i])

    for j, w in enumerate(windows):
        risk = int(round((w.risk_score or 0.5) * 100))
        dur = window_durations[j]
        objective_terms.append(risk_coeff * risk * y[j])
        objective_terms.append(dur_coeff * dur * y[j])

    for z_joint in joint_pairs:
        objective_terms.append(joint_reward * z_joint)

    model.Minimize(sum(objective_terms))

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds

    status = solver.Solve(model)
    elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 1)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        status_str = "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE"
        created_blocks = []
        scheduled_task_ids = set()

        # Build plan from solver solution
        for j, w in enumerate(windows):
            if solver.Value(y[j]) == 1:
                assigned_task_indices = [
                    i for (i, wj) in valid_pairs
                    if wj == j and solver.Value(x[i, j]) == 1
                ]
                if not assigned_task_indices:
                    continue

                assigned_tasks = [tasks[i] for i in assigned_task_indices]
                for t in assigned_tasks:
                    scheduled_task_ids.add(str(t.id))

                # Check if multiple departments are in this block
                distinct_depts = {str(t.department_id) for t in assigned_tasks}
                is_joint = (len(assigned_tasks) > 1 and len(distinct_depts) > 1) or len(assigned_tasks) > 1

                block = GeneratedBlock(
                    run_id=opt_run.id,
                    section_id=w.section_id,
                    block_start=w.window_start,
                    block_end=w.window_end,
                    is_joint_block=is_joint,
                    approval_status="recommended",
                )
                db.add(block)
                db.flush()

                for t in assigned_tasks:
                    bt = GeneratedBlockTask(block_id=block.id, task_id=t.id)
                    db.add(bt)
                created_blocks.append(block)

        total_block_minutes = sum(
            int((b.block_end - b.block_start).total_seconds() // 60) for b in created_blocks
        )
        joint_blocks_count = sum(1 for b in created_blocks if b.is_joint_block)

        opt_run.completed_at = datetime.utcnow()
        opt_run.status = "completed"
        opt_run.objective_value = float(solver.ObjectiveValue())
        opt_run.solver_runtime_ms = elapsed_ms
        opt_run.tasks_considered = len(tasks)
        opt_run.tasks_scheduled = len(scheduled_task_ids)
        opt_run.tasks_deferred = len(tasks) - len(scheduled_task_ids)
        db.commit()

        return {
            "run_id": str(opt_run.id),
            "run_type": "sangam_optimized",
            "objective_profile": objective_profile,
            "solver_runtime_ms": elapsed_ms,
            "total_block_minutes": total_block_minutes,
            "total_block_hours": round(total_block_minutes / 60.0, 2),
            "tasks_scheduled": len(scheduled_task_ids),
            "tasks_unscheduled": len(tasks) - len(scheduled_task_ids),
            "blocks_count": len(created_blocks),
            "joint_blocks_count": joint_blocks_count,
            "objective_value": float(solver.ObjectiveValue()),
            "solver_status": status_str,
        }

    elif status == cp_model.INFEASIBLE:
        opt_run.completed_at = datetime.utcnow()
        opt_run.status = "infeasible"
        db.commit()
        return {
            "run_id": str(opt_run.id),
            "run_type": "sangam_optimized",
            "status": "infeasible",
            "error": "CP-SAT solver proved the scheduling problem is INFEASIBLE under current hard constraints.",
        }
    else:
        opt_run.completed_at = datetime.utcnow()
        opt_run.status = "failed"
        db.commit()
        return {
            "run_id": str(opt_run.id),
            "run_type": "sangam_optimized",
            "status": "failed",
            "error": f"CP-SAT solver timed out or terminated with status code {status}.",
        }
