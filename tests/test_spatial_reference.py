import pytest
from datetime import datetime, timedelta
from backend.models.task import MaintenanceTask
from backend.models.department import Department
from backend.services.spatial_reference import (
    resolve_task_spatial_coordinates,
    check_track_compatibility,
    check_spatial_overlap,
    evaluate_tasks_spatial_compatibility,
    compute_possession_spatial_envelope,
)


def test_spatial_coordinates_resolution():
    t = MaintenanceTask(
        task_code="TASK-TEST-01",
        maintenance_type="Track Tamping",
        estimated_duration_min=60,
        minimum_contiguous_block_min=45,
        track_line="UP",
        chainage_from_km=12.2,
        chainage_to_km=14.5,
    )
    start_km, end_km, track = resolve_task_spatial_coordinates(t)
    assert start_km == 12.2
    assert end_km == 14.5
    assert track == "UP"


def test_spatial_overlap_evaluation():
    # Spatially overlapping spans
    overlap, dist = check_spatial_overlap((10.0, 12.5), (11.0, 13.0))
    assert overlap is True
    assert dist > 1.0

    # Disjoint spans separated by 5 km
    overlap, dist = check_spatial_overlap((10.0, 11.0), (16.0, 18.0), buffer_km=0.1)
    assert overlap is False
    assert dist == 0.0


def test_department_tasks_spatial_compatibility():
    dept_eng = Department(code="ENG", name="Engineering")
    dept_trd = Department(code="TRD", name="Traction")

    # Spatially co-located tasks on same section
    t1 = MaintenanceTask(
        task_code="ENG-TAMP",
        section_id="sec-1",
        department=dept_eng,
        maintenance_type="Track Tamping",
        estimated_duration_min=90,
        minimum_contiguous_block_min=60,
        track_line="UP",
        chainage_from_km=5.0,
        chainage_to_km=6.2,
        location_type="chainage",
        start_entity_id="KM 5.0",
        end_entity_id="KM 6.2",
    )
    t2 = MaintenanceTask(
        task_code="TRD-INSP",
        section_id="sec-1",
        department=dept_trd,
        maintenance_type="OHE Inspection",
        estimated_duration_min=60,
        minimum_contiguous_block_min=45,
        track_line="UP",
        chainage_from_km=5.3,
        chainage_to_km=6.5,
        location_type="mast_span",
        start_entity_id="Mast M-10",
        end_entity_id="Mast M-24",
    )

    result = evaluate_tasks_spatial_compatibility(t1, t2)
    assert result["compatible"] is True
    assert result["overlap_km"] > 0.5

    # Tasks on different sections
    t3 = MaintenanceTask(
        task_code="TRD-OTHER-SEC",
        section_id="sec-2",
        department=dept_trd,
        maintenance_type="OHE Inspection",
        estimated_duration_min=60,
        minimum_contiguous_block_min=45,
        track_line="UP",
        chainage_from_km=5.3,
        chainage_to_km=6.5,
    )
    result_diff = evaluate_tasks_spatial_compatibility(t1, t3)
    assert result_diff["compatible"] is False
    assert "Different railway corridor sections" in result_diff["reason"]


def test_possession_spatial_envelope_computation():
    t1 = MaintenanceTask(
        task_code="TASK-A",
        chainage_from_km=1.2,
        chainage_to_km=2.4,
        track_line="UP",
        location_display="KM 1.200 → KM 2.400",
    )
    t2 = MaintenanceTask(
        task_code="TASK-B",
        chainage_from_km=1.8,
        chainage_to_km=3.1,
        track_line="UP",
        location_display="Mast M-18 → Mast M-36",
    )
    envelope = compute_possession_spatial_envelope([t1, t2])
    assert envelope["from_km"] == 1.2
    assert envelope["to_km"] == 3.1
    assert envelope["span_km"] == 1.9
    assert "KM 1.2 – 3.1 [UP] (1.9 km span)" in envelope["display"]
