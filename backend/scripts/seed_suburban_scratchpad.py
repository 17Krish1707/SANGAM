"""
seed_suburban_scratchpad.py — Realistic Mumbai Suburban Railway Scratchpad Dataset for SANGAM.

Corridor:
  Dadar -> Matunga -> Sion -> Kurla -> Ghatkopar -> Vikhroli
  (5 Railway Sections on the Central Suburban Trunk)

Dataset:
  - 6 Stations (Dadar, Matunga, Sion, Kurla, Ghatkopar, Vikhroli)
  - 5 Sections (Dadar–Matunga, Matunga–Sion, Sion–Kurla, Kurla–Ghatkopar, Ghatkopar–Vikhroli)
  - 10 Assets (Track sections, turnouts, OHE masts, contact wires, signals, point machines)
  - 7 Resources (Track Maintenance Gang A, Track Machine A, Supervisor, TRD Crew A, Tower Wagon A, Signal Team A, Signal Testing Kit)
  - 12 Tasks across ENG, TRD, SNT with intentional controlled conflicts
  - 15 Train Movements (Suburban fast/slow locals, mail/express, freight)
  - Pre-computed optimization runs (Baseline Independent, Greedy, and SANGAM CP-SAT)

Controlled Conflicts / Scenarios:
  CASE A — Same resource conflict: Gang A needed by Emergency Track Inspection & Rail Joint Maintenance.
  CASE B — Same section bottleneck: Kurla–Ghatkopar requested by multiple departments simultaneously.
  CASE C — Train movement conflict: Dense suburban train movements constrain available maintenance windows.
  CASE D — Department coordination: Task 4 (TRD) & Task 10 (ENG) co-located into a coordinated Joint Block.
  CASE E — Priority conflict: Critical safety items prioritized over routine maintenance.
  CASE F — Limited resources: Single Tower Wagon and single Track Gang prevent concurrent deployment.
  CASE G — Impossible / infeasible task: Dense train headway on Ghatkopar–Vikhroli (trains every 40-70 min)
           leaves only 20 min windows during daytime; Task 11 requires 60 min, so optimizer honestly defers it.
"""

import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal
from backend.models.department import Department
from backend.models.section import RailwaySection
from backend.models.asset import Asset
from backend.models.resource import Resource, TaskResourceRequirement
from backend.models.task import MaintenanceTask
from backend.models.train import TrainMovement
from backend.models.conflict import TaskConflict
from backend.models.block_window import BlockWindow
from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask
from backend.scripts.reset_operational_data import reset_operational_data
from backend.services.corridor_availability import populate_block_windows
from backend.services.optimizer_common import prepare_optimization_input
from backend.services.baselines import run_independent_baseline, run_greedy_baseline
from backend.services.optimizer import run_sangam_optimizer
from backend.services.priority_engine import recompute_all_priority_scores
from backend.services.kpi_engine import compute_kpis, compute_downtime_saved


DATASET_LABEL = "SANGAM Demonstration Dataset — Synthetic Operational Scenario"


