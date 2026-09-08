from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter

router = APIRouter(prefix="/api/rules", tags=["Planning Rules"])

DEFAULT_RULES = {
    # HARD RULES (Cannot be violated by safety standards)
    "min_train_buffer_min": 10,
    "min_block_duration_min": 20,
    "enforce_power_isolation_separation": True,
    "max_continuous_block_hours": 4.5,
    # PLANNING PREFERENCES (Optimizer objective functions)
    "critical_task_deadline_priority": "High",  # High | Extreme | Standard
    "prefer_joint_work": True,
    "avoid_passenger_peak": True,  # 06:00–10:00 & 17:00–21:00
    "plan_stability_preference": True,
    "freight_uncertainty_threshold": 0.35,
    "last_updated": "2026-09-08T00:00:00Z",
    "updated_by": "System Default (RDSO Standards)",
}

CURRENT_RULES = dict(DEFAULT_RULES)


class RulesUpdate(BaseModel):
    min_train_buffer_min: Optional[int] = None
    min_block_duration_min: Optional[int] = None
    enforce_power_isolation_separation: Optional[bool] = None
    max_continuous_block_hours: Optional[float] = None
    critical_task_deadline_priority: Optional[str] = None
    prefer_joint_work: Optional[bool] = None
    avoid_passenger_peak: Optional[bool] = None
    plan_stability_preference: Optional[bool] = None
    freight_uncertainty_threshold: Optional[float] = None
    updated_by: Optional[str] = "Chief Controller (Central Division)"


@router.get("")
def get_rules():
    """
    Get active operational rules and optimizer preferences.
    """
    return {
        "status": "success",
        "hard_rules": {
            "min_train_buffer_min": {
                "value": CURRENT_RULES["min_train_buffer_min"],
                "unit": "minutes",
                "description": "Minimum safety buffer before and after train movements",
                "is_hard_rule": True,
            },
            "min_block_duration_min": {
                "value": CURRENT_RULES["min_block_duration_min"],
                "unit": "minutes",
                "description": "Minimum usable corridor window for maintenance possession",
                "is_hard_rule": True,
            },
            "enforce_power_isolation_separation": {
                "value": CURRENT_RULES["enforce_power_isolation_separation"],
                "unit": "boolean",
                "description": "Block work requiring OHE 25kV power cut must not coexist with active electric traction",
                "is_hard_rule": True,
            },
            "max_continuous_block_hours": {
                "value": CURRENT_RULES["max_continuous_block_hours"],
                "unit": "hours",
                "description": "Maximum single corridor possession duration permitted without clearance interval",
                "is_hard_rule": True,
            },
        },
        "planning_preferences": {
            "critical_task_deadline_priority": {
                "value": CURRENT_RULES["critical_task_deadline_priority"],
                "description": "Weight multiplier applied to overdue/critical safety tasks in CP-SAT",
            },
            "prefer_joint_work": {
                "value": CURRENT_RULES["prefer_joint_work"],
                "description": "Multi-department bonus to converge Engineering, TRD, and S&T tasks into single possession",
            },
            "avoid_passenger_peak": {
                "value": CURRENT_RULES["avoid_passenger_peak"],
                "description": "Penalize block scheduling during morning (06-10) and evening (17-21) peak traffic hours",
            },
            "plan_stability_preference": {
                "value": CURRENT_RULES["plan_stability_preference"],
                "description": "Re-planning penalty for altering already locked or scheduled blocks",
            },
            "freight_uncertainty_threshold": {
                "value": CURRENT_RULES["freight_uncertainty_threshold"],
                "description": "Safety margin added for unscheduled freight train transit forecasts",
            },
        },
        "metadata": {
            "last_updated": CURRENT_RULES["last_updated"],
            "updated_by": CURRENT_RULES["updated_by"],
        },
    }


@router.put("")
def update_rules(payload: RulesUpdate):
    """
    Update operational rules and preferences.
    """
    from datetime import datetime
    for k, v in payload.model_dump(exclude_none=True).items():
        if k in CURRENT_RULES:
            CURRENT_RULES[k] = v
    CURRENT_RULES["last_updated"] = datetime.utcnow().isoformat()
    CURRENT_RULES["updated_by"] = payload.updated_by or "Chief Controller"
    return {"status": "success", "message": "Planning rules updated successfully"}


@router.post("/reset")
def reset_rules():
    """
    Restore RDSO default planning rules.
    """
    global CURRENT_RULES
    CURRENT_RULES = dict(DEFAULT_RULES)
    return {"status": "success", "message": "Planning rules restored to RDSO defaults"}


@router.post("/reset-operational-data")
def reset_db_operational_data(keep_sections: bool = False):
    """
    Developer/Admin action: Clears all operational records (tasks, trains, windows, resources, runs)
    leaving a completely clean, empty state.
    """
    from backend.scripts.reset_operational_data import reset_operational_data
    reset_operational_data(keep_sections=keep_sections)
    return {"status": "success", "message": "Operational database reset to clean empty state."}

