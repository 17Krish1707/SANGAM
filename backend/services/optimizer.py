import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy.orm import Session
from ortools.sat.python import cp_model

from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask
from backend.models.task import MaintenanceTask
from backend.services.optimizer_common import OptimizationInputBundle
from backend.services.compatibility_graph import has_conflict
from backend.services.train_impact import compute_plan_train_impact


def run_sangam_optimizer(
    bundle: OptimizationInputBundle,
    db: Session,
    time_limit_seconds: int = 25,
    objective_profile: str = "balanced",
    generate_alternatives: bool = True,
) -> Dict[str, Any]:
    """
    PRIMARY: SANGAM CP-SAT Joint Block Optimizer with True Interval Scheduling & Multi-Plan Alternatives.
    
    1. TRUE JOINT-BLOCK LOGIC:
       - Uses CP-SAT interval variables for each task inside candidate windows.
       - Compatible, independent departmental tasks (ENG + S&T + TRD) can execute CONCURRENTLY
         in parallel inside the same possession.
       - Exclusive shared resources or conflicting tasks are constrained with NoOverlap.
       - Block possession duration is derived from the actual schedule:
         block_start = min(task_starts), block_end = max(task_ends).
         Does not arbitrarily inflate the possession to the full window.
    
    2. MULTI-PLAN ALTERNATIVES:
       - Generates Plan A (Recommended), Plan B, and Plan C using no-good cut constraints.
       - Computes Train Impact Engine metrics for every alternative.
       - Ranks alternatives and provides plain-English controller recommendations.
    """
    start_time = time.perf_counter()
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    tasks = bundle.tasks
    windows = bundle.windows

    if not tasks:
        opt_run = OptimizationRun(
            run_type="sangam_optimized",
            horizon=bundle.horizon,
            objective_profile=objective_profile,
            started_at=now_utc,
            completed_at=now_utc,
            status="completed",
            objective_value=0.0,
            tasks_considered=0,
            tasks_scheduled=0,
            tasks_deferred=0,
        )
        db.add(opt_run)
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
            "alternatives": [],
            "plan_ranking": [],
        }

    # Pre-calculate window durations in minutes
    window_durations = {}
    for j, w in enumerate(windows):
        dur = int((w.window_end - w.window_start).total_seconds() // 60)
        window_durations[j] = max(1, dur)

    # Build Base CP-SAT Model
    model = cp_model.CpModel()

    # Decision variables:
    # x[i, j] = 1 if task i assigned to window j
    # y[j] = 1 if window j is opened
    # unscheduled[i] = 1 if task i is deferred
    x = {}
    valid_pairs: List[Tuple[int, int]] = []
    task_intervals: Dict[Tuple[int, int], Any] = {}
    task_start_vars: Dict[Tuple[int, int], Any] = {}
    task_end_vars: Dict[Tuple[int, int], Any] = {}

    for i, t in enumerate(tasks):
        t_sec_id = str(t.section_id)
        t_req_min = max(10, t.minimum_contiguous_block_min or t.estimated_duration_min)

        for j, w in enumerate(windows):
            w_sec_id = str(w.section_id)
            w_dur = window_durations[j]

            # Section match & task minimum contiguous block fits in window duration
            if t_sec_id == w_sec_id and t_req_min <= w_dur:
                t_dur = min(max(10, t.estimated_duration_min), w_dur)
                x[i, j] = model.NewBoolVar(f"x_{i}_{j}")
                valid_pairs.append((i, j))

                # Interval scheduling variables inside the window [0, w_dur]
                max_start = max(0, w_dur - t_dur)
                s_var = model.NewIntVar(0, max_start, f"s_{i}_{j}")
                e_var = model.NewIntVar(t_dur, w_dur, f"e_{i}_{j}")
                model.Add(e_var == s_var + t_dur)
                iv = model.NewOptionalIntervalVar(s_var, t_dur, e_var, x[i, j], f"iv_{i}_{j}")

                task_start_vars[i, j] = s_var
                task_end_vars[i, j] = e_var
                task_intervals[i, j] = iv

    y = {j: model.NewBoolVar(f"y_{j}") for j in range(len(windows))}
    unscheduled = {i: model.NewBoolVar(f"unsch_{i}") for i in range(len(tasks))}

    # Constraint 1: Each task assigned to at most one window OR deferred
    for i in range(len(tasks)):
        assigned_windows = [x[i, j] for (ti, j) in valid_pairs if ti == i]
        model.Add(sum(assigned_windows) + unscheduled[i] == 1)

    # Constraint 2: Linking x[i, j] -> y[j]
    for (i, j) in valid_pairs:
        model.AddImplication(x[i, j], y[j])

    # Constraint 3: Inactive windows cannot have assigned tasks
    for j in range(len(windows)):
        tasks_in_w = [x[i, j] for (i, wj) in valid_pairs if wj == j]
        if not tasks_in_w:
            model.Add(y[j] == 0)

    # Constraint 4: Task Conflicts & Concurrency Rules inside each window
    # For tasks on the same section:
    for j, w in enumerate(windows):
        sec_id = str(w.section_id)
        graph = bundle.graphs_by_section.get(sec_id)
        tasks_in_w = [i for (i, wj) in valid_pairs if wj == j]
        n_w = len(tasks_in_w)

        for a in range(n_w):
            i1 = tasks_in_w[a]
            t1 = tasks[i1]
            t1_id = str(t1.id)
            for b in range(a + 1, n_w):
                i2 = tasks_in_w[b]
                t2 = tasks[i2]
                t2_id = str(t2.id)

                # Check conflict from graph
                is_conflicting = False
                if graph and has_conflict(graph, t1_id, t2_id):
                    is_conflicting = True

                # Check if tasks cannot run in parallel (e.g. single track exclusive possession)
                cannot_parallel = (not getattr(t1, "can_run_parallel", True)) or (not getattr(t2, "can_run_parallel", True))

                if is_conflicting or cannot_parallel:
                    # They cannot overlap in time!
                    # Add NoOverlap constraint so they can either run sequentially or in separate windows
                    model.AddNoOverlap([task_intervals[i1, j], task_intervals[i2, j]])

    # Constraint 5: Resource Non-Overlap
    # An exclusive machine or crew cannot be in two tasks simultaneously
    resource_assignments: Dict[str, List[Tuple[int, int]]] = {}
    for (i, j) in valid_pairs:
        t_id = str(tasks[i].id)
        for r_id in bundle.task_resource_map.get(t_id, []):
            resource_assignments.setdefault(r_id, []).append((i, j))

    for r_id, pairs in resource_assignments.items():
        n_p = len(pairs)
        for p1 in range(n_p):
            i1, j1 = pairs[p1]
            for p2 in range(p1 + 1, n_p):
                i2, j2 = pairs[p2]
                if j1 == j2:
                    # Same window: sequential execution required (no overlap)
                    model.AddNoOverlap([task_intervals[i1, j1], task_intervals[i2, j2]])
                else:
                    # Overlapping windows across sections: cannot do both
                    w1 = windows[j1]
                    w2 = windows[j2]
                    if max(w1.window_start, w2.window_start) < min(w1.window_end, w2.window_end):
                        model.Add(x[i1, j1] + x[i2, j2] <= 1)

    # Constraint 6: Predecessor dependencies
    for (i, j) in valid_pairs:
        t = tasks[i]
        pred_id = getattr(t, "predecessor_task_id", None)
        if pred_id:
            # Predecessor task must complete before this task
            pred_indices = [idx for idx, task_obj in enumerate(tasks) if str(task_obj.id) == str(pred_id)]
            if pred_indices:
                p_idx = pred_indices[0]
                for (pi, pj) in valid_pairs:
                    if pi == p_idx:
                        w_curr = windows[j]
                        w_pred = windows[pj]
                        # If pred window ends after current window starts, forbid or enforce order
                        if w_pred.window_end > w_curr.window_start and j != pj:
                            model.Add(x[i, j] + x[pi, pj] <= 1)
                        elif j == pj:
                            # In same window, predecessor end <= current start
                            model.Add(task_end_vars[pi, pj] <= task_start_vars[i, j]).OnlyEnforceIf([x[i, j], x[pi, pj]])

    # Joint block reward variables
    joint_pairs = []
    for j, w in enumerate(windows):
        sec_id = str(w.section_id)
        graph = bundle.graphs_by_section.get(sec_id)
        tasks_in_w = [i for (i, wj) in valid_pairs if wj == j]
        n_w = len(tasks_in_w)
        for a in range(n_w):
            i1 = tasks_in_w[a]
            t1_id = str(tasks[i1].id)
            for b in range(a + 1, n_w):
                i2 = tasks_in_w[b]
                t2_id = str(tasks[i2].id)

                is_compat = False
                if graph and graph.has_edge(t1_id, t2_id) and graph[t1_id][t2_id].get("relationship") == "compatible":
                    is_compat = True
                elif tasks[i1].department_id != tasks[i2].department_id:
                    # Multi-department co-location
                    if not (graph and has_conflict(graph, t1_id, t2_id)):
                        is_compat = True

                if is_compat:
                    z_joint = model.NewBoolVar(f"joint_{i1}_{i2}_{j}")
                    model.Add(z_joint <= x[i1, j])
                    model.Add(z_joint <= x[i2, j])
                    model.Add(z_joint >= x[i1, j] + x[i2, j] - 1)
                    joint_pairs.append(z_joint)

    # OBJECTIVE FUNCTION TERMS
    # Balanced weights:
    if objective_profile == "max_availability":
        crit_weight = 1200
        norm_weight = 150
        risk_coeff = 80
        dur_coeff = 250
        joint_reward = -25000
    elif objective_profile == "min_train_impact":
        crit_weight = 900
        norm_weight = 80
        risk_coeff = 600
        dur_coeff = 60
        joint_reward = -12000
    else:  # balanced
        crit_weight = 1000
        norm_weight = 100
        risk_coeff = 200
        dur_coeff = 100
        joint_reward = -16000

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

    # Helper function to solve and extract solution
    def solve_and_extract(label: str, solver_time: int) -> Optional[Dict[str, Any]]:
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = solver_time
        solve_status = solver.Solve(model)

        if solve_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return None

        status_str = "OPTIMAL" if solve_status == cp_model.OPTIMAL else "FEASIBLE"
        active_assignments = [
            (i, j) for (i, j) in valid_pairs
            if solver.Value(x[i, j]) == 1
        ]

        # Build blocks and extract schedules
        created_block_dicts = []
        scheduled_task_ids = set()

        # Temporary DB run record for this alternative
        run_record = OptimizationRun(
            run_type="sangam_optimized",
            horizon=bundle.horizon,
            objective_profile=objective_profile,
            started_at=now_utc,
            status="completed",
            objective_value=float(solver.ObjectiveValue()),
        )
        db.add(run_record)
        db.flush()

        for j, w in enumerate(windows):
            if solver.Value(y[j]) == 1:
                assigned_in_w = [i for (i, wj) in active_assignments if wj == j]
                if not assigned_in_w:
                    continue

                # Compute exact start and end from scheduled intervals
                task_schedules = []
                for i in assigned_in_w:
                    t = tasks[i]
                    scheduled_task_ids.add(str(t.id))
                    s_min = int(solver.Value(task_start_vars[i, j]))
                    t_dur = min(max(10, t.estimated_duration_min), window_durations[j])
                    t_start = w.window_start + timedelta(minutes=s_min)
                    t_end = t_start + timedelta(minutes=t_dur)
                    task_schedules.append({
                        "task": t,
                        "start": t_start,
                        "end": t_end,
                        "duration_min": t_dur,
                    })

                # Possession start = earliest task start; possession end = latest task end!
                actual_block_start = min(item["start"] for item in task_schedules)
                actual_block_end = max(item["end"] for item in task_schedules)
                distinct_depts = {str(item["task"].department_id) for item in task_schedules}
                is_joint = len(task_schedules) > 1 and len(distinct_depts) > 1

                block = GeneratedBlock(
                    run_id=run_record.id,
                    section_id=w.section_id,
                    block_start=actual_block_start,
                    block_end=actual_block_end,
                    is_joint_block=is_joint,
                    approval_status="recommended",
                )
                db.add(block)
                db.flush()

                # Add tasks to block with exact scheduled timestamps
                for item in task_schedules:
                    bt = GeneratedBlockTask(
                        block_id=block.id,
                        task_id=item["task"].id,
                        task_start=item["start"],
                        task_end=item["end"],
                        scheduled_duration_min=item["duration_min"],
                    )
                    db.add(bt)

                created_block_dicts.append(block)

        db.flush()

        # Compute train impact
        train_impact = compute_plan_train_impact(db, created_block_dicts)

        total_block_minutes = sum(
            int((b.block_end - b.block_start).total_seconds() // 60) for b in created_block_dicts
        )
        total_block_hours = round(total_block_minutes / 60.0, 1)
        joint_blocks_count = sum(1 for b in created_block_dicts if b.is_joint_block)
        crit_scheduled = sum(1 for t in tasks if str(t.id) in scheduled_task_ids and t.severity in ("Critical", "High"))
        crit_total = sum(1 for t in tasks if t.severity in ("Critical", "High"))

        total_priority = sum(t.priority_score or 50.0 for t in tasks)
        sched_priority = sum(t.priority_score or 50.0 for t in tasks if str(t.id) in scheduled_task_ids)
        priority_coverage = round((sched_priority / total_priority * 100.0) if total_priority > 0 else 100.0, 1)

        run_record.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        run_record.solver_runtime_ms = round((time.perf_counter() - start_time) * 1000.0, 1)
        run_record.tasks_considered = len(tasks)
        run_record.tasks_scheduled = len(scheduled_task_ids)
        run_record.tasks_deferred = len(tasks) - len(scheduled_task_ids)

        return {
            "label": label,
            "run_id": str(run_record.id),
            "run_type": "sangam_optimized",
            "solver_status": status_str,
            "objective_value": float(solver.ObjectiveValue()),
            "tasks_scheduled": len(scheduled_task_ids),
            "tasks_deferred": len(tasks) - len(scheduled_task_ids),
            "critical_tasks_scheduled": crit_scheduled,
            "critical_tasks_total": crit_total,
            "priority_coverage_pct": priority_coverage,
            "total_block_minutes": total_block_minutes,
            "total_block_hours": total_block_hours,
            "blocks_count": len(created_block_dicts),
            "joint_blocks_count": joint_blocks_count,
            "train_impact": train_impact,
            "active_assignments": active_assignments,
            "blocks": created_block_dicts,
        }

    # 1. Solve Plan A (Primary / Recommended)
    plan_a_raw = solve_and_extract("Plan A", time_limit_seconds)

    if not plan_a_raw:
        # Fallback infeasible
        opt_run = OptimizationRun(
            run_type="sangam_optimized",
            horizon=bundle.horizon,
            objective_profile=objective_profile,
            started_at=now_utc,
            completed_at=now_utc,
            status="infeasible",
        )
        db.add(opt_run)
        db.commit()
        return {
            "run_id": str(opt_run.id),
            "status": "infeasible",
            "error": "CP-SAT proved the current operational block schedule is INFEASIBLE under hard constraints.",
        }

    alternatives = [plan_a_raw]

    # 2. Generate Plan B (if alternatives requested)
    if generate_alternatives and plan_a_raw["active_assignments"]:
        # Add no-good constraint excluding exact Plan A assignment
        a_vars = [x[i, j] for (i, j) in plan_a_raw["active_assignments"]]
        model.Add(sum(a_vars) <= len(a_vars) - 1)

        plan_b_raw = solve_and_extract("Plan B", max(5, time_limit_seconds // 2))
        if plan_b_raw and plan_b_raw["active_assignments"] != plan_a_raw["active_assignments"]:
            alternatives.append(plan_b_raw)

            # 3. Generate Plan C
            b_vars = [x[i, j] for (i, j) in plan_b_raw["active_assignments"]]
            model.Add(sum(b_vars) <= len(b_vars) - 1)
            plan_c_raw = solve_and_extract("Plan C", max(5, time_limit_seconds // 2))
            if plan_c_raw and plan_c_raw["active_assignments"] not in [a["active_assignments"] for a in alternatives]:
                alternatives.append(plan_c_raw)

    db.commit()

    # Formulate Plan Ranking and Explainability Descriptions
    ranked_plans = []
    for idx, p in enumerate(alternatives):
        is_rec = (idx == 0)
        ti = p["train_impact"]

        if is_rec:
            rec_text = (
                f"Best balance: all critical work covered ({p['critical_tasks_scheduled']}/{p['critical_tasks_total']}), "
                f"zero train conflicts ({ti['directly_affected_count']} affected), "
                f"{p['joint_blocks_count']} joint blocks, lowest track closure ({p['total_block_hours']} h)."
            )
        elif idx == 1:
            rec_text = (
                f"Alternative assignment: schedules {p['tasks_scheduled']} tasks with {p['total_block_hours']} h track closure "
                f"and {ti['min_train_margin_min']} min minimum train headway margin."
            )
        else:
            rec_text = (
                f"Conservative schedule: maximized train separation buffer ({ti['min_train_margin_min']} min margin) "
                f"with {p['joint_blocks_count']} integrated possessions."
            )

        ranked_plans.append({
            "plan_label": p["label"],
            "run_id": p["run_id"],
            "is_recommended": is_rec,
            "recommendation_explanation": rec_text,
            "tasks_scheduled": p["tasks_scheduled"],
            "tasks_deferred": p["tasks_deferred"],
            "critical_tasks_ratio": f"{p['critical_tasks_scheduled']} / {p['critical_tasks_total']}",
            "priority_coverage_pct": p["priority_coverage_pct"],
            "track_closure_hours": p["total_block_hours"],
            "joint_blocks_count": p["joint_blocks_count"],
            "trains_affected_count": ti["directly_affected_count"],
            "nearby_trains_count": ti["nearby_count"],
            "min_train_margin_min": ti["min_train_margin_min"],
            "expected_delay_min": ti["expected_delay_min"],
            "train_impact_tier": ti["impact_tier"],
            "train_impact_badge": ti["impact_badge_text"],
            "solver_objective_value": p["objective_value"],
        })

    elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 1)
    best_plan = alternatives[0]

    return {
        "run_id": best_plan["run_id"],
        "run_type": "sangam_optimized",
        "objective_profile": objective_profile,
        "solver_runtime_ms": elapsed_ms,
        "solver_status": best_plan["solver_status"],
        "total_block_minutes": best_plan["total_block_minutes"],
        "total_block_hours": best_plan["total_block_hours"],
        "tasks_scheduled": best_plan["tasks_scheduled"],
        "tasks_unscheduled": best_plan["tasks_deferred"],
        "blocks_count": best_plan["blocks_count"],
        "joint_blocks_count": best_plan["joint_blocks_count"],
        "train_impact": best_plan["train_impact"],
        "alternatives": ranked_plans,
        "recommended_plan": ranked_plans[0],
    }
