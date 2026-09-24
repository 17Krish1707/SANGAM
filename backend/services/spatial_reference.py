"""
backend/services/spatial_reference.py — Railway Spatial & Departmental Reference Mapping Layer.

Maps department-specific boundary entities (S&T signals, TRD OHE masts, ENG track chainage)
into a unified railway spatial coordinate along corridor sections. Evaluates physical and
operational compatibility for joint maintenance possession bundling.
"""

from typing import Dict, Any, Optional, Tuple, List


# Safety buffer / electrical clearance constants
MIN_OHE_SAFETY_CLEARANCE_KM = 0.05  # 50m minimum approach clearance
MIN_SIGNAL_OVERLAP_TOLERANCE_KM = 0.02 # 20m tolerance


def resolve_task_spatial_coordinates(task: Any) -> Tuple[float, float, str]:
    """
    Extracts or resolves the unified [chainage_start_km, chainage_end_km] and track_line for a task.
    Falls back to asset coordinates if task fields are not directly set.
    """
    track = getattr(task, "track_line", None) or "UP"
    from_km = getattr(task, "chainage_from_km", None)
    to_km = getattr(task, "chainage_to_km", None)

    # Check if attached asset has spatial coordinates
    asset = getattr(task, "asset", None)
    if (from_km is None or to_km is None) and asset:
        from_km = from_km if from_km is not None else getattr(asset, "chainage_start_km", None)
        to_km = to_km if to_km is not None else getattr(asset, "chainage_end_km", None)
        track = track or getattr(asset, "track_line", "UP")

    # If only one km marker is present, treat as a localized point span of 100 meters
    if from_km is not None and to_km is None:
        to_km = from_km + 0.1
    elif to_km is not None and from_km is None:
        from_km = max(0.0, to_km - 0.1)

    # Default fallback: if still not set, default to 0.0 -> 1.0 km within corridor section
    if from_km is None or to_km is None:
        from_km = 0.0
        to_km = 1.0

    return min(from_km, to_km), max(from_km, to_km), track


def check_track_compatibility(track_a: str, track_b: str) -> bool:
    """
    Verifies if two tasks operate on compatible tracks for a joint possession.
    Tasks on 'BOTH' interact with either track; UP/DOWN can coexist under integrated
    power-cut or yard possessory blocks if clear of collision.
    """
    if track_a == "BOTH" or track_b == "BOTH":
        return True
    return track_a == track_b


def check_spatial_overlap(
    span_a: Tuple[float, float],
    span_b: Tuple[float, float],
    buffer_km: float = 0.05,
) -> Tuple[bool, float]:
    """
    Calculates whether two chainage spans [start, end] overlap or are within safe adjacent buffer.
    Returns (is_overlapping, overlap_length_km).
    """
    a_start, a_end = span_a
    b_start, b_end = span_b

    # Expand by proximity buffer
    a_start_buffered = a_start - buffer_km
    a_end_buffered = a_end + buffer_km

    overlap_start = max(a_start_buffered, b_start)
    overlap_end = min(a_end_buffered, b_end)

    if overlap_end >= overlap_start:
        return True, round(max(0.0, overlap_end - overlap_start), 3)
    return False, 0.0


def evaluate_tasks_spatial_compatibility(task_a: Any, task_b: Any) -> Dict[str, Any]:
    """
    Determines whether two maintenance tasks from ENG, S&T, or TRD can be physically
    and operationally coordinated under the same possession envelope.
    """
    # 1. Must share corridor section
    sec_a = str(getattr(task_a, "section_id", ""))
    sec_b = str(getattr(task_b, "section_id", ""))
    if sec_a != sec_b:
        return {
            "compatible": False,
            "reason": "Different railway corridor sections",
            "overlap_km": 0.0,
        }

    # 2. Track compatibility
    span_a_start, span_a_end, track_a = resolve_task_spatial_coordinates(task_a)
    span_b_start, span_b_end, track_b = resolve_task_spatial_coordinates(task_b)

    track_ok = check_track_compatibility(track_a, track_b)
    if not track_ok:
        return {
            "compatible": False,
            "reason": f"Track direction divergence: {track_a} vs {track_b}",
            "overlap_km": 0.0,
        }

    # 3. Spatial overlap along corridor chainage
    dept_a = getattr(task_a.department, "code", "GEN") if getattr(task_a, "department", None) else "GEN"
    dept_b = getattr(task_b.department, "code", "GEN") if getattr(task_b, "department", None) else "GEN"

    # Multi-department coordination typically benefits from a wider spatial envelop (e.g. OHE tension length ~ 500m)
    buffer = 0.15 if dept_a != dept_b else 0.05
    overlapping, overlap_len = check_spatial_overlap((span_a_start, span_a_end), (span_b_start, span_b_end), buffer_km=buffer)

    if not overlapping:
        return {
            "compatible": False,
            "reason": f"Spatial separation along corridor: KM {span_a_start:.1f}–{span_a_end:.1f} vs KM {span_b_start:.1f}–{span_b_end:.1f} exceeds coordinated possession radius.",
            "overlap_km": 0.0,
        }

    # Combined possession envelope
    combined_start = min(span_a_start, span_b_start)
    combined_end = max(span_a_end, span_b_end)

    return {
        "compatible": True,
        "reason": f"Spatially aligned in corridor ({track_a}): overlapping chainage {combined_start:.2f} km → {combined_end:.2f} km.",
        "overlap_km": overlap_len,
        "combined_span": (combined_start, combined_end),
    }


def compute_possession_spatial_envelope(tasks: List[Any]) -> Dict[str, Any]:
    """
    Computes the overall spatial envelope (min/max chainage, combined entity spans)
    for a list of tasks scheduled in a single maintenance block.
    """
    if not tasks:
        return {
            "display": "Standard Corridor Section",
            "from_km": 0.0,
            "to_km": 0.0,
            "span_km": 0.0,
            "entities": [],
        }

    min_km = 999999.0
    max_km = -1.0
    tracks = set()
    entities = []

    for t in tasks:
        start_km, end_km, trk = resolve_task_spatial_coordinates(t)
        min_km = min(min_km, start_km)
        max_km = max(max_km, end_km)
        tracks.add(trk)

        # Collect entity tags
        loc_disp = getattr(t, "location_display", None)
        if loc_disp:
            entities.append(loc_disp)
        else:
            code = getattr(t, "task_code", "TASK")
            entities.append(f"{code} (KM {start_km:.1f}–{end_km:.1f})")

    track_label = "/".join(sorted(tracks)) if tracks else "UP"
    span_len = round(max(0.0, max_km - min_km), 2)
    display_str = f"KM {min_km:.1f} – {max_km:.1f} [{track_label}] ({span_len} km span)"

    return {
        "display": display_str,
        "from_km": round(min_km, 2),
        "to_km": round(max_km, 2),
        "span_km": span_len,
        "entities": entities[:4],
    }
