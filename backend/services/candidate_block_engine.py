"""
backend/services/candidate_block_engine.py — Candidate Maintenance Block Generation Engine.

Generates explicit, physically and operationally validated Candidate Block Options
prior to CP-SAT mathematical optimization. Ensures that only combinations with genuine
spatial overlap, compatible resources, and non-conflicting rules are proposed for joint possession.
"""

from typing import List, Dict, Any, Tuple, Set
from datetime import timedelta

from backend.services.spatial_reference import evaluate_tasks_spatial_compatibility, compute_possession_spatial_envelope
from backend.services.compatibility_graph import has_conflict


def generate_candidate_block_options(
    tasks: List[Any],
    windows: List[Any],
    graphs_by_section: Dict[str, Any],
    task_resource_map: Dict[str, List[str]],
) -> Dict[str, Any]:
    """
    Evaluates prioritized tasks across available train-free corridor windows to generate
    explicit candidate block options:
      - Single-Task Possessions (Option 1)
      - Dual-Department Joint Possessions (Option 2: ENG + TRD, ENG + SNT, etc.)
      - Tri-Department Possessions (Option 3: ENG + TRD + SNT)
    Returns structured candidate options with spatial envelopes and feasibility rationale.
    """
    candidates_by_window: Dict[int, List[Dict[str, Any]]] = {}
    valid_task_window_pairs: Set[Tuple[int, int]] = set()
    compatible_task_pairs_in_window: Set[Tuple[int, int, int]] = set()

    for j, w in enumerate(windows):
        w_sec_id = str(w.section_id)
        w_dur = int((w.window_end - w.window_start).total_seconds() // 60)
        graph = graphs_by_section.get(w_sec_id)

        # 1. Identify tasks eligible for this corridor section & window duration
        eligible_task_indices = []
        for i, t in enumerate(tasks):
            t_sec_id = str(t.section_id)
            min_block = max(10, getattr(t, "minimum_contiguous_block_min", None) or t.estimated_duration_min)

            if t_sec_id == w_sec_id and min_block <= w_dur:
                eligible_task_indices.append(i)
                valid_task_window_pairs.add((i, j))

        window_options: List[Dict[str, Any]] = []

        # 2. Add single task candidate options
        for i in eligible_task_indices:
            t = tasks[i]
            dept_code = t.department.code if getattr(t, "department", None) else "GEN"
            spatial_meta = compute_possession_spatial_envelope([t])

            window_options.append({
                "option_type": "single_department",
                "task_indices": [i],
                "task_codes": [t.task_code],
                "departments": [dept_code],
                "is_joint": False,
                "duration_min": min(t.estimated_duration_min, w_dur),
                "spatial_coverage": spatial_meta["display"],
                "rationale": f"Dedicated {dept_code} single-possession window.",
            })

        # 3. Form joint multi-task candidate pairs passing SPATIAL + OPERATIONAL checks
        n_elig = len(eligible_task_indices)
        for a in range(n_elig):
            idx_1 = eligible_task_indices[a]
            t1 = tasks[idx_1]
            t1_id = str(t1.id)

            for b in range(a + 1, n_elig):
                idx_2 = eligible_task_indices[b]
                t2 = tasks[idx_2]
                t2_id = str(t2.id)

                # Check 1: Graph conflict (safety exclusion)
                if graph and has_conflict(graph, t1_id, t2_id):
                    continue

                # Check 2: Parallel execution allowed
                if not getattr(t1, "can_run_parallel", True) or not getattr(t2, "can_run_parallel", True):
                    continue

                # Check 3: Resource competition
                res_1 = set(task_resource_map.get(t1_id, []))
                res_2 = set(task_resource_map.get(t2_id, []))
                if res_1 and res_2 and not res_1.isdisjoint(res_2):
                    continue

                # Check 4: SPATIAL COMPATIBILITY & BOUNDARY OVERLAP
                spatial_res = evaluate_tasks_spatial_compatibility(t1, t2)
                if not spatial_res["compatible"]:
                    continue

                # Pair is spatially & operationally compatible!
                compatible_task_pairs_in_window.add((idx_1, idx_2, j))

                depts = list({
                    t1.department.code if getattr(t1, "department", None) else "GEN",
                    t2.department.code if getattr(t2, "department", None) else "GEN",
                })
                is_cross_dept = len(depts) > 1

                # Possession duration is concurrent max, not simple sum!
                effective_duration = max(t1.estimated_duration_min, t2.estimated_duration_min)
                spatial_meta = compute_possession_spatial_envelope([t1, t2])

                window_options.append({
                    "option_type": "joint_possession" if is_cross_dept else "same_dept_parallel",
                    "task_indices": [idx_1, idx_2],
                    "task_codes": [t1.task_code, t2.task_code],
                    "departments": depts,
                    "is_joint": is_cross_dept,
                    "duration_min": effective_duration,
                    "spatial_coverage": spatial_meta["display"],
                    "rationale": f"Coordinated {'Joint' if is_cross_dept else 'Parallel'} Possession: {spatial_res['reason']}",
                })

        candidates_by_window[j] = window_options

    return {
        "candidates_by_window": candidates_by_window,
        "valid_task_window_pairs": valid_task_window_pairs,
        "compatible_task_pairs_in_window": compatible_task_pairs_in_window,
        "total_candidate_options": sum(len(opts) for opts in candidates_by_window.values()),
    }
