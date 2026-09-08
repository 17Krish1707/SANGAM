import os
import json
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models.task import MaintenanceTask

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "../config/priority_weights.json")

DEFAULT_WEIGHTS = {
    "criticality": 0.30,
    "overdue_severity": 0.25,
    "safety_consequence": 0.20,
    "asset_importance": 0.15,
    "failure_risk": 0.10,
}

CRITICALITY_MAP = {
    "Low": 0.25,
    "Medium": 0.50,
    "High": 0.75,
    "Critical": 1.00,
}


def load_priority_weights() -> Dict[str, float]:
    """Load configurable weights from JSON config file or fallback to defaults."""
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return DEFAULT_WEIGHTS.copy()
    return DEFAULT_WEIGHTS.copy()


def compute_task_features(
    task: MaintenanceTask,
    reference_date: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Compute normalized 0-1 feature values for each factor in the explainable formula.
    """
    ref_dt = reference_date or datetime(2026, 9, 7, 8, 0, 0)

    # 1. Criticality: Low=0.25, Medium=0.5, High=0.75, Critical=1.0
    crit_val = CRITICALITY_MAP.get(task.severity, 0.50)

    # 2. Overdue Severity: max(0, (today - due_date).days) / 30, capped at 1.0
    if task.due_date and task.due_date < ref_dt:
        overdue_days = (ref_dt.date() - task.due_date.date()).days
        overdue_val = min(1.0, max(0.0, overdue_days / 30.0))
    else:
        overdue_days = 0
        overdue_val = 0.0

    # 3. Safety Consequence: 1.0 if requires_power_isolation else 0.4 if High/Critical else 0.2
    if task.requires_power_isolation:
        safety_val = 1.00
        safety_detail = "Requires Traction Power Isolation (High Voltage Safety)"
    elif task.severity in ("High", "Critical"):
        safety_val = 0.40
        safety_detail = f"High Severity Operation ({task.severity})"
    else:
        safety_val = 0.20
        safety_detail = "Standard Line Maintenance (Low Safety Impact)"

    # 4. Asset Importance: 1.0 if Critical, 0.6 if Degraded, 0.3 if Good
    asset_health = task.asset.health_state if task.asset else "Good"
    if asset_health == "Critical":
        asset_val = 1.00
    elif asset_health == "Degraded":
        asset_val = 0.60
    else:
        asset_val = 0.30

    # 5. Failure Risk: Heuristic proxy = criticality * overdue_severity
    failure_val = round(crit_val * overdue_val, 4)

    return {
        "criticality": {
            "value": crit_val,
            "detail": f"Task Severity: {task.severity}",
        },
        "overdue_severity": {
            "value": overdue_val,
            "detail": f"{overdue_days} days overdue" if overdue_days > 0 else "On schedule (Not overdue)",
        },
        "safety_consequence": {
            "value": safety_val,
            "detail": safety_detail,
        },
        "asset_importance": {
            "value": asset_val,
            "detail": f"Target Asset Health: {asset_health}",
        },
        "failure_risk": {
            "value": failure_val,
            "detail": "Deterministic proxy (Criticality x Overdue Severity)",
        },
    }


def compute_priority_score(
    task: MaintenanceTask,
    weights: Optional[Dict[str, float]] = None,
    reference_date: Optional[datetime] = None,
) -> float:
    """
    Compute priority score on a 0-100 scale:
    Priority_i = w1*Criticality + w2*OverdueSeverity + w3*SafetyConsequence + w4*AssetImportance + w5*FailureRisk
    Multiplied by 100.
    """
    w = weights or load_priority_weights()
    features = compute_task_features(task, reference_date=reference_date)

    weighted_sum = sum(features[factor]["value"] * w.get(factor, 0.2) for factor in w)
    return round(float(weighted_sum * 100.0), 2)


def get_priority_breakdown(
    task: MaintenanceTask,
    weights: Optional[Dict[str, float]] = None,
    reference_date: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Return individual weighted components for explainability panel.
    Returns real computed numbers, not placeholder text.
    """
    w = weights or load_priority_weights()
    features = compute_task_features(task, reference_date=reference_date)

    components = {}
    total_score = 0.0

    for factor, meta in features.items():
        weight = w.get(factor, 0.0)
        value = meta["value"]
        contribution = round(value * weight * 100.0, 2)
        total_score += contribution
        components[factor] = {
            "value": value,
            "weight": weight,
            "contribution": contribution,
            "detail": meta["detail"],
        }

    return {
        "task_id": str(task.id),
        "task_code": task.task_code,
        "priority_score": round(total_score, 2),
        "components": components,
    }


def recompute_all_priority_scores(
    db: Session,
    reference_date: Optional[datetime] = None,
) -> int:
    """
    Recompute priority_score for all maintenance tasks in the database and persist changes.
    """
    tasks = db.query(MaintenanceTask).all()
    weights = load_priority_weights()

    for task in tasks:
        score = compute_priority_score(task, weights=weights, reference_date=reference_date)
        task.priority_score = score

    db.commit()
    return len(tasks)
