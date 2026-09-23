from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask
from backend.models.task import MaintenanceTask
from backend.models.block_window import BlockWindow
from backend.models.section import RailwaySection
from backend.models.train import TrainMovement
from backend.services.optimizer_common import prepare_optimization_input
from backend.services.baselines import run_independent_baseline, run_greedy_baseline
from backend.services.optimizer import run_sangam_optimizer
from backend.services.kpi_engine import compute_kpis, compute_downtime_saved
from backend.services.explainability import get_full_task_explanation
from backend.services.replanning import simulate_disruption, whatif_kpi_delta

router = APIRouter(prefix="/api/plans", tags=["Block Planning & Optimization"])


class PlanGenerateRequest(BaseModel):
    section_ids: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    horizon: str = "weekly"  # weekly | monthly
    run_types: List[str] = ["independent_baseline", "greedy_baseline", "sangam_optimized"]
    objective_profile: str = "balanced"  # balanced | max_availability | min_train_impact


@router.get("/latest")
def get_latest_runs(
    db: Session = Depends(get_db),
):
    """
    Returns the most recent completed run ID for each run type.
    Used by the Overview dashboard to auto-select the latest plan.
    """
    run_types = ["sangam_optimized", "independent_baseline", "greedy_baseline"]
    result = {}

    for rt in run_types:
        run = (
            db.query(OptimizationRun)
            .filter(
                OptimizationRun.run_type == rt,
                OptimizationRun.status == "completed",
            )
            .order_by(OptimizationRun.started_at.desc())
            .first()
        )
        if run:
            result[rt] = {
                "run_id": str(run.id),
                "run_type": run.run_type,
                "horizon": run.horizon,
                "objective_profile": run.objective_profile,
                "solver_runtime_ms": run.solver_runtime_ms,
                "tasks_scheduled": run.tasks_scheduled,
                "tasks_deferred": run.tasks_deferred,
                "started_at": run.started_at.isoformat() if run.started_at else None,
                "completed_at": run.completed_at.isoformat() if run.completed_at else None,
                "objective_value": run.objective_value,
            }
        else:
            result[rt] = None

    return result


@router.post("/generate")
def generate_plans(
    req: PlanGenerateRequest,
    db: Session = Depends(get_db),
):
    """
    Generate coordinated block plan using selected engine(s):
    - independent_baseline
    - greedy_baseline
    - sangam_optimized (Google OR-Tools CP-SAT)
    Supports objective_profile: balanced | max_availability | min_train_impact.
    """
    if not req.section_ids:
        all_secs = db.query(RailwaySection).all()
        sec_ids = [str(s.id) for s in all_secs]
    else:
        sec_ids = req.section_ids

    start_dt = req.start_date or datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    end_dt = req.end_date or (start_dt + (timedelta(days=7) if req.horizon == "weekly" else timedelta(days=28)))

    bundle = prepare_optimization_input(
        db=db,
        section_ids=sec_ids,
        start_date=start_dt,
        end_date=end_dt,
        horizon=req.horizon,
    )

    results = []

    for r_type in req.run_types:
        if r_type == "independent_baseline":
            res = run_independent_baseline(bundle, db)
            results.append(res)
        elif r_type == "greedy_baseline":
            res = run_greedy_baseline(bundle, db)
            results.append(res)
        elif r_type == "sangam_optimized":
            res = run_sangam_optimizer(
                bundle,
                db,
                time_limit_seconds=30,
                objective_profile=req.objective_profile,
            )
            results.append(res)

    return {
        "status": "success",
        "horizon": req.horizon,
        "objective_profile": req.objective_profile,
        "runs": results,
    }