def seed_suburban_scratchpad(db=None):
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        print(f"=== INITIALIZING {DATASET_LABEL} ===")
        # 1. Reset all operational data cleanly (preserves departments ENG, TRD, SNT)
        reset_operational_data(keep_sections=False)

        eng_dept = db.query(Department).filter(Department.code == "ENG").first()
        trd_dept = db.query(Department).filter(Department.code == "TRD").first()
        snt_dept = db.query(Department).filter(Department.code == "SNT").first()

        if not eng_dept or not trd_dept or not snt_dept:
            from backend.scripts.seed_departments import seed_departments
            seed_departments()
            eng_dept = db.query(Department).filter(Department.code == "ENG").first()
            trd_dept = db.query(Department).filter(Department.code == "TRD").first()
            snt_dept = db.query(Department).filter(Department.code == "SNT").first()

        # 2. 5 Corridor Sections (Dadar -> Matunga -> Sion -> Kurla -> Ghatkopar -> Vikhroli)
        corridor = "Mumbai Central Suburban Corridor"
        sec_dm = RailwaySection(
            name="Dadar–Matunga",
            corridor_name=corridor,
            from_station="Dadar",
            to_station="Matunga",
            length_km=1.8,
            line_type="double",
            is_electrified=True,
            traction_type="25 kV AC OHE",
            section_capacity_notes="High-Density Suburban Quadruple Track Corridor",
        )
        sec_ms = RailwaySection(
            name="Matunga–Sion",
            corridor_name=corridor,
            from_station="Matunga",
            to_station="Sion",
            length_km=2.2,
            line_type="double",
            is_electrified=True,
            traction_type="25 kV AC OHE",
            section_capacity_notes="Suburban Fast & Slow Trunk Segment",
        )
        sec_sk = RailwaySection(
            name="Sion–Kurla",
            corridor_name=corridor,
            from_station="Sion",
            to_station="Kurla",
            length_km=3.5,
            line_type="double",
            is_electrified=True,
            traction_type="25 kV AC OHE",
            section_capacity_notes="Major Junction Approach, Harbour & Main Line Crossing",
        )
        sec_kg = RailwaySection(
            name="Kurla–Ghatkopar",
            corridor_name=corridor,
            from_station="Kurla",
            to_station="Ghatkopar",
            length_km=4.1,
            line_type="double",
            is_electrified=True,
            traction_type="25 kV AC OHE",
            section_capacity_notes="Core Bottleneck Section, Freight Divergence Point",
        )
        sec_gv = RailwaySection(
            name="Ghatkopar–Vikhroli",
            corridor_name=corridor,
            from_station="Ghatkopar",
            to_station="Vikhroli",
            length_km=3.2,
            line_type="double",
            is_electrified=True,
            traction_type="25 kV AC OHE",
            section_capacity_notes="Suburban High-Frequency Commuter Trunk (Frequent Headway)",
        )
        db.add_all([sec_dm, sec_ms, sec_sk, sec_kg, sec_gv])
        db.flush()

        # 3. 10 Railway Assets distributed across corridor with explicit spatial references
        assets = [
            # Engineering Track Spans
            Asset(
                section_id=sec_dm.id, department_id=eng_dept.id, asset_type="Track Section", health_state="Degraded",
                notes="Track Section DM-01 (Continuous Welded Rail)", track_line="UP",
                start_location_ref="KM 0.2", end_location_ref="KM 1.4", chainage_start_km=0.2, chainage_end_km=1.4
            ),
            Asset(
                section_id=sec_dm.id, department_id=eng_dept.id, asset_type="Turnout", health_state="Good",
                notes="Turnout DM-02 (Crossover 101B)", track_line="BOTH",
                start_location_ref="KM 1.2", end_location_ref="KM 1.6", chainage_start_km=1.2, chainage_end_km=1.6
            ),
            Asset(
                section_id=sec_ms.id, department_id=eng_dept.id, asset_type="Track Section", health_state="Good",
                notes="Track Section MS-01", track_line="UP",
                start_location_ref="KM 0.5", end_location_ref="KM 1.8", chainage_start_km=0.5, chainage_end_km=1.8
            ),
            Asset(
                section_id=sec_sk.id, department_id=eng_dept.id, asset_type="Track Section", health_state="Good",
                notes="Track Section SK-01", track_line="UP",
                start_location_ref="KM 0.8", end_location_ref="KM 2.0", chainage_start_km=0.8, chainage_end_km=2.0
            ),
            Asset(
                section_id=sec_sk.id, department_id=eng_dept.id, asset_type="Turnout", health_state="Degraded",
                notes="Turnout SK-02", track_line="UP",
                start_location_ref="KM 1.6", end_location_ref="KM 2.1", chainage_start_km=1.6, chainage_end_km=2.1
            ),
            # TRD OHE Mast Spans
            Asset(
                section_id=sec_kg.id, department_id=trd_dept.id, asset_type="OHE Mast", health_state="Good",
                notes="OHE Mast KG-M12 to KG-M24", track_line="UP",
                start_location_ref="Mast M-12", end_location_ref="Mast M-24", chainage_start_km=0.6, chainage_end_km=1.5
            ),
            Asset(
                section_id=sec_kg.id, department_id=trd_dept.id, asset_type="Contact Wire", health_state="Critical",
                notes="Contact Wire KG-CW02 Tension Length", track_line="UP",
                start_location_ref="Mast M-18", end_location_ref="Mast M-32", chainage_start_km=0.9, chainage_end_km=1.8
            ),
            Asset(
                section_id=sec_gv.id, department_id=trd_dept.id, asset_type="OHE Mast", health_state="Good",
                notes="OHE Mast GV-M01 to GV-M15", track_line="UP",
                start_location_ref="Mast M-01", end_location_ref="Mast M-15", chainage_start_km=0.1, chainage_end_km=0.9
            ),
            # S&T Signal and Point Machine Spans
            Asset(
                section_id=sec_sk.id, department_id=snt_dept.id, asset_type="Signal", health_state="Good",
                notes="Signal SK-S01 to SK-S02 Block", track_line="UP",
                start_location_ref="Signal S-101", end_location_ref="Signal S-102", chainage_start_km=0.9, chainage_end_km=1.7
            ),
            Asset(
                section_id=sec_kg.id, department_id=snt_dept.id, asset_type="Point Machine", health_state="Degraded",
                notes="Point Machine KG-P01 (Dual-Control)", track_line="UP",
                start_location_ref="Signal S-204", end_location_ref="Point 104A", chainage_start_km=0.8, chainage_end_km=1.4
            ),
        ]
        db.add_all(assets)
        db.flush()

        # Map assets for task assignment
        asset_dm_01 = assets[0]
        asset_dm_02 = assets[1]
        asset_ms_01 = assets[2]
        asset_sk_01 = assets[3]
        asset_sk_02 = assets[4]
        asset_kg_01 = assets[5]
        asset_kg_02 = assets[6]
        asset_gv_01 = assets[7]
        asset_sk_s01 = assets[8]
        asset_kg_p01 = assets[9]

        # 4. 7 Resources (Constrained to create visible contention)
        # Engineering
        r_gang_a = Resource(department_id=eng_dept.id, resource_type="Crew", name="Track Maintenance Gang A", is_available=True)
        r_machine_a = Resource(department_id=eng_dept.id, resource_type="Equipment", name="Track Machine A", is_available=True)
        r_eng_sup = Resource(department_id=eng_dept.id, resource_type="Crew", name="Engineering Supervisor", is_available=True)
        # TRD
        r_trd_crew_a = Resource(department_id=trd_dept.id, resource_type="Crew", name="TRD Maintenance Crew A", is_available=True)
        r_tower_a = Resource(department_id=trd_dept.id, resource_type="Equipment", name="Tower Wagon A", is_available=True)
        # S&T
        r_snt_team_a = Resource(department_id=snt_dept.id, resource_type="Crew", name="Signal Maintenance Team A", is_available=True)
        r_snt_test_kit = Resource(department_id=snt_dept.id, resource_type="Equipment", name="Signal Testing Equipment", is_available=True)

        db.add_all([r_gang_a, r_machine_a, r_eng_sup, r_trd_crew_a, r_tower_a, r_snt_team_a, r_snt_test_kit])
        db.flush()

        # 5. Train Movements (15 movements on demonstration day)
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        trains = [
            # Dadar–Matunga (3 trains)
            TrainMovement(
                section_id=sec_dm.id, train_type="Passenger", train_number="95101",
                entry_time=today + timedelta(hours=6, minutes=0), exit_time=today + timedelta(hours=6, minutes=25),
                scheduled_entry_time=today + timedelta(hours=6, minutes=0), scheduled_exit_time=today + timedelta(hours=6, minutes=25),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Down Suburban Fast (CSMT to Kalyan)",
            ),
            TrainMovement(
                section_id=sec_dm.id, train_type="Passenger", train_number="95102",
                entry_time=today + timedelta(hours=8, minutes=30), exit_time=today + timedelta(hours=8, minutes=55),
                scheduled_entry_time=today + timedelta(hours=8, minutes=30), scheduled_exit_time=today + timedelta(hours=8, minutes=55),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Up Suburban Fast (Kalyan to CSMT)",
            ),
            TrainMovement(
                section_id=sec_dm.id, train_type="Passenger", train_number="11001",
                entry_time=today + timedelta(hours=12, minutes=0), exit_time=today + timedelta(hours=12, minutes=30),
                scheduled_entry_time=today + timedelta(hours=12, minutes=0), scheduled_exit_time=today + timedelta(hours=12, minutes=30),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Outbound Mail/Express (CSMT to Pune)",
            ),

            # Matunga–Sion (2 trains)
            TrainMovement(
                section_id=sec_ms.id, train_type="Passenger", train_number="95201",
                entry_time=today + timedelta(hours=6, minutes=30), exit_time=today + timedelta(hours=6, minutes=55),
                scheduled_entry_time=today + timedelta(hours=6, minutes=30), scheduled_exit_time=today + timedelta(hours=6, minutes=55),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Down Suburban Slow Local",
            ),
            TrainMovement(
                section_id=sec_ms.id, train_type="Passenger", train_number="95202",
                entry_time=today + timedelta(hours=11, minutes=0), exit_time=today + timedelta(hours=11, minutes=25),
                scheduled_entry_time=today + timedelta(hours=11, minutes=0), scheduled_exit_time=today + timedelta(hours=11, minutes=25),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Up Suburban Slow Local",
            ),

            # Sion–Kurla (2 trains)
            TrainMovement(
                section_id=sec_sk.id, train_type="Passenger", train_number="95301",
                entry_time=today + timedelta(hours=5, minutes=45), exit_time=today + timedelta(hours=6, minutes=10),
                scheduled_entry_time=today + timedelta(hours=5, minutes=45), scheduled_exit_time=today + timedelta(hours=6, minutes=10),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Down Harbour Interchange Shuttle",
            ),
            TrainMovement(
                section_id=sec_sk.id, train_type="Passenger", train_number="95302",
                entry_time=today + timedelta(hours=10, minutes=15), exit_time=today + timedelta(hours=10, minutes=40),
                scheduled_entry_time=today + timedelta(hours=10, minutes=15), scheduled_exit_time=today + timedelta(hours=10, minutes=40),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Up Harbour Interchange Shuttle",
            ),

            # Kurla–Ghatkopar (3 trains - Core Bottleneck)
            TrainMovement(
                section_id=sec_kg.id, train_type="Passenger", train_number="11002",
                entry_time=today + timedelta(hours=7, minutes=0), exit_time=today + timedelta(hours=7, minutes=30),
                scheduled_entry_time=today + timedelta(hours=7, minutes=0), scheduled_exit_time=today + timedelta(hours=7, minutes=30),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Inbound Express (Pune to CSMT)",
            ),
            TrainMovement(
                section_id=sec_kg.id, train_type="Passenger", train_number="95401",
                entry_time=today + timedelta(hours=11, minutes=30), exit_time=today + timedelta(hours=11, minutes=55),
                scheduled_entry_time=today + timedelta(hours=11, minutes=30), scheduled_exit_time=today + timedelta(hours=11, minutes=55),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Midday Down Suburban Local",
            ),
            TrainMovement(
                section_id=sec_kg.id, train_type="Goods", train_number="G-801",
                entry_time=today + timedelta(hours=13, minutes=30), exit_time=today + timedelta(hours=14, minutes=0),
                scheduled_entry_time=today + timedelta(hours=13, minutes=30), scheduled_exit_time=today + timedelta(hours=14, minutes=0),
                priority=2, delay_minutes=0, forecast_confidence=0.9, source="FOIS Goods Feed",
                notes="JNPT Container Freight Rake",
            ),

            # Ghatkopar–Vikhroli (5 trains with dense headway - Demonstrates Infeasibility CASE G)
            TrainMovement(
                section_id=sec_gv.id, train_type="Passenger", train_number="95501",
                entry_time=today + timedelta(hours=6, minutes=0), exit_time=today + timedelta(hours=6, minutes=30),
                scheduled_entry_time=today + timedelta(hours=6, minutes=0), scheduled_exit_time=today + timedelta(hours=6, minutes=30),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Suburban Down Local 1",
            ),
            TrainMovement(
                section_id=sec_gv.id, train_type="Passenger", train_number="95502",
                entry_time=today + timedelta(hours=7, minutes=10), exit_time=today + timedelta(hours=7, minutes=40),
                scheduled_entry_time=today + timedelta(hours=7, minutes=10), scheduled_exit_time=today + timedelta(hours=7, minutes=40),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Suburban Up Local 1",
            ),
            TrainMovement(
                section_id=sec_gv.id, train_type="Passenger", train_number="95503",
                entry_time=today + timedelta(hours=8, minutes=20), exit_time=today + timedelta(hours=8, minutes=50),
                scheduled_entry_time=today + timedelta(hours=8, minutes=20), scheduled_exit_time=today + timedelta(hours=8, minutes=50),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Suburban Down Local 2 (Peak)",
            ),
            TrainMovement(
                section_id=sec_gv.id, train_type="Passenger", train_number="95504",
                entry_time=today + timedelta(hours=9, minutes=30), exit_time=today + timedelta(hours=10, minutes=0),
                scheduled_entry_time=today + timedelta(hours=9, minutes=30), scheduled_exit_time=today + timedelta(hours=10, minutes=0),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Suburban Up Local 2",
            ),
            TrainMovement(
                section_id=sec_gv.id, train_type="Passenger", train_number="95505",
                entry_time=today + timedelta(hours=10, minutes=40), exit_time=today + timedelta(hours=11, minutes=10),
                scheduled_entry_time=today + timedelta(hours=10, minutes=40), scheduled_exit_time=today + timedelta(hours=11, minutes=10),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Suburban Down Local 3",
            ),
        ]
        db.add_all(trains)
        db.flush()

        # 6. Candidate Block Windows generation from train movements
        sec_ids = [str(sec_dm.id), str(sec_ms.id), str(sec_sk.id), str(sec_kg.id), str(sec_gv.id)]
        windows = populate_block_windows(
            db=db,
            section_ids=sec_ids,
            start_date=today,
            end_date=today + timedelta(days=1, minutes=0),
        )
        print(f"Generated {len(windows)} candidate block windows across 5 sections.")

        # 7. 12 Maintenance Tasks with Department-Specific Boundaries & Common Railway Reference
        tasks = [
            # TASK 1: Critical — Emergency Track Inspection on Dadar–Matunga
            MaintenanceTask(
                task_code="TASK-ENG-01",
                department_id=eng_dept.id,
                section_id=sec_dm.id,
                asset_id=asset_dm_01.id,
                maintenance_type="Emergency Track Inspection",
                severity="Critical",
                detected_at=today - timedelta(hours=2),
                due_date=today + timedelta(hours=20),
                estimated_duration_min=60,
                minimum_contiguous_block_min=45,
                requires_power_isolation=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.2,
                chainage_to_km=1.1,
                location_type="chainage",
                start_entity_id="KM 0.2",
                end_entity_id="KM 1.1",
                location_display="KM 0.200 → KM 1.100 [UP Track]",
                status="Ready for Planning",
                source="Manual",
                description="Ultrasonic flaw detection follow-up on rail joint DM-01.",
                operational_notes="Critical safety urgency. Competes for Gang A.",
            ),

            # TASK 2: High — Rail Joint Maintenance on Dadar–Matunga (Resource contention with Task 1)
            MaintenanceTask(
                task_code="TASK-ENG-02",
                department_id=eng_dept.id,
                section_id=sec_dm.id,
                asset_id=asset_dm_02.id,
                maintenance_type="Rail Joint Maintenance",
                severity="High",
                detected_at=today - timedelta(days=1),
                due_date=today + timedelta(hours=22),
                estimated_duration_min=90,
                minimum_contiguous_block_min=75,
                requires_power_isolation=False,
                can_run_parallel=True,
                track_line="BOTH",
                chainage_from_km=1.2,
                chainage_to_km=1.6,
                location_type="chainage",
                start_entity_id="KM 1.2",
                end_entity_id="KM 1.6",
                location_display="KM 1.200 → KM 1.600 [Crossover 101B]",
                status="Ready for Planning",
                source="Manual",
                description="Thermit weld grinding and fishplate tightening on Crossover 101B.",
                operational_notes="Requires Track Maintenance Gang A & Track Machine A.",
            ),

            # TASK 3: Medium — Track Geometry Inspection on Matunga–Sion
            MaintenanceTask(
                task_code="TASK-ENG-03",
                department_id=eng_dept.id,
                section_id=sec_ms.id,
                asset_id=asset_ms_01.id,
                maintenance_type="Track Geometry Inspection",
                severity="Medium",
                detected_at=today - timedelta(days=1),
                due_date=today + timedelta(hours=22),
                estimated_duration_min=60,
                minimum_contiguous_block_min=45,
                requires_power_isolation=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.5,
                chainage_to_km=1.7,
                location_type="chainage",
                start_entity_id="KM 0.5",
                end_entity_id="KM 1.7",
                location_display="KM 0.500 → KM 1.700 [UP Fast]",
                status="Ready for Planning",
                source="Manual",
                description="Periodic track alignment and gauge variation inspection.",
                operational_notes="Requires Engineering Supervisor & Track Machine A.",
            ),

            # TASK 4: High — OHE Preventive Inspection on Kurla–Ghatkopar (Joint Block candidate with Task 10)
            MaintenanceTask(
                task_code="TASK-TRD-01",
                department_id=trd_dept.id,
                section_id=sec_kg.id,
                asset_id=asset_kg_01.id,
                maintenance_type="OHE Preventive Inspection",
                severity="High",
                detected_at=today - timedelta(days=1),
                due_date=today + timedelta(hours=22),
                estimated_duration_min=90,
                minimum_contiguous_block_min=60,
                requires_power_isolation=True,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.8,
                chainage_to_km=1.6,
                location_type="mast_span",
                start_entity_id="Mast M-16",
                end_entity_id="Mast M-28",
                location_display="Mast M-16 → Mast M-28 (KM 0.800–1.600)",
                status="Ready for Planning",
                source="Manual",
                description="25 kV AC cantilever and dropper wire inspection.",
                operational_notes="Requires power isolation. Can be paired with Civil Track works.",
            ),

            # TASK 5: Critical — OHE Fault Rectification on Kurla–Ghatkopar (Priority conflict on bottleneck section)
            MaintenanceTask(
                task_code="TASK-TRD-02",
                department_id=trd_dept.id,
                section_id=sec_kg.id,
                asset_id=asset_kg_02.id,
                maintenance_type="OHE Fault Rectification",
                severity="Critical",
                detected_at=today - timedelta(hours=3),
                due_date=today + timedelta(hours=20),
                estimated_duration_min=60,
                minimum_contiguous_block_min=45,
                requires_power_isolation=True,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=1.0,
                chainage_to_km=1.5,
                location_type="mast_span",
                start_entity_id="Mast M-20",
                end_entity_id="Mast M-30",
                location_display="Mast M-20 → Mast M-30 (KM 1.000–1.500)",
                status="Ready for Planning",
                source="Manual",
                description="Rectify abnormal contact wire wear at Kurla junction turnout.",
                operational_notes="Critical safety issue requiring Tower Wagon A.",
            ),

            # TASK 6: Medium — Contact Wire Maintenance on Ghatkopar–Vikhroli
            MaintenanceTask(
                task_code="TASK-TRD-03",
                department_id=trd_dept.id,
                section_id=sec_gv.id,
                asset_id=asset_gv_01.id,
                maintenance_type="Contact Wire Maintenance",
                severity="Medium",
                detected_at=today - timedelta(days=2),
                due_date=today + timedelta(hours=22),
                estimated_duration_min=90,
                minimum_contiguous_block_min=60,
                requires_power_isolation=True,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.2,
                chainage_to_km=0.8,
                location_type="mast_span",
                start_entity_id="Mast M-04",
                end_entity_id="Mast M-14",
                location_display="Mast M-04 → Mast M-14 (KM 0.200–0.800)",
                status="Ready for Planning",
                source="Manual",
                description="OHE mast insulator wash and tension adjustment.",
                operational_notes="Requires TRD Maintenance Crew A.",
            ),

            # TASK 7: High — Signal Health Check on Sion–Kurla
            MaintenanceTask(
                task_code="TASK-SNT-01",
                department_id=snt_dept.id,
                section_id=sec_sk.id,
                asset_id=asset_sk_s01.id,
                maintenance_type="Signal Health Check",
                severity="High",
                detected_at=today - timedelta(days=1),
                due_date=today + timedelta(hours=22),
                estimated_duration_min=60,
                minimum_contiguous_block_min=45,
                requires_power_isolation=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.9,
                chainage_to_km=1.6,
                location_type="signal_span",
                start_entity_id="Signal S-101",
                end_entity_id="Signal S-102",
                location_display="Signal S-101 → Signal S-102 (KM 0.900–1.600)",
                status="Ready for Planning",
                source="Manual",
                description="Colour light signal aspect luminance check and circuit audit.",
                operational_notes="Requires Signal Maintenance Team A and Testing Kit.",
            ),

            # TASK 8: High — Point Machine Inspection on Kurla–Ghatkopar
            MaintenanceTask(
                task_code="TASK-SNT-02",
                department_id=snt_dept.id,
                section_id=sec_kg.id,
                asset_id=asset_kg_p01.id,
                maintenance_type="Point Machine Inspection",
                severity="High",
                detected_at=today - timedelta(days=1),
                due_date=today + timedelta(hours=22),
                estimated_duration_min=60,
                minimum_contiguous_block_min=45,
                requires_power_isolation=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.8,
                chainage_to_km=1.3,
                location_type="signal_span",
                start_entity_id="Signal S-204",
                end_entity_id="Point 104A",
                location_display="Signal S-204 → Point 104A (KM 0.800–1.300)",
                status="Ready for Planning",
                source="Manual",
                description="Obstruction test and motor current calibration on Point Machine KG-P01.",
                operational_notes="Demands access to Kurla bottleneck.",
            ),

            # TASK 9: Medium — Signal Cable Inspection on Matunga–Sion
            MaintenanceTask(
                task_code="TASK-SNT-03",
                department_id=snt_dept.id,
                section_id=sec_ms.id,
                asset_id=None,
                maintenance_type="Signal Cable Inspection",
                severity="Medium",
                detected_at=today - timedelta(days=2),
                due_date=today + timedelta(hours=22),
                estimated_duration_min=90,
                minimum_contiguous_block_min=60,
                requires_power_isolation=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.6,
                chainage_to_km=1.5,
                location_type="signal_span",
                start_entity_id="Signal S-05",
                end_entity_id="Signal S-07",
                location_display="Signal S-05 → Signal S-07 (KM 0.600–1.500)",
                status="Ready for Planning",
                source="Manual",
                description="Megger insulation resistance testing of track detection signalling cables.",
                operational_notes="Requires Signal Testing Equipment.",
            ),

            # TASK 10: Medium — Joint Track & OHE Inspection on Kurla–Ghatkopar (Forms joint block with Task 4)
            MaintenanceTask(
                task_code="TASK-JNT-01",
                department_id=eng_dept.id,
                section_id=sec_kg.id,
                asset_id=asset_kg_01.id,
                maintenance_type="Joint Track & OHE Inspection",
                severity="Medium",
                detected_at=today - timedelta(days=1),
                due_date=today + timedelta(hours=22),
                estimated_duration_min=90,
                minimum_contiguous_block_min=60,
                requires_power_isolation=True,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.9,
                chainage_to_km=1.5,
                location_type="chainage",
                start_entity_id="KM 0.9",
                end_entity_id="KM 1.5",
                location_display="KM 0.900 → KM 1.500 [UP Track - Overlaps TRD-01]",
                status="Ready for Planning",
                source="Manual",
                description="Coordinated Civil track inspection during scheduled traction power isolation.",
                operational_notes="Candidate for combined multi-department possession with TRD-01.",
            ),

            # TASK 11: Low — Routine Track Patrol on Ghatkopar–Vikhroli (CASE G: Infeasible due to 40m train headway!)
            MaintenanceTask(
                task_code="TASK-ENG-04",
                department_id=eng_dept.id,
                section_id=sec_gv.id,
                asset_id=None,
                maintenance_type="Routine Track Patrol",
                severity="Low",
                detected_at=today - timedelta(days=3),
                due_date=today + timedelta(hours=22),
                estimated_duration_min=60,
                minimum_contiguous_block_min=60,
                requires_power_isolation=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.5,
                chainage_to_km=2.5,
                location_type="chainage",
                start_entity_id="KM 0.5",
                end_entity_id="KM 2.5",
                location_display="KM 0.500 → KM 2.500 [UP Slow]",
                status="Ready for Planning",
                source="Manual",
                description="General keyman foot patrol and ballast profile inspection.",
                operational_notes="Demonstrates honest constraint handling: no daytime window on GV meets 60m contiguous block requirement.",
            ),

            # TASK 12: Low — Preventive Signal Maintenance on Sion–Kurla
            MaintenanceTask(
                task_code="TASK-SNT-04",
                department_id=snt_dept.id,
                section_id=sec_sk.id,
                asset_id=asset_sk_s01.id,
                maintenance_type="Preventive Signal Maintenance",
                severity="Low",
                detected_at=today - timedelta(days=2),
                due_date=today + timedelta(hours=22),
                estimated_duration_min=60,
                minimum_contiguous_block_min=45,
                requires_power_isolation=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=1.0,
                chainage_to_km=1.7,
                location_type="signal_span",
                start_entity_id="Signal S-101",
                end_entity_id="Signal S-102",
                location_display="Signal S-101 → Signal S-102 (KM 1.000–1.700)",
                status="Ready for Planning",
                source="Manual",
                description="Routine cleaning of signal lenses and transformer housing inspection.",
                operational_notes="Low-urgency periodic maintenance.",
            ),
        ]
        db.add_all(tasks)
        db.flush()

        # 8. Task Resource Requirements
        db.add_all([
            # TASK 1 (ENG-01): Gang A, Supervisor
            TaskResourceRequirement(task_id=tasks[0].id, resource_id=r_gang_a.id),
            TaskResourceRequirement(task_id=tasks[0].id, resource_id=r_eng_sup.id),

            # TASK 2 (ENG-02): Gang A (CONTENTION with Task 1!), Machine A
            TaskResourceRequirement(task_id=tasks[1].id, resource_id=r_gang_a.id),
            TaskResourceRequirement(task_id=tasks[1].id, resource_id=r_machine_a.id),

            # TASK 3 (ENG-03): Supervisor, Machine A
            TaskResourceRequirement(task_id=tasks[2].id, resource_id=r_eng_sup.id),
            TaskResourceRequirement(task_id=tasks[2].id, resource_id=r_machine_a.id),

            # TASK 4 (TRD-01): TRD Crew A, Tower Wagon A
            TaskResourceRequirement(task_id=tasks[3].id, resource_id=r_trd_crew_a.id),
            TaskResourceRequirement(task_id=tasks[3].id, resource_id=r_tower_a.id),

            # TASK 5 (TRD-02): TRD Crew A, Tower Wagon A (CONTENTION with Task 4!)
            TaskResourceRequirement(task_id=tasks[4].id, resource_id=r_trd_crew_a.id),
            TaskResourceRequirement(task_id=tasks[4].id, resource_id=r_tower_a.id),

            # TASK 6 (TRD-03): TRD Crew A
            TaskResourceRequirement(task_id=tasks[5].id, resource_id=r_trd_crew_a.id),

            # TASK 7 (SNT-01): Signal Team A, Testing Equipment
            TaskResourceRequirement(task_id=tasks[6].id, resource_id=r_snt_team_a.id),
            TaskResourceRequirement(task_id=tasks[6].id, resource_id=r_snt_test_kit.id),

            # TASK 8 (SNT-02): Signal Team A
            TaskResourceRequirement(task_id=tasks[7].id, resource_id=r_snt_team_a.id),

            # TASK 9 (SNT-03): Signal Team A, Testing Equipment
            TaskResourceRequirement(task_id=tasks[8].id, resource_id=r_snt_team_a.id),
            TaskResourceRequirement(task_id=tasks[8].id, resource_id=r_snt_test_kit.id),

            # TASK 10 (JNT-01): Supervisor, Machine A (Co-located with TRD Task 4)
            TaskResourceRequirement(task_id=tasks[9].id, resource_id=r_eng_sup.id),
            TaskResourceRequirement(task_id=tasks[9].id, resource_id=r_machine_a.id),

            # TASK 11 (ENG-04): Gang A (Infeasible due to window limits)
            TaskResourceRequirement(task_id=tasks[10].id, resource_id=r_gang_a.id),

            # TASK 12 (SNT-04): Signal Team A
            TaskResourceRequirement(task_id=tasks[11].id, resource_id=r_snt_team_a.id),
        ])

        # 9. Multi-department Joint Compatibility (CASE D)
        # Explicit compatibility edge between TASK 4 (TRD) and TASK 10 (ENG) on Kurla–Ghatkopar
        compat_trd_eng = TaskConflict(
            task_a_id=tasks[3].id,
            task_b_id=tasks[9].id,
            relationship="compatible",
            notes="Coordinated Civil Track Inspection permitted during Traction Power Isolation window.",
        )
        db.add(compat_trd_eng)
        db.commit()

        # Recompute priority scores dynamically based on weights & severities
        recompute_all_priority_scores(db)

        # 10. Run Full Planning Pipeline (Independent, Greedy, SANGAM CP-SAT)
        print("Running optimization pipeline across Mumbai Central Suburban Corridor...")
        bundle = prepare_optimization_input(
            db=db,
            section_ids=sec_ids,
            start_date=today,
            end_date=today + timedelta(days=1),
            horizon="weekly",
        )

        res_ind = run_independent_baseline(bundle, db)
        res_greedy = run_greedy_baseline(bundle, db)
        res_opt = run_sangam_optimizer(bundle, db, time_limit_seconds=15)

        opt_run_id = res_opt["run_id"]
        ind_run_id = res_ind["run_id"]
        greedy_run_id = res_greedy["run_id"]

        # Keep all generated blocks in 'recommended' state for controller review
        blocks = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == opt_run_id).all()
        for b in blocks:
            b.approval_status = "recommended"
            b.approved_by = None
            b.approved_at = None
        db.commit()

        kpis_opt = compute_kpis(db, opt_run_id)
        savings = compute_downtime_saved(db, ind_run_id, opt_run_id)

        print("\n=== SUBURBAN DEMONSTRATION DATASET READY ===")
        print(f"Stations:            6 (Dadar, Matunga, Sion, Kurla, Ghatkopar, Vikhroli)")
        print(f"Sections:            5 (Dadar–Matunga, Matunga–Sion, Sion–Kurla, Kurla–Ghatkopar, Ghatkopar–Vikhroli)")
        print(f"Assets:              {len(assets)} (Track sections, turnouts, OHE, signals)")
        print(f"Resources:           7 (3 ENG, 2 TRD, 2 SNT)")
        print(f"Tasks:               {len(tasks)} across ENG, TRD, SNT")
        print(f"Train Movements:     {len(trains)} suburban & express movements")
        print(f"Candidate Windows:   {len(windows)}")
        print(f"SANGAM Blocks:       {len(blocks)}")
        print(f"Scheduled Tasks:     {res_opt.get('tasks_scheduled', 0)}")
        print(f"Deferred Tasks:      {res_opt.get('tasks_unscheduled', 0)}")
        print(f"Joint Blocks:        {kpis_opt.get('joint_blocks_count', 0)}")
        print(f"Baseline Closure:    {savings.get('baseline_hours', 0)} hrs")
        print(f"SANGAM Closure:      {savings.get('optimized_hours', 0)} hrs")
        print(f"Downtime Saved:      {savings.get('hours_saved', 0)} hrs ({savings.get('percent_saved', 0)}%)")

        return {
            "status": "success",
            "scenario": DATASET_LABEL,
            "stations": 6,
            "sections": 5,
            "assets": len(assets),
            "resources": 7,
            "tasks": len(tasks),
            "trains": len(trains),
            "windows": len(windows),
            "opt_run_id": opt_run_id,
            "ind_run_id": ind_run_id,
            "greedy_run_id": greedy_run_id,
            "blocks_count": len(blocks),
            "tasks_scheduled": res_opt.get("tasks_scheduled", 0),
            "tasks_deferred": res_opt.get("tasks_unscheduled", 0),
            "joint_blocks_count": kpis_opt.get("joint_blocks_count", 0),
            "savings": savings,
        }
    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    seed_suburban_scratchpad()
