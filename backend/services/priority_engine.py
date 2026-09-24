import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models.task import MaintenanceTask

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "../config/priority_weights.json")

DEFAULT_WEIGHTS = {
    "criticality": 0.30,
    "urgency": 0.25,
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
                loaded = json.load(f)
                # Ensure urgency / overdue_severity mapping
                if "overdue_severity" in loaded and "urgency" not in loaded:
                    loaded["urgency"] = loaded["overdue_severity"]
                return loaded
        except Exception:
            return DEFAULT_WEIGHTS.copy()
    return DEFAULT_WEIGHTS.copy()


def compute_task_features(
    task: MaintenanceTask,
    reference_date: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Compute normalized 0-1 feature values for each factor in the explainable formula.
    Uses dynamic reference_date: defaults to current operational UTC time (no fixed 2026 date).
    """
    ref_dt = reference_date or datetime.now(timezone.utc).replace(tzinfo=None)
    if ref_dt.tzinfo is not None:
        ref_dt = ref_dt.replace(tzinfo=None)

    task_due = task.due_date
    if task_due and task_due.tzinfo is not None:
        task_due = task_due.replace(tzinfo=None)

    # 1. Defect Criticality: Low=0.25, Medium=0.50, High=0.75, Critical=1.00
    crit_val = CRITICALITY_MAP.get(task.severity, 0.50)

    # 2. Urgency: Both overdue and approaching due date (near-due)
    # A task due tomorrow must score significantly higher than one due in 20 days.
    if task_due:
        if task_due < ref_dt:
            overdue_days = max(1, (ref_dt.date() - task_due.date()).days)
            # Overdue tasks scale from 0.60 baseline up to 1.00 over 14 days
            urgency_val = min(1.00, 0.60 + 0.40 * min(1.0, overdue_days / 14.0))
            urgency_detail = f"{overdue_days} day(s) overdue (Immediate operational priority)"
            days_diff = -overdue_days
        else:
            days_until_due = max(0, (task_due.date() - ref_dt.date()).days)
            days_diff = days_until_due
            if days_until_due == 0:
                urgency_val = 0.55
                urgency_detail = "Due today within 24 hours (High operational urgency)"
            elif days_until_due == 1:
                urgency_val = 0.50
                urgency_detail = "Due tomorrow (High operational urgency)"
            elif days_until_due <= 3:
                urgency_val = 0.40
                urgency_detail = f"Due in {days_until_due} days (Approaching maintenance deadline)"
            elif days_until_due <= 7:
                urgency_val = 0.28
                urgency_detail = f"Due in {days_until_due} days (Planned weekly window)"
            elif days_until_due <= 14:
                urgency_val = 0.16
                urgency_detail = f"Due in {days_until_due} days (Scheduled maintenance)"
            else:
                urgency_val = max(0.04, round(0.50 / (1.0 + days_until_due / 4.0), 3))
                urgency_detail = f"Due in {days_until_due} days (Long-range maintenance demand)"
    else:
        urgency_val = 0.20
        urgency_detail = "No strict due date specified"
        days_diff = 14

    # 3. Safety Consequence: Higher when failure affects safe railway operation
    requires_power = getattr(task, "requires_power_isolation", False)
    requires_signal = getattr(task, "requires_signal_disconnection", False)
    requires_traffic = getattr(task, "requires_traffic_block", True)

    safety_score = 0.20  # baseline
    safety_factors = []
    if requires_power:
        safety_score += 0.45
        safety_factors.append("25 kV AC OHE Traction Isolation")
    if requires_signal:
        safety_score += 0.25
        safety_factors.append("S&T Interlocking Disconnection")
    if task.severity == "Critical":
        safety_score += 0.25
        safety_factors.append("Critical Defect Severity")
    elif task.severity == "High":
        safety_score += 0.15
        safety_factors.append("High Defect Severity")

    safety_val = min(1.00, safety_score)
    safety_detail = " + ".join(safety_factors) if safety_factors else "Standard Line Routine Maintenance"

    # 4. Asset Criticality / Availability Impact: Importance to corridor throughput
    asset_health = task.asset.health_state if task.asset else "Good"
    asset_type = ((task.asset.asset_type or "") if task.asset else "").lower()
    
    # Vital corridor assets (Turnouts, Interlocking, Cantilevers, Insulated Rail Joints)
    is_vital = any(v in asset_type for v in ["turnout", "point", "interlocking", "joint", "catenary", "cantilever", "crossover"])
    
    if asset_health == "Critical":
        asset_base = 0.90
    elif asset_health == "Degraded":
        asset_base = 0.65
    else:
        asset_base = 0.40

    if is_vital:
        asset_base = min(1.00, asset_base + 0.10)
    asset_val = round(asset_base, 2)
    asset_detail = f"Asset Health: {asset_health}" + (" (Vital Corridor Asset)" if is_vital else "")

    # 5. Failure / Deterioration Risk: Explainable heuristic with Prototype ML label
    # Deterioration accelerates if asset is already degraded and task is high severity or overdue
    raw_risk = 0.40 * crit_val + 0.40 * urgency_val + 0.20 * asset_val
    failure_val = round(min(1.00, raw_risk), 3)
    failure_detail = f"Prototype ML-assisted risk estimate ({int(failure_val * 100)}% degradation probability)"

    features = {
        "criticality": {
            "value": crit_val,
            "label": "Defect Criticality",
            "detail": f"Task Severity: {task.severity}",
        },
        "urgency": {
            "value": urgency_val,
            "label": "Urgency (Near-due / Overdue)",
            "detail": urgency_detail,
            "days_diff": days_diff,
        },
        "safety_consequence": {
            "value": safety_val,
            "label": "Safety Consequence",
            "detail": safety_detail,
        },
        "asset_importance": {
            "value": asset_val,
            "label": "Asset Criticality & Corridor Impact",
            "detail": asset_detail,
        },
        "failure_risk": {
            "value": failure_val,
            "label": "Failure Risk (Prototype ML)",
            "detail": failure_detail,
        },
    }
    # Backward compatibility alias
    features["overdue_severity"] = features["urgency"]
    return features


def compute_priority_score(
    task: MaintenanceTask,
    weights: Optional[Dict[str, float]] = None,
    reference_date: Optional[datetime] = None,
) -> float:
    """
    Compute priority score on a 0-100 scale:
    Priority = sum of rounded factor contributions to guarantee exact explainability matching.
    """
    w = (weights or load_priority_weights()).copy()
    # Normalize weights keys
    if "overdue_severity" in w and "urgency" not in w:
        w["urgency"] = w["overdue_severity"]

    features = compute_task_features(task, reference_date=reference_date)

    active_keys = ["criticality", "urgency", "safety_consequence", "asset_importance", "failure_risk"]
    total_score = sum(
        round(features[k]["value"] * w.get(k, DEFAULT_WEIGHTS.get(k, 0.20)) * 100.0, 1)
        for k in active_keys
    )
    return round(float(total_score), 1)


def generate_explainability_text(
    task: MaintenanceTask,
    score: float,
    features: Dict[str, Any],
) -> str:
    """Generate concise, natural railway-controller language explaining why the task has this priority."""
    band = get_priority_band(score)
    severity = task.severity
    days_diff = features["urgency"].get("days_diff", 0)
    requires_power = getattr(task, "requires_power_isolation", False)
    requires_signal = getattr(task, "requires_signal_disconnection", False)

    reasons = []
    if severity == "Critical":
        reasons.append("critical defect")
    elif severity == "High":
        reasons.append("high-severity maintenance")

    if days_diff < 0:
        reasons.append(f"is {abs(days_diff)} days overdue")
    elif days_diff == 0:
        reasons.append("is due today within 24 hours")
    elif days_diff == 1:
        reasons.append("is due tomorrow")
    elif days_diff <= 3:
        reasons.append(f"is due within {days_diff} days")

    if requires_power:
        reasons.append("requires 25 kV traction power isolation")
    elif requires_signal:
        reasons.append("requires S&T signal disconnection")

    if not reasons:
        return f"{band} priority (Score {score}/100) for standard scheduled maintenance on corridor asset."

    return f"{band} priority because this {' and '.join(reasons)}."


def get_priority_band(score: float) -> str:
    """Return priority tier string."""
    if score >= 80.0:
        return "Critical"
    elif score >= 60.0:
        return "High"
    elif score >= 40.0:
        return "Medium"
    return "Low"


def get_priority_breakdown(
    task: MaintenanceTask,
    weights: Optional[Dict[str, float]] = None,
    reference_date: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Return individual weighted components for explainability panel.
    Returns real computed numbers where contributions sum exactly to total score.
    """
    w = (weights or load_priority_weights()).copy()
    if "overdue_severity" in w and "urgency" not in w:
        w["urgency"] = w["overdue_severity"]

    features = compute_task_features(task, reference_date=reference_date)

    active_keys = ["criticality", "urgency", "safety_consequence", "asset_importance", "failure_risk"]
    components = {}
    total_score = 0.0

    for factor in active_keys:
        meta = features[factor]
        weight = w.get(factor, DEFAULT_WEIGHTS.get(factor, 0.20))
        value = meta["value"]
        contribution = round(value * weight * 100.0, 1)
        total_score += contribution
        components[factor] = {
            "value": round(value, 3),
            "weight": weight,
            "contribution": contribution,
            "label": meta.get("label", factor.replace("_", " ").title()),
            "detail": meta["detail"],
        }

    # Backward compatibility key
    components["overdue_severity"] = components["urgency"]

    total_score = round(total_score, 1)
    explanation = generate_explainability_text(task, total_score, features)

    return {
        "task_id": str(task.id),
        "task_code": task.task_code,
        "priority_score": total_score,
        "priority_band": get_priority_band(total_score),
        "explanation_text": explanation,
        "is_prototype_ml": True,
        "ml_risk_label": "Prototype ML-assisted risk estimate",
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