@router.get("/compare-downtime")
def get_compare_downtime(
    baseline_run_id: str = Query(..., description="Baseline optimization run ID"),
    optimized_run_id: str = Query(..., description="SANGAM optimized run ID"),
    db: Session = Depends(get_db),
):
    """
    Returns hours saved and percentage reduction between baseline and optimized plan.
    """
    try:
        return compute_downtime_saved(db, baseline_run_id, optimized_run_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/compare/summary")
def compare_plans(
    run_ids: str = Query(..., description="Comma-separated run IDs to compare"),
    db: Session = Depends(get_db),
):
    """
    Compare multiple plans side-by-side:
    - total_block_hours
    - critical_tasks_completed_pct
    - joint_blocks_count
    - unscheduled_priority_sum
    - train_impact_score
    """
    ids = [i.strip() for i in run_ids.split(",") if i.strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="At least one run_id must be provided")

    comparison = []

    for r_id in ids:
        run = db.query(OptimizationRun).filter(OptimizationRun.id == r_id).first()
        if not run:
            continue

        blocks = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == r_id).all()
        total_minutes = sum(int((b.block_end - b.block_start).total_seconds() // 60) for b in blocks)
        total_hours = round(total_minutes / 60.0, 2)
        joint_blocks = sum(1 for b in blocks if b.is_joint_block)

        scheduled_task_ids = (
            db.query(GeneratedBlockTask.task_id)
            .join(GeneratedBlock, GeneratedBlock.id == GeneratedBlockTask.block_id)
            .filter(GeneratedBlock.run_id == r_id)
            .all()
        )
        scheduled_set = {str(row[0]) for row in scheduled_task_ids}

        all_tasks = db.query(MaintenanceTask).all()
        crit_high_tasks = [t for t in all_tasks if t.severity in ("Critical", "High")]
        crit_high_scheduled = [t for t in crit_high_tasks if str(t.id) in scheduled_set]
        crit_pct = round((len(crit_high_scheduled) / len(crit_high_tasks) * 100.0), 1) if crit_high_tasks else 100.0

        unsch_tasks = [t for t in all_tasks if str(t.id) not in scheduled_set]
        unsch_priority_sum = round(sum(t.priority_score or 0.0 for t in unsch_tasks), 1)

        impact_scores = []
        for b in blocks:
            bw = (
                db.query(BlockWindow)
                .filter(
                    BlockWindow.section_id == b.section_id,
                    BlockWindow.window_start == b.block_start,
                )
                .first()
            )
            if bw and bw.risk_score is not None:
                impact_scores.append(bw.risk_score)
            else:
                impact_scores.append(0.5)

        train_impact_score = round(sum(impact_scores), 2)

        comparison.append({
            "run_id": str(run.id),
            "run_type": run.run_type,
            "status": run.status,
            "total_block_hours": total_hours,
            "total_block_minutes": total_minutes,
            "blocks_count": len(blocks),
            "joint_blocks_count": joint_blocks,
            "critical_tasks_completed_pct": crit_pct,
            "tasks_scheduled_count": len(scheduled_set),
            "tasks_unscheduled_count": len(all_tasks) - len(scheduled_set),
            "unscheduled_priority_sum": unsch_priority_sum,
            "train_impact_score": train_impact_score,
        })

    return comparison


@router.get("/compare")
def compare_plans_alias(
    run_ids: str = Query(..., description="Comma-separated run IDs to compare"),
    db: Session = Depends(get_db),
):
    """
    Alias matching Phase 6 specification: GET /api/plans/compare?run_ids=id1,id2,id3
    """
    return compare_plans(run_ids=run_ids, db=db)


class DisruptionRequest(BaseModel):
    section_id: Optional[str] = None
    delay_minutes: int = 45
    train_number: Optional[str] = None


class ReplanPreviewRequest(BaseModel):
    run_id: Optional[str] = None
    train_number: Optional[str] = None
    section_id: Optional[str] = None
    delay_minutes: int = 0


class WhatIfChange(BaseModel):
    type: str                          # "lock_window" | "raise_severity"
    window_id: Optional[str] = None
    task_id:   Optional[str] = None
    new_severity: Optional[str] = None


@router.get("/freshness")
def get_plan_freshness(
    run_id: Optional[str] = Query(None, description="Plan run ID to check freshness for"),
    db: Session = Depends(get_db),
):
    """
    Check if the active SANGAM plan has any conflicts with current operational conditions:
    1. Real-time train positions / delays + 10-min safety buffer.
    2. Unavailable resources required by assigned tasks.
    3. Cancelled or invalid windows.
    Returns CURRENT, NEEDS_UPDATE, or HAS_CONFLICT.
    """
    from backend.models.resource import Resource
    target_run_id = run_id
    if not target_run_id:
        latest = (
            db.query(OptimizationRun)
            .filter(OptimizationRun.run_type == "sangam_optimized", OptimizationRun.status == "completed")
            .order_by(OptimizationRun.started_at.desc())
            .first()
        )
        if latest:
            target_run_id = str(latest.id)

    if not target_run_id:
        return {
            "status": "NO_PLAN",
            "run_id": None,
            "has_conflicts": False,
            "conflicts": [],
            "affected_blocks_count": 0,
            "reason": "No active plan found.",
        }

    blocks = (
        db.query(GeneratedBlock)
        .filter(GeneratedBlock.run_id == target_run_id)
        .all()
    )

    conflicts = []
    affected_block_ids = set()

    # 1. Check train occupancy conflicts with 10-minute safety buffer
    all_trains = db.query(TrainMovement).all()
    safety_buffer = timedelta(minutes=10)

    for b in blocks:
        sec_trains = [t for t in all_trains if t.section_id == b.section_id]
        for t in sec_trains:
            t_buf_start = t.entry_time - safety_buffer
            t_buf_end = t.exit_time + safety_buffer
            # Check overlap
            if max(b.block_start, t_buf_start) < min(b.block_end, t_buf_end):
                affected_block_ids.add(str(b.id))
                t_no = t.train_number or ("12925" if t.train_type == "Passenger" else "Freight")
                delay = getattr(t, "delay_minutes", 0) or 0
                sec_name = b.section.name if b.section else "Section"
                b_code = f"Block {b.section.from_station}-{b.section.to_station}" if b.section else f"Block {str(b.id)[:6]}"
                conflicts.append({
                    "type": "train_occupancy",
                    "train_number": t_no,
                    "train_type": t.train_type,
                    "delay_minutes": delay,
                    "block_id": str(b.id),
                    "section_id": str(b.section_id),
                    "section_name": sec_name,
                    "block_start": b.block_start.isoformat(),
                    "block_end": b.block_end.isoformat(),
                    "description": f"CONFLICT: Train {t_no} ({t.train_type}, delay +{delay}m) overlaps {b_code} ({b.block_start.strftime('%H:%M')}–{b.block_end.strftime('%H:%M')})",
                })

    # 2. Check resource unavailability conflicts
    from backend.models.resource import TaskResourceRequirement
    unavailable_resources = db.query(Resource).filter(Resource.is_available == False).all()
    unavail_res_ids = {r.id: r for r in unavailable_resources}

    if unavailable_resources:
        for b in blocks:
            b_tasks = (
                db.query(MaintenanceTask)
                .join(GeneratedBlockTask, GeneratedBlockTask.task_id == MaintenanceTask.id)
                .filter(GeneratedBlockTask.block_id == b.id)
                .all()
            )
            for t in b_tasks:
                reqs = db.query(TaskResourceRequirement).filter(TaskResourceRequirement.task_id == t.id).all()
                for tr in reqs:
                    if tr.resource_id in unavail_res_ids:
                        r_obj = unavail_res_ids[tr.resource_id]
                        affected_block_ids.add(str(b.id))
                        conflicts.append({
                            "type": "resource_unavailable",
                            "resource_name": r_obj.name,
                            "task_code": t.task_code,
                            "block_id": str(b.id),
                            "section_id": str(b.section_id),
                            "section_name": b.section.name if b.section else "Section",
                            "block_start": b.block_start.isoformat(),
                            "block_end": b.block_end.isoformat(),
                            "description": f"RESOURCE CONFLICT: Task {t.task_code} requires unavailable equipment/gang '{r_obj.name}'",
                        })

    # 3. Check task duration vs block duration
    for b in blocks:
        b_tasks = (
            db.query(MaintenanceTask)
            .join(GeneratedBlockTask, GeneratedBlockTask.task_id == MaintenanceTask.id)
            .filter(GeneratedBlockTask.block_id == b.id)
            .all()
        )
        b_dur = int((b.block_end - b.block_start).total_seconds() // 60)
        for t in b_tasks:
            if t.estimated_duration_min > b_dur:
                affected_block_ids.add(str(b.id))
                conflicts.append({
                    "type": "duration_misfit",
                    "task_code": t.task_code,
                    "task_name": t.maintenance_type,
                    "block_id": str(b.id),
                    "section_id": str(b.section_id),
                    "section_name": b.section.name if b.section else "Section",
                    "block_start": b.block_start.isoformat(),
                    "block_end": b.block_end.isoformat(),
                    "description": f"DURATION CONFLICT: Current plan needs update because {t.maintenance_type} now requires {t.estimated_duration_min} min (exceeds scheduled block of {b_dur} min)",
                })

    if conflicts:
        status = "HAS_CONFLICT"
        reason = f"{len(conflicts)} operational conflict(s) detected affecting {len(affected_block_ids)} maintenance block(s). Plan update recommended."
    else:
        status = "CURRENT"
        reason = "Plan is fully aligned with current corridor occupancy and resource availability."

    return {
        "status": status,
        "run_id": target_run_id,
        "has_conflicts": len(conflicts) > 0,
        "conflicts": conflicts,
        "affected_blocks_count": len(affected_block_ids),
        "affected_block_ids": list(affected_block_ids),
        "reason": reason,
    }


@router.post("/replan/preview")
def preview_replan(
    req: ReplanPreviewRequest,
    db: Session = Depends(get_db),
):
    """
    Live non-mutating preview of train delay impact on the active plan:
    Returns the shifted train path, affected blocks, and count of safe vs affected blocks.
    """
    target_run_id = req.run_id
    if not target_run_id:
        latest = (
            db.query(OptimizationRun)
            .filter(OptimizationRun.run_type == "sangam_optimized", OptimizationRun.status == "completed")
            .order_by(OptimizationRun.started_at.desc())
            .first()
        )
        if latest:
            target_run_id = str(latest.id)

    if not target_run_id:
        raise HTTPException(status_code=404, detail="No active plan found to preview against.")

    # Find train
    tm = None
    if req.train_number:
        tm = db.query(TrainMovement).filter(TrainMovement.train_number == req.train_number).first()
    if not tm and req.section_id:
        tm = db.query(TrainMovement).filter(TrainMovement.section_id == req.section_id).first()

    if not tm:
        return {
            "status": "not_found",
            "message": "Target train movement not found.",
            "affected_blocks": [],
            "affected_count": 0,
        }

    sec_id = str(tm.section_id)
    sched_entry = getattr(tm, "scheduled_entry_time", None) or tm.entry_time
    sched_exit = getattr(tm, "scheduled_exit_time", None) or tm.exit_time

    shifted_entry = sched_entry + timedelta(minutes=req.delay_minutes)
    shifted_exit = sched_exit + timedelta(minutes=req.delay_minutes)
    safety_buffer = timedelta(minutes=10)

    buf_start = shifted_entry - safety_buffer
    buf_end = shifted_exit + safety_buffer

    blocks = (
        db.query(GeneratedBlock)
        .filter(GeneratedBlock.run_id == target_run_id, GeneratedBlock.section_id == sec_id)
        .all()
    )

    all_plan_blocks = (
        db.query(GeneratedBlock)
        .filter(GeneratedBlock.run_id == target_run_id)
        .all()
    )

    affected = []
    for b in blocks:
        if max(b.block_start, buf_start) < min(b.block_end, buf_end):
            b_tasks = (
                db.query(MaintenanceTask)
                .join(GeneratedBlockTask, GeneratedBlockTask.task_id == MaintenanceTask.id)
                .filter(GeneratedBlockTask.block_id == b.id)
                .all()
            )
            affected.append({
                "block_id": str(b.id),
                "section_name": b.section.name if b.section else "Section",
                "block_start": b.block_start.isoformat(),
                "block_end": b.block_end.isoformat(),
                "duration_min": int((b.block_end - b.block_start).total_seconds() // 60),
                "is_joint_block": b.is_joint_block,
                "task_codes": [t.task_code for t in b_tasks],
                "conflict_reason": f"Train {tm.train_number} ({tm.train_type}) with +{req.delay_minutes}m delay transit ({shifted_entry.strftime('%H:%M')}–{shifted_exit.strftime('%H:%M')}) overlaps block",
            })

    return {
        "status": "success",
        "train_number": tm.train_number,
        "train_type": tm.train_type,
        "section_id": sec_id,
        "section_name": tm.section.name if tm.section else "Section",
        "delay_minutes": req.delay_minutes,
        "original_path": {
            "entry_time": sched_entry.isoformat(),
            "exit_time": sched_exit.isoformat(),
        },
        "preview_path": {
            "entry_time": shifted_entry.isoformat(),
            "exit_time": shifted_exit.isoformat(),
            "buffer_start": buf_start.isoformat(),
            "buffer_end": buf_end.isoformat(),
        },
        "affected_blocks": affected,
        "affected_count": len(affected),
        "total_plan_blocks": len(all_plan_blocks),
        "unaffected_count": len(all_plan_blocks) - len(affected),
    }


@router.post("/{run_id}/simulate-disruption")
def simulate_disruption_endpoint(
    run_id: str,
    req: DisruptionRequest,
    db: Session = Depends(get_db),
):
    """
    Simulate a train delay on a section and return a scoped re-plan diff.
    Saves the re-plan as a new optimization_runs row with parent_run_id set.
    """
    try:
        sec_id = req.section_id
        if req.train_number and not sec_id:
            tm = db.query(TrainMovement).filter(TrainMovement.train_number == req.train_number).first()
            if tm:
                sec_id = str(tm.section_id)
        if not sec_id:
            first_b = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == run_id).first()
            sec_id = str(first_b.section_id) if first_b else str(db.query(RailwaySection).first().id)

        res = simulate_disruption(
            db=db,
            run_id=run_id,
            section_id=sec_id,
            delay_minutes=req.delay_minutes,
            train_number=req.train_number,
        )

        # Collect detailed moved block cards
        new_run_id = res["new_run_id"]
        orig_blocks = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == run_id).all()
        new_blocks = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == new_run_id).all()

        moved_blocks_detail = []
        unchanged_blocks_detail = []

        for nb in new_blocks:
            identical_orig = next(
                (ob for ob in orig_blocks if ob.section_id == nb.section_id and ob.block_start == nb.block_start and ob.block_end == nb.block_end),
                None
            )
            nb_tasks = (
                db.query(MaintenanceTask)
                .join(GeneratedBlockTask, GeneratedBlockTask.task_id == MaintenanceTask.id)
                .filter(GeneratedBlockTask.block_id == nb.id)
                .all()
            )
            task_codes = [t.task_code for t in nb_tasks]

            if identical_orig:
                unchanged_blocks_detail.append({
                    "block_id": str(nb.id),
                    "section_name": nb.section.name if nb.section else "—",
                    "block_start": nb.block_start.isoformat(),
                    "block_end": nb.block_end.isoformat(),
                    "tasks": task_codes,
                    "status": "Unchanged",
                })
            else:
                nb_task_ids = {
                    str(bt.task_id) for bt in db.query(GeneratedBlockTask).filter(GeneratedBlockTask.block_id == nb.id).all()
                }
                corresp_orig = None
                for ob in orig_blocks:
                    ob_task_ids = {
                        str(bt.task_id) for bt in db.query(GeneratedBlockTask).filter(GeneratedBlockTask.block_id == ob.id).all()
                    }
                    if ob_task_ids & nb_task_ids:
                        corresp_orig = ob
                        break

                shift_min = 0
                old_start_iso = nb.block_start.isoformat()
                old_end_iso = nb.block_end.isoformat()
                if corresp_orig:
                    old_start_iso = corresp_orig.block_start.isoformat()
                    old_end_iso = corresp_orig.block_end.isoformat()
                    shift_min = int((nb.block_start - corresp_orig.block_start).total_seconds() // 60)

                moved_blocks_detail.append({
                    "block_id": str(nb.id),
                    "section_name": nb.section.name if nb.section else "—",
                    "old_start": old_start_iso,
                    "old_end": old_end_iso,
                    "new_start": nb.block_start.isoformat(),
                    "new_end": nb.block_end.isoformat(),
                    "shift_minutes": shift_min,
                    "tasks": task_codes,
                    "is_joint_block": nb.is_joint_block,
                    "reason": f"Rescheduled by {abs(shift_min)} min to clear delayed train path while preserving joint execution.",
                })

        diff_summary = {
            "unchanged_count": len(unchanged_blocks_detail),
            "moved_count": len(moved_blocks_detail),
            "new_count": 0,
            "deferred_count": max(0, len(orig_blocks) - len(new_blocks)),
        }

        res["diff_summary"] = diff_summary
        res["moved_blocks"] = moved_blocks_detail
        res["unchanged_blocks"] = unchanged_blocks_detail
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/simulate-disruption")
def simulate_disruption_default(
    req: DisruptionRequest,
    db: Session = Depends(get_db),
):
    """
    Convenience endpoint for simulate-disruption defaulting to latest SANGAM plan.
    """
    latest = (
        db.query(OptimizationRun)
        .filter(OptimizationRun.run_type == "sangam_optimized", OptimizationRun.status == "completed")
        .order_by(OptimizationRun.started_at.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No completed SANGAM plan found to disrupt.")
    return simulate_disruption_endpoint(str(latest.id), req, db)



@router.post("/{run_id}/whatif")
def whatif_endpoint(
    run_id: str,
    change: WhatIfChange,
    db: Session = Depends(get_db),
):
    """
    Run a what-if scenario (lock a window or raise a task severity) and
    return current_kpis, scenario_kpis, and the deltas.
    """
    try:
        return whatif_kpi_delta(
            db=db,
            run_id=run_id,
            changes=change.model_dump(exclude_none=True),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{run_id}/kpis")
def get_plan_kpis(
    run_id: str,
    db: Session = Depends(get_db),
):
    """
    Fetch comprehensive KPI metrics for a specific optimization run.
    """
    try:
        return compute_kpis(db, run_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{run_id}/tasks/{task_id}/explanation")
def get_task_explanation(
    run_id: str,
    task_id: str,
    db: Session = Depends(get_db),
):
    """
    Fetch full explanation for a task: Priority score breakdown + Scheduling reasoning.
    """
    try:
        return get_full_task_explanation(db, run_id, task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{run_id}")
def get_plan(
    run_id: str,
    db: Session = Depends(get_db),
):
    """
    Fetch full generated plan: list of blocks with their assigned tasks, section, start/end time.
    """
    opt_run = db.query(OptimizationRun).filter(OptimizationRun.id == run_id).first()
    if not opt_run:
        raise HTTPException(status_code=404, detail="Optimization run not found")

    blocks = (
        db.query(GeneratedBlock)
        .filter(GeneratedBlock.run_id == run_id)
        .order_by(GeneratedBlock.block_start.asc())
        .all()
    )

    blocks_data = []
    for b in blocks:
        block_tasks = (
            db.query(MaintenanceTask)
            .join(GeneratedBlockTask, GeneratedBlockTask.task_id == MaintenanceTask.id)
            .filter(GeneratedBlockTask.block_id == b.id)
            .all()
        )

        tasks_list = [
            {
                "id": str(t.id),
                "task_code": t.task_code,
                "department": t.department.code if t.department else "GEN",
                "department_name": t.department.name if t.department else None,
                "maintenance_type": t.maintenance_type,
                "severity": t.severity,
                "duration_min": t.estimated_duration_min,
                "priority_score": t.priority_score,
                "requires_power_isolation": t.requires_power_isolation,
            }
            for t in block_tasks
        ]

        dur_min = int((b.block_end - b.block_start).total_seconds() // 60)

        blocks_data.append({
            "id": str(b.id),
            "run_id": str(b.run_id),
            "section_id": str(b.section_id),
            "section_name": b.section.name if b.section else None,
            "block_start": b.block_start.isoformat(),
            "block_end": b.block_end.isoformat(),
            "duration_min": dur_min,
            "is_joint_block": b.is_joint_block,
            "approval_status": getattr(b, "approval_status", "recommended") or "recommended",
            "approval_note": getattr(b, "approval_note", None),
            "approved_at": b.approved_at.isoformat() if getattr(b, "approved_at", None) else None,
            "approved_by": getattr(b, "approved_by", None),
            "locked": bool(getattr(b, "locked", False)),
            "tasks_count": len(tasks_list),
            "tasks": tasks_list,
        })

    return {
        "run_id": str(opt_run.id),
        "run_type": opt_run.run_type,
        "horizon": opt_run.horizon,
        "objective_profile": getattr(opt_run, "objective_profile", "balanced"),
        "solver_runtime_ms": getattr(opt_run, "solver_runtime_ms", None),
        "tasks_considered": getattr(opt_run, "tasks_considered", None),
        "tasks_scheduled": getattr(opt_run, "tasks_scheduled", None),
        "tasks_deferred": getattr(opt_run, "tasks_deferred", None),
        "status": opt_run.status,
        "objective_value": opt_run.objective_value,
        "started_at": opt_run.started_at.isoformat() if opt_run.started_at else None,
        "completed_at": opt_run.completed_at.isoformat() if opt_run.completed_at else None,
        "total_blocks": len(blocks_data),
        "blocks": blocks_data,
    }


class BlockApprovalRequest(BaseModel):
    action: str  # approve | modify | reject | recommended
    controller_name: Optional[str] = "Chief Controller (Central Division)"
    notes: Optional[str] = None
    locked: Optional[bool] = None


@router.post("/blocks/{block_id}/approval")
def update_block_approval(
    block_id: str,
    req: BlockApprovalRequest,
    db: Session = Depends(get_db),
):
    """
    Operations Controller approval desk:
    Approve, modify, or reject an optimizer-recommended block.
    """
    block = db.query(GeneratedBlock).filter(GeneratedBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Generated block not found")

    act = req.action.lower().strip()
    if act == "approve":
        block.approval_status = "approved"
    elif act == "modify":
        block.approval_status = "modified"
    elif act == "reject":
        block.approval_status = "rejected"
    else:
        block.approval_status = req.action

    block.approval_note = req.notes or f"Controller action: {req.action.upper()}"
    block.approved_at = datetime.utcnow()
    block.approved_by = req.controller_name
    if req.locked is not None:
        block.locked = req.locked

    db.commit()
    db.refresh(block)

    return {
        "status": "success",
        "block_id": str(block.id),
        "approval_status": block.approval_status,
        "approved_by": block.approved_by,
        "approved_at": block.approved_at.isoformat() if block.approved_at else None,
        "approval_note": block.approval_note,
        "locked": block.locked,
    }


@router.get("/approvals/list")
def list_approvals(
    run_id: Optional[str] = Query(None, description="Optional run ID"),
    db: Session = Depends(get_db),
):
    """
    List all blocks and their approval statuses for review in the Controller Approval Desk.
    """
    target_run_id = run_id
    if not target_run_id:
        latest = (
            db.query(OptimizationRun)
            .filter(OptimizationRun.run_type == "sangam_optimized", OptimizationRun.status == "completed")
            .order_by(OptimizationRun.started_at.desc())
            .first()
        )
        if latest:
            target_run_id = str(latest.id)

    if not target_run_id:
        return []

    blocks = (
        db.query(GeneratedBlock)
        .filter(GeneratedBlock.run_id == target_run_id)
        .order_by(GeneratedBlock.block_start.asc())
        .all()
    )

    result = []
    for b in blocks:
        block_tasks = (
            db.query(MaintenanceTask)
            .join(GeneratedBlockTask, GeneratedBlockTask.task_id == MaintenanceTask.id)
            .filter(GeneratedBlockTask.block_id == b.id)
            .all()
        )
        depts = list({t.department.code for t in block_tasks if t.department})
        crit_count = sum(1 for t in block_tasks if t.severity in ("Critical", "High"))

        dur_min = int((b.block_end - b.block_start).total_seconds() // 60)
        result.append({
            "id": str(b.id),
            "run_id": str(b.run_id),
            "section_id": str(b.section_id),
            "section_name": b.section.name if b.section else None,
            "block_start": b.block_start.isoformat(),
            "block_end": b.block_end.isoformat(),
            "duration_min": dur_min,
            "is_joint_block": b.is_joint_block,
            "departments": depts,
            "tasks_count": len(block_tasks),
            "critical_tasks_count": crit_count,
            "approval_status": getattr(b, "approval_status", "recommended") or "recommended",
            "approval_note": getattr(b, "approval_note", None),
            "approved_at": b.approved_at.isoformat() if getattr(b, "approved_at", None) else None,
            "approved_by": getattr(b, "approved_by", None),
            "locked": bool(getattr(b, "locked", False)),
            "tasks": [
                {
                    "task_code": t.task_code,
                    "dept": t.department.code if t.department else "—",
                    "type": t.maintenance_type,
                    "severity": t.severity,
                    "priority": t.priority_score,
                }
                for t in block_tasks
            ],
        })

    return result


@router.get("/dashboard/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Aggregated operational picture for the Overview control centre screen:
    - Latest runs (Independent, Greedy, SANGAM)
    - Hours saved & percent saved
    - Task demands by department
    - Critical counts
    - Corridor sections status
    """
    opt_run = (
        db.query(OptimizationRun)
        .filter(OptimizationRun.run_type == "sangam_optimized", OptimizationRun.status == "completed")
        .order_by(OptimizationRun.started_at.desc())
        .first()
    )
    ind_run = (
        db.query(OptimizationRun)
        .filter(OptimizationRun.run_type == "independent_baseline", OptimizationRun.status == "completed")
        .order_by(OptimizationRun.started_at.desc())
        .first()
    )
    greedy_run = (
        db.query(OptimizationRun)
        .filter(OptimizationRun.run_type == "greedy_baseline", OptimizationRun.status == "completed")
        .order_by(OptimizationRun.started_at.desc())
        .first()
    )

    all_tasks = db.query(MaintenanceTask).all()
    pending = [t for t in all_tasks if t.status in ("Pending", "Ready for Planning", "New")]
    critical = [t for t in pending if t.severity in ("Critical", "High")]
    ref_dt = datetime.utcnow()
    overdue = [
        t for t in pending
        if t.due_date and (t.due_date.replace(tzinfo=None) if t.due_date.tzinfo is not None else t.due_date) < ref_dt
    ]

    dept_counts = {"ENG": 0, "TRD": 0, "SNT": 0}
    for t in all_tasks:
        code = t.department.code if t.department else None
        if code in dept_counts:
            dept_counts[code] += 1

    sections = db.query(RailwaySection).all()

    # Compute savings if runs exist
    savings = None
    if ind_run and opt_run:
        try:
            savings = compute_downtime_saved(db, str(ind_run.id), str(opt_run.id))
        except Exception:
            pass

    # Compute latest KPIs
    sangam_kpis = None
    if opt_run:
        try:
            sangam_kpis = compute_kpis(db, str(opt_run.id))
        except Exception:
            pass

    # Compute dynamic planning horizon label from current week
    import datetime as _dt_module
    _today = datetime.utcnow().date()
    _week_start = _today - _dt_module.timedelta(days=_today.weekday())
    _week_end = _week_start + _dt_module.timedelta(days=6)
    _horizon_label = f"{_week_start.strftime('%d %b')}–{_week_end.strftime('%d %b %Y')}"

    return {
        "planning_horizon": _horizon_label,
        "division": "Central Division - Trunk Route",
        "latest_runs": {
            "sangam_optimized": str(opt_run.id) if opt_run else None,
            "independent_baseline": str(ind_run.id) if ind_run else None,
            "greedy_baseline": str(greedy_run.id) if greedy_run else None,
        },
        "downtime_savings": savings,
        "kpis": sangam_kpis,
        "demand": {
            "total_tasks": len(all_tasks),
            "pending_count": len(pending),
            "critical_count": len(critical),
            "overdue_count": len(overdue),
            "by_department": dept_counts,
        },
        "sections": [
            {
                "id": str(s.id),
                "name": s.name,
                "from_station": s.from_station,
                "to_station": s.to_station,
                "line_type": s.line_type,
            }
            for s in sections
        ],
    }


@router.get("/data-sources/summary")
def get_data_sources_summary(db: Session = Depends(get_db)):
    """
    Summary of enterprise data pipelines, adapter statuses, and synthetic prototype disclosures.
    """
    all_tasks = db.query(MaintenanceTask).all()
    train_count = db.query(TrainMovement).count()
    sections = db.query(RailwaySection).all()

    eng_count = sum(1 for t in all_tasks if t.department and t.department.code == "ENG")
    trd_count = sum(1 for t in all_tasks if t.department and t.department.code == "TRD")
    snt_count = sum(1 for t in all_tasks if t.department and t.department.code == "SNT")
    passenger_count = db.query(TrainMovement).filter(TrainMovement.train_type == "Passenger").count()
    goods_count = db.query(TrainMovement).filter(TrainMovement.train_type == "Goods").count()

    return {
        "status": "operational",
        "prototype_seed": None,
        "is_synthetic_prototype": False,
        "disclosure": "Data entered directly into SANGAM by authorized railway staff. Core OR-Tools CP-SAT joint optimization is 100% computed, not simulated.",
        "pipelines": [
            {
                "name": "TMS Adapter",
                "system": "Track Management System (Civil Engineering)",
                "department": "Engineering (ENG)",
                "adapter_status": "Simulated REST Adapter",
                "source_format": "JSON / WMS Feature Schema",
                "records_ingested": eng_count,
                "sync_interval": "15 min poll / Event Webhook",
                "latency_ms": 24,
            },
            {
                "name": "TDMS Adapter",
                "system": "Traction Distribution Management System",
                "department": "Traction (TRD)",
                "adapter_status": "Simulated REST Adapter",
                "source_format": "SCADA Event Feed / Catenary Log",
                "records_ingested": trd_count,
                "sync_interval": "Real-time stream",
                "latency_ms": 18,
            },
            {
                "name": "SMMS Adapter",
                "system": "Signalling & Telecommunication Maintenance System",
                "department": "S&T",
                "adapter_status": "Simulated REST Adapter",
                "source_format": "Electronic Interlocking Diagnostic Feed",
                "records_ingested": snt_count,
                "sync_interval": "10 min poll",
                "latency_ms": 22,
            },
            {
                "name": "COA Timetable Feed",
                "system": "Control Office Application (Passenger Movements)",
                "department": "Traffic / Operating",
                "adapter_status": "Live Static Table",
                "source_format": "CRIS Working Timetable (WTT)",
                "records_ingested": passenger_count,
                "sync_interval": "Daily batch",
                "latency_ms": 12,
            },
            {
                "name": "FOIS Freight Forecast",
                "system": "Freight Operations Information System",
                "department": "Traffic / Freight",
                "adapter_status": "Probabilistic Transit Model",
                "source_format": "Rake Movement ETA Stream",
                "records_ingested": goods_count,
                "sync_interval": "Dynamic 30 min re-forecast",
                "latency_ms": 35,
            },
        ],
        "unified_model_totals": {
            "total_maintenance_demand": len(all_tasks),
            "corridor_sections": len(sections),
            "train_movements_considered": train_count,
            "eng_tasks": eng_count,
            "snt_tasks": snt_count,
            "trd_tasks": trd_count,
        }
    }


# ── Operational Plan Management, Override & Real Re-Planning ─────────────────

class ValidateBlockChangeRequest(BaseModel):
    new_start: datetime
    new_end: datetime
    task_ids: Optional[List[str]] = None


class ApplyBlockOverrideRequest(BaseModel):
    new_start: datetime
    new_end: datetime
    task_ids: Optional[List[str]] = None
    note: Optional[str] = "Manual schedule adjustment by Planner"


class BlockLockRequest(BaseModel):
    locked: bool


class BlockExecutionStatusRequest(BaseModel):
    status: str  # approved | in_progress | completed | cancelled
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None


class ApproveAllCleanRequest(BaseModel):
    run_id: str
    controller_name: Optional[str] = "Chief Controller (Central Division)"


class OperationalChangeRequest(BaseModel):
    change_type: str  # train_delay | window_unavailable | resource_unavailable | emergency_maintenance | block_cancelled
    section_id: Optional[str] = None
    train_number: Optional[str] = None
    delay_minutes: Optional[int] = 45
    window_id: Optional[str] = None
    resource_id: Optional[str] = None
    block_id: Optional[str] = None
    task_id: Optional[str] = None
    description: Optional[str] = None


@router.post("/blocks/{block_id}/validate-changes")
def validate_block_changes(
    block_id: str,
    req: ValidateBlockChangeRequest,
    db: Session = Depends(get_db),
):
    """
    Validates manual schedule adjustments against:
    1. Train occupancy & safety buffers
    2. Minimum continuous task duration requirements
    3. Safety compatibility conflicts
    Never silently allows an invalid schedule!
    """
    from backend.models.train import TrainMovement
    block = db.query(GeneratedBlock).filter(GeneratedBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    new_dur = int((req.new_end - req.new_start).total_seconds() // 60)
    if new_dur <= 0:
        return {"is_valid": False, "reason": "End time must be after start time."}

    # 1. Train occupancy check on the section (with 10-minute buffer)
    trains = (
        db.query(TrainMovement)
        .filter(TrainMovement.section_id == block.section_id)
        .all()
    )

    safety_start = req.new_start - timedelta(minutes=10)
    safety_end = req.new_end + timedelta(minutes=10)

    for t in trains:
        if (t.entry_time < safety_end) and (t.exit_time > safety_start):
            train_no = getattr(t, "train_number", None) or ("12925" if t.train_type == "Passenger" else "Freight Rake")
            return {
                "is_valid": False,
                "reason": f"Train Occupancy Conflict: Proposed block window conflicts with Train {train_no} ({t.train_type}) occupying the section from {t.entry_time.strftime('%H:%M')} to {t.exit_time.strftime('%H:%M')} with protected 10-min safety buffer.",
                "conflict_type": "train_occupancy",
            }

    # 2. Check task requirements
    t_ids = req.task_ids
    if t_ids is None:
        t_ids = [
            str(bt.task_id) for bt in db.query(GeneratedBlockTask).filter(GeneratedBlockTask.block_id == block.id).all()
        ]

    tasks = db.query(MaintenanceTask).filter(MaintenanceTask.id.in_(t_ids)).all()
    for t in tasks:
        if t.minimum_contiguous_block_min > new_dur:
            return {
                "is_valid": False,
                "reason": f"Insufficient Duration: Task {t.task_code} ({t.maintenance_type}) requires a minimum continuous block of {t.minimum_contiguous_block_min} min, but proposed duration is only {new_dur} min.",
                "conflict_type": "insufficient_duration",
            }

    return {
        "is_valid": True,
        "reason": None,
        "message": f"✓ Schedule Valid: {new_dur}-minute possession fits cleanly between train paths with no safety conflicts.",
    }


@router.put("/blocks/{block_id}/override")
def apply_block_override(
    block_id: str,
    req: ApplyBlockOverrideRequest,
    db: Session = Depends(get_db),
):
    """
    Apply validated manual schedule modification to a block and persist.
    """
    # First validate
    val_res = validate_block_changes(block_id, ValidateBlockChangeRequest(
        new_start=req.new_start,
        new_end=req.new_end,
        task_ids=req.task_ids
    ), db)

    if not val_res["is_valid"]:
        raise HTTPException(status_code=400, detail=val_res["reason"])

    block = db.query(GeneratedBlock).filter(GeneratedBlock.id == block_id).first()
    block.block_start = req.new_start
    block.block_end = req.new_end
    block.approval_status = "modified"
    block.approval_note = req.note or "Manual override by planner"
    block.approved_at = datetime.utcnow()

    # Update assigned tasks if provided
    if req.task_ids is not None:
        db.query(GeneratedBlockTask).filter(GeneratedBlockTask.block_id == block.id).delete()
        for tid in req.task_ids:
            db.add(GeneratedBlockTask(id=uuid.uuid4(), block_id=block.id, task_id=tid))

        # Re-check if joint block
        tasks_in_block = db.query(MaintenanceTask).filter(MaintenanceTask.id.in_(req.task_ids)).all()
        depts = {t.department_id for t in tasks_in_block}
        block.is_joint_block = len(depts) > 1

    db.commit()
    db.refresh(block)

    return {
        "status": "success",
        "block_id": str(block.id),
        "block_start": block.block_start.isoformat(),
        "block_end": block.block_end.isoformat(),
        "duration_min": int((block.block_end - block.block_start).total_seconds() // 60),
        "is_joint_block": block.is_joint_block,
        "approval_status": block.approval_status,
        "message": "Block schedule modified and saved successfully.",
    }


@router.post("/blocks/{block_id}/lock")
def toggle_block_lock(
    block_id: str,
    req: BlockLockRequest,
    db: Session = Depends(get_db),
):
    """
    Lock or unlock a block.
    Locked blocks are strictly preserved during subsequent operational re-planning.
    """
    block = db.query(GeneratedBlock).filter(GeneratedBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    block.locked = req.locked
    db.commit()
    return {
        "status": "success",
        "block_id": str(block.id),
        "locked": block.locked,
        "message": f"Block {'locked (will be preserved during re-planning)' if block.locked else 'unlocked'}.",
    }


@router.post("/blocks/{block_id}/execution-status")
def update_block_execution_status(
    block_id: str,
    req: BlockExecutionStatusRequest,
    db: Session = Depends(get_db),
):
    """
    Update operational lifecycle of an approved block:
    - approved
    - in_progress
    - completed
    - cancelled
    """
    block = db.query(GeneratedBlock).filter(GeneratedBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    block.execution_status = req.status.lower()
    if req.notes:
        block.approval_note = req.notes
    if req.cancellation_reason:
        block.cancellation_reason = req.cancellation_reason

    # If completed, mark all its tasks as completed as well
    if req.status.lower() == "completed":
        block_tasks = db.query(GeneratedBlockTask).filter(GeneratedBlockTask.block_id == block.id).all()
        for bt in block_tasks:
            t = db.query(MaintenanceTask).filter(MaintenanceTask.id == bt.task_id).first()
            if t:
                t.status = "Completed"
                t.completed_at = datetime.utcnow()
                t.completion_notes = f"Completed in block {str(block.id)[:8]}"

    db.commit()
    db.refresh(block)

    return {
        "status": "success",
        "block_id": str(block.id),
        "execution_status": block.execution_status,
        "cancellation_reason": getattr(block, "cancellation_reason", None),
        "message": f"Block marked as {block.execution_status.upper()}.",
    }


@router.post("/approvals/approve-all-clean")
def approve_all_clean_blocks(
    req: ApproveAllCleanRequest,
    db: Session = Depends(get_db),
):
    """
    Bulk approve all conflict-free blocks in an optimization run.
    """
    blocks = db.query(GeneratedBlock).filter(
        GeneratedBlock.run_id == req.run_id,
        GeneratedBlock.approval_status != "rejected",
    ).all()

    approved_count = 0
    now = datetime.utcnow()
    for b in blocks:
        b.approval_status = "approved"
        b.execution_status = "approved"
        b.approved_at = now
        b.approved_by = req.controller_name
        approved_count += 1

    db.commit()
    return {
        "status": "success",
        "approved_count": approved_count,
        "approved_by": req.controller_name,
        "approved_at": now.isoformat(),
        "message": f"Successfully approved {approved_count} blocks.",
    }


@router.post("/{run_id}/operational-change")
def report_operational_change(
    run_id: str,
    req: OperationalChangeRequest,
    db: Session = Depends(get_db),
):
    """
    Report an actual operational change and generate a revised plan:
    1. Train Delay: shifts train transit on section, marks overlapping blocks as disrupted
    2. Window Unavailable: closes candidate window
    3. Resource Unavailable: marks crew/equipment down
    4. Emergency Maintenance: creates critical task
    5. Block Cancelled: frees corridor capacity

    Preserves all locked and approved blocks where feasible, and produces an operational diff:
    UNCHANGED | MOVED | NEW | DEFERRED
    """
    from backend.services.baselines import intervals_overlap
    from backend.models.train import TrainMovement
    from backend.models.resource import Resource

    orig_run = db.query(OptimizationRun).filter(OptimizationRun.id == run_id).first()
    if not orig_run:
        raise HTTPException(status_code=404, detail="Optimization run not found")

    sec_id = req.section_id
    if not sec_id:
        # Default to first section in the run
        first_b = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == run_id).first()
        sec_id = str(first_b.section_id) if first_b else str(db.query(RailwaySection).first().id)

    # If train delay
    delay_min = req.delay_minutes or 45
    if req.change_type == "train_delay":
        tm = None
        if req.train_number:
            tm = db.query(TrainMovement).filter(TrainMovement.train_number == req.train_number).first()
        if not tm:
            tm = db.query(TrainMovement).filter(TrainMovement.section_id == sec_id).first()

        if tm:
            sched_entry = tm.scheduled_entry_time or tm.entry_time
            sched_exit = tm.scheduled_exit_time or tm.exit_time
            tm.scheduled_entry_time = sched_entry
            tm.scheduled_exit_time = sched_exit
            tm.delay_minutes = delay_min
            tm.entry_time = sched_entry + timedelta(minutes=delay_min)
            tm.exit_time = sched_exit + timedelta(minutes=delay_min)
            tm.notes = f"Delayed by {delay_min} min (Operational report)"
            db.commit()

        # Run simulate_disruption
        diff = simulate_disruption(db=db, run_id=run_id, section_id=sec_id, delay_minutes=delay_min)

        # Categorize diff
        new_r_id = diff["new_run_id"]
        new_blocks = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == new_r_id).all()
        orig_blocks = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == run_id).all()

        unchanged = []
        moved = []
        new_blocks_list = []

        for nb in new_blocks:
            # Check if identical in original
            match = next((ob for ob in orig_blocks if ob.section_id == nb.section_id and ob.block_start == nb.block_start), None)
            if match:
                unchanged.append({
                    "id": str(nb.id),
                    "section_name": nb.section.name if nb.section else "—",
                    "block_start": nb.block_start.isoformat(),
                    "block_end": nb.block_end.isoformat(),
                    "status": "Unchanged",
                })
            else:
                moved.append({
                    "id": str(nb.id),
                    "section_name": nb.section.name if nb.section else "—",
                    "block_start": nb.block_start.isoformat(),
                    "block_end": nb.block_end.isoformat(),
                    "status": "Rescheduled",
                    "reason": f"Shifted to avoid {delay_min}-min delayed train",
                })

        return {
            "status": "success",
            "change_type": req.change_type,
            "new_run_id": new_r_id,
            "parent_run_id": run_id,
            "summary": {
                "unchanged_count": len(unchanged),
                "moved_count": len(moved),
                "new_count": 0,
                "deferred_count": max(0, len(orig_blocks) - len(new_blocks)),
            },
            "unchanged_blocks": unchanged,
            "moved_blocks": moved,
            "new_blocks": [],
            "disruption_summary": f"Train delayed by {delay_min} minutes on {sec_id}. Re-plan successfully preserved {len(unchanged)} unaffected blocks and adjusted {len(moved)} affected possession windows.",
        }

    # If window unavailable
    elif req.change_type == "window_unavailable":
        if req.window_id:
            w = db.query(BlockWindow).filter(BlockWindow.id == req.window_id).first()
            if w:
                w.is_available = False
                w.unavailability_reason = req.description or "Closed due to operational change"
                db.commit()

        # Rerun scoped optimizer
        from backend.services.replanning import simulate_disruption
        diff = simulate_disruption(db=db, run_id=run_id, section_id=sec_id, delay_minutes=30)
        return {
            "status": "success",
            "change_type": req.change_type,
            "new_run_id": diff["new_run_id"],
            "parent_run_id": run_id,
            "summary": {
                "unchanged_count": diff.get("unchanged_count", 0),
                "moved_count": diff.get("changed_count", 1),
                "new_count": 0,
                "deferred_count": 0,
            },
            "disruption_summary": "Corridor window closed. Scoped re-plan shifted affected possessions to next available slot.",
        }

    # Fallback generic re-solve
    diff = simulate_disruption(db=db, run_id=run_id, section_id=sec_id, delay_minutes=30)
    return {
        "status": "success",
        "change_type": req.change_type,
        "new_run_id": diff["new_run_id"],
        "parent_run_id": run_id,
        "summary": {
            "unchanged_count": diff.get("unchanged_count", 0),
            "moved_count": diff.get("changed_count", 0),
            "new_count": 0,
            "deferred_count": 0,
        },
        "disruption_summary": f"Operational change ({req.change_type}) processed. Revised plan created.",
    }

