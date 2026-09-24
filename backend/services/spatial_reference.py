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


def check_track_compatibility(track_a: str, track_b: str, is_trd_isolation: bool = False) -> bool:
    """
    Verifies if two tasks operate on compatible tracks for a joint possession.
    - Tasks on 'BOTH' or 'YARD' interact with either line.
    - Under Indian Railways OHE rules, a TRD Power Block (switching off 25kV OHE electrical section)
      applies to the electrical elementary section/catenary zone. It can safely co-exist with Civil Track
      works (e.g. tamping, rail inspection, de-stressing) on the same line or under shared isolation.
    - S&T disconnection on points/circuits can safely co-exist with ENG or TRD under coordinated possession.
    """
    if track_a == "BOTH" or track_b == "BOTH" or track_a == "YARD" or track_b == "YARD":
        return True
    if is_trd_isolation:
        # A Power Block can coordinate with engineering work under traction power cut
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
    Accounts for:
      - Railway corridor section match
      - Natural department references (ENG chainage, S&T signals, TRD OHE mast & electrical isolation)
      - Power block isolation vs Traffic block
      - Physical spatial chainage overlap along the corridor
    """
    # 1. Must share corridor section
    sec_a = str(getattr(task_a, "section_id", ""))
    sec_b = str(getattr(task_b, "section_id", ""))
    if sec_a != sec_b:
        return {
            "compatible": False,
            "reason": "Different railway corridor sections",
            "overlap_km": 0.0,
            "spatial_overlap": False,
            "track_relation": "Different Sections",
            "protection_type": "Independent",
        }

    dept_a = getattr(task_a.department, "code", "GEN") if getattr(task_a, "department", None) else "GEN"
    dept_b = getattr(task_b.department, "code", "GEN") if getattr(task_b, "department", None) else "GEN"

    span_a_start, span_a_end, track_a = resolve_task_spatial_coordinates(task_a)
    span_b_start, span_b_end, track_b = resolve_task_spatial_coordinates(task_b)

    # 2. TRD Power Block / Isolation evaluation
    is_trd_involved = (dept_a == "TRD" or dept_b == "TRD" or 
                       getattr(task_a, "requires_power_isolation", False) or 
                       getattr(task_b, "requires_power_isolation", False))
    requires_power_cut = bool(getattr(task_a, "requires_power_isolation", False) or 
                              getattr(task_b, "requires_power_isolation", False))

    track_ok = check_track_compatibility(track_a, track_b, is_trd_isolation=is_trd_involved)
    if not track_ok:
        return {
            "compatible": False,
            "reason": f"Track direction divergence: {track_a} vs {track_b}",
            "overlap_km": 0.0,
            "spatial_overlap": False,
            "track_relation": f"Conflicting ({track_a} vs {track_b})",
            "protection_type": "Incompatible Track",
        }

    # 3. Spatial overlap along corridor chainage
    # Multi-department coordination typically benefits from a wider spatial envelop (e.g. OHE tension length ~ 500m)
    buffer = 0.20 if dept_a != dept_b else 0.05
    overlapping, overlap_len = check_spatial_overlap((span_a_start, span_a_end), (span_b_start, span_b_end), buffer_km=buffer)

    if not overlapping:
        return {
            "compatible": False,
            "reason": f"Spatial separation along corridor: KM {span_a_start:.1f}–{span_a_end:.1f} vs KM {span_b_start:.1f}–{span_b_end:.1f} exceeds coordinated possession radius.",
            "overlap_km": 0.0,
            "spatial_overlap": False,
            "track_relation": f"Same corridor, separated by {abs(span_a_start - span_b_end):.2f} km",
            "protection_type": "Spatial Separation",
        }

    # Combined possession envelope
    combined_start = min(span_a_start, span_b_start)
    combined_end = max(span_a_end, span_b_end)

    track_relation_desc = "Same Line" if track_a == track_b else f"Shared Zone ({track_a} & {track_b})"
    protection_desc = "Integrated Traffic + Power Block (25kV De-energized)" if requires_power_cut else "Traffic Block & Track Possession"
    if getattr(task_a, "requires_signal_disconnection", False) or getattr(task_b, "requires_signal_disconnection", False):
        protection_desc += " + S&T Disconnection"

    return {
        "compatible": True,
        "reason": f"Spatially aligned in corridor ({track_relation_desc}): overlapping chainage {combined_start:.2f} km → {combined_end:.2f} km.",
        "overlap_km": overlap_len,
        "combined_span": (combined_start, combined_end),
        "spatial_overlap": True,
        "track_relation": track_relation_desc,
        "protection_type": protection_desc,
        "requires_power_cut": requires_power_cut,
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
