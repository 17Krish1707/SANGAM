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

    start_dt = req.start_date or datetime(2026, 9, 7, 0, 0, 0)
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
    section_id: str
    delay_minutes: int = 45


class WhatIfChange(BaseModel):
    type: str                          # "lock_window" | "raise_severity"
    window_id: Optional[str] = None
    task_id:   Optional[str] = None
    new_severity: Optional[str] = None


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
        return simulate_disruption(
            db=db,
            run_id=run_id,
            section_id=req.section_id,
            delay_minutes=req.delay_minutes,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


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
    pending = [t for t in all_tasks if t.status == "Pending"]
    critical = [t for t in pending if t.severity in ("Critical", "High")]
    ref_dt = datetime(2026, 9, 7, 8, 0, 0)
    overdue = [t for t in pending if t.due_date and t.due_date < ref_dt]

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

    return {
        "planning_horizon": "07–13 September 2026",
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

    return {
        "status": "operational",
        "prototype_seed": 26027,
        "is_synthetic_prototype": True,
        "disclosure": "Maintenance demand and train movements are synthetically generated using fixed reproducible seed 26027 based on RDSO Indian Railways maintenance standards. Core OR-Tools CP-SAT joint optimization is 100% computed, not simulated.",
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
                "records_ingested": 60,
                "sync_interval": "Daily batch",
                "latency_ms": 12,
            },
            {
                "name": "FOIS Freight Forecast",
                "system": "Freight Operations Information System",
                "department": "Traffic / Freight",
                "adapter_status": "Probabilistic Transit Model",
                "source_format": "Rake Movement ETA Stream",
                "records_ingested": 20,
                "sync_interval": "Dynamic 30 min re-forecast",
                "latency_ms": 35,
            },
        ],
        "unified_model_totals": {
            "total_maintenance_demand": len(all_tasks),
            "corridor_sections": len(sections),
            "train_movements_considered": train_count,
        }
    }
