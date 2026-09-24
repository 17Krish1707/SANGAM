"""
reset_demo.py — Deterministic Demo Dataset Generator for SANGAM.

Corridor:
  Dadar (KM 0.0) -> Matunga (KM 1.8) -> Sion (KM 4.0) -> Kurla (KM 7.5) -> Ghatkopar (KM 11.6) -> Vikhroli (KM 14.8)
  Total: 14.8 km on Mumbai Central Suburban Main Line.

Dataset:
  - 5 Sections (all Double line, UP + DOWN, Electrified 25 kV AC OHE)
  - Railway Infrastructure Assets for every section (P-Way tracks & turnouts, S&T signals & points, TRD OHE & electrical sections)
  - 7 Resources (Crews & Equipment across ENG, SNT, TRD)
  - 10 Timetable Train Movements on demonstration date 2026-09-24
  - Candidate Block Windows for each section & line
  - 10 Intentional Maintenance Tasks (demonstrating independent, compatible joint work, incompatible work, Traffic Block, Power Block, S&T Disconnection)
  - Pre-computed CP-SAT Optimization Runs (Plan A Recommended, Plan B, Plan C)
"""

import sys
import os
import uuid
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal, init_db
from backend.models.department import Department
from backend.models.section import RailwaySection
from backend.models.asset import Asset
from backend.models.resource import Resource, TaskResourceRequirement
from backend.models.task import MaintenanceTask
from backend.models.train import TrainMovement
from backend.models.block_window import BlockWindow
from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask
from backend.scripts.reset_operational_data import reset_operational_data
from backend.services.optimizer_common import prepare_optimization_input
from backend.services.optimizer import run_sangam_optimizer
from backend.services.priority_engine import recompute_all_priority_scores

DEMO_DATE_STR = "2026-09-24"
DEMO_CORRIDOR_NAME = "Mumbai Central Suburban Trunk"


def reset_demo(db=None):
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        print("=== RESETTING SANGAM DEMO DATASET ===")
        init_db()
        reset_operational_data(keep_sections=False)

        # 1. Departments
        eng_dept = db.query(Department).filter(Department.code == "ENG").first()
        snt_dept = db.query(Department).filter(Department.code == "SNT").first()
        trd_dept = db.query(Department).filter(Department.code == "TRD").first()

        if not eng_dept or not snt_dept or not trd_dept:
            from backend.scripts.seed_departments import seed_departments
            seed_departments()
            eng_dept = db.query(Department).filter(Department.code == "ENG").first()
            snt_dept = db.query(Department).filter(Department.code == "SNT").first()
            trd_dept = db.query(Department).filter(Department.code == "TRD").first()

        # 2. 5 Corridor Sections
        # Cumulative Chainage:
        # Dadar: 0.0 km
        # Matunga: 1.8 km
        # Sion: 4.0 km (length 2.2 km)
        # Kurla: 7.5 km (length 3.5 km)
        # Ghatkopar: 11.6 km (length 4.1 km)
        # Vikhroli: 14.8 km (length 3.2 km)
        sec_dm = RailwaySection(
            id=uuid.uuid4(),
            name="Dadar–Matunga",
            corridor_name=DEMO_CORRIDOR_NAME,
            from_station="Dadar",
            to_station="Matunga",
            length_km=1.8,
            line_type="double",
            is_electrified=True,
            traction_type="25 kV AC OHE",
            section_capacity_notes="High-Density Suburban Quadruple Track Corridor",
        )
        sec_ms = RailwaySection(
            id=uuid.uuid4(),
            name="Matunga–Sion",
            corridor_name=DEMO_CORRIDOR_NAME,
            from_station="Matunga",
            to_station="Sion",
            length_km=2.2,
            line_type="double",
            is_electrified=True,
            traction_type="25 kV AC OHE",
            section_capacity_notes="Suburban Fast & Slow Trunk Segment",
        )
        sec_sk = RailwaySection(
            id=uuid.uuid4(),
            name="Sion–Kurla",
            corridor_name=DEMO_CORRIDOR_NAME,
            from_station="Sion",
            to_station="Kurla",
            length_km=3.5,
            line_type="double",
            is_electrified=True,
            traction_type="25 kV AC OHE",
            section_capacity_notes="Major Junction Approach, Harbour & Main Line Crossing",
        )
        sec_kg = RailwaySection(
            id=uuid.uuid4(),
            name="Kurla–Ghatkopar",
            corridor_name=DEMO_CORRIDOR_NAME,
            from_station="Kurla",
            to_station="Ghatkopar",
            length_km=4.1,
            line_type="double",
            is_electrified=True,
            traction_type="25 kV AC OHE",
            section_capacity_notes="Core Suburban Trunk, Freight Divergence Point",
        )
        sec_gv = RailwaySection(
            id=uuid.uuid4(),
            name="Ghatkopar–Vikhroli",
            corridor_name=DEMO_CORRIDOR_NAME,
            from_station="Ghatkopar",
            to_station="Vikhroli",
            length_km=3.2,
            line_type="double",
            is_electrified=True,
            traction_type="25 kV AC OHE",
            section_capacity_notes="Suburban High-Frequency Commuter Trunk",
        )
        sections = [sec_dm, sec_ms, sec_sk, sec_kg, sec_gv]
        db.add_all(sections)
        db.flush()

        # 3. Railway Infrastructure Assets on Every Section
        assets = [
            # Dadar–Matunga (KM 0.0 - 1.8)
            Asset(
                section_id=sec_dm.id, department_id=eng_dept.id, asset_type="Track Section", health_state="Good",
                notes="UP Main Line Track Span (Continuous Welded Rail)", track_line="UP",
                start_location_ref="KM 0.0", end_location_ref="KM 1.8", chainage_start_km=0.0, chainage_end_km=1.8
            ),
            Asset(
                section_id=sec_dm.id, department_id=eng_dept.id, asset_type="Track Section", health_state="Good",
                notes="DOWN Main Line Track Span", track_line="DOWN",
                start_location_ref="KM 0.0", end_location_ref="KM 1.8", chainage_start_km=0.0, chainage_end_km=1.8
            ),
            Asset(
                section_id=sec_dm.id, department_id=eng_dept.id, asset_type="Crossover", health_state="Good",
                notes="Crossover 101 connecting UP and DOWN lines", track_line="BOTH",
                start_location_ref="KM 1.1", end_location_ref="KM 1.3", chainage_start_km=1.1, chainage_end_km=1.3
            ),
            Asset(
                section_id=sec_dm.id, department_id=snt_dept.id, asset_type="Signal", health_state="Good",
                notes="Automatic Block Signal S101", track_line="UP",
                start_location_ref="Signal S101", end_location_ref="Signal S101", chainage_start_km=0.6, chainage_end_km=0.6
            ),
            Asset(
                section_id=sec_dm.id, department_id=snt_dept.id, asset_type="Signal", health_state="Good",
                notes="Home Signal S102 Interlocking Span", track_line="UP",
                start_location_ref="Signal S102", end_location_ref="Signal S102", chainage_start_km=1.3, chainage_end_km=1.3
            ),
            Asset(
                section_id=sec_dm.id, department_id=snt_dept.id, asset_type="Point Machine", health_state="Good",
                notes="Point Machine PM-101 on Crossover 101", track_line="UP",
                start_location_ref="Point 101", end_location_ref="Point 101", chainage_start_km=1.2, chainage_end_km=1.25
            ),
            Asset(
                section_id=sec_dm.id, department_id=trd_dept.id, asset_type="OHE Mast", health_state="Good",
                notes="OHE Mast Range M01 to M08 (Tension Length 1)", track_line="UP",
                start_location_ref="Mast M01", end_location_ref="Mast M08", chainage_start_km=0.0, chainage_end_km=1.8
            ),
            Asset(
                section_id=sec_dm.id, department_id=trd_dept.id, asset_type="Electrical Section", health_state="Good",
                notes="25kV Catenary Isolator ES-DM-01", track_line="UP",
                start_location_ref="Isolator ISO-101", end_location_ref="Isolator ISO-102", chainage_start_km=0.5, chainage_end_km=1.8
            ),

            # Matunga–Sion (KM 1.8 - 4.0)
            Asset(
                section_id=sec_ms.id, department_id=eng_dept.id, asset_type="Track Section", health_state="Degraded",
                notes="Rail Joint MS-DN-01 Track Span", track_line="DOWN",
                start_location_ref="KM 1.8", end_location_ref="KM 4.0", chainage_start_km=1.8, chainage_end_km=4.0
            ),
            Asset(
                section_id=sec_ms.id, department_id=eng_dept.id, asset_type="Track Section", health_state="Good",
                notes="UP Main Line Track Span MS-UP-01", track_line="UP",
                start_location_ref="KM 1.8", end_location_ref="KM 4.0", chainage_start_km=1.8, chainage_end_km=4.0
            ),
            Asset(
                section_id=sec_ms.id, department_id=snt_dept.id, asset_type="Signal", health_state="Good",
                notes="Down Advance Starter Signal S103", track_line="DOWN",
                start_location_ref="Signal S103", end_location_ref="Signal S103", chainage_start_km=2.4, chainage_end_km=2.4
            ),
            Asset(
                section_id=sec_ms.id, department_id=snt_dept.id, asset_type="Point Machine", health_state="Good",
                notes="Point Machine PM-102 on DOWN track", track_line="DOWN",
                start_location_ref="Point 102", end_location_ref="Point 102", chainage_start_km=2.3, chainage_end_km=2.35
            ),
            Asset(
                section_id=sec_ms.id, department_id=trd_dept.id, asset_type="OHE Mast", health_state="Good",
                notes="OHE Mast Range MS-M01 to M10", track_line="UP",
                start_location_ref="Mast MS-M01", end_location_ref="Mast MS-M10", chainage_start_km=1.8, chainage_end_km=4.0
            ),

            # Sion–Kurla (KM 4.0 - 7.5)
            Asset(
                section_id=sec_sk.id, department_id=eng_dept.id, asset_type="Track Section", health_state="Good",
                notes="UP Main Line SK-UP-01", track_line="UP",
                start_location_ref="KM 4.0", end_location_ref="KM 7.5", chainage_start_km=4.0, chainage_end_km=7.5
            ),
            Asset(
                section_id=sec_sk.id, department_id=eng_dept.id, asset_type="Turnout", health_state="Good",
                notes="Turnout T-201 Kurla Approach", track_line="UP",
                start_location_ref="KM 4.9", end_location_ref="KM 5.1", chainage_start_km=4.9, chainage_end_km=5.1
            ),
            Asset(
                section_id=sec_sk.id, department_id=snt_dept.id, asset_type="Signal", health_state="Good",
                notes="Signal S201 Kurla Up Approach", track_line="UP",
                start_location_ref="Signal S201", end_location_ref="Signal S201", chainage_start_km=5.1, chainage_end_km=5.1
            ),
            Asset(
                section_id=sec_sk.id, department_id=trd_dept.id, asset_type="OHE Mast", health_state="Good",
                notes="OHE Contact Wire Span SK-CW01", track_line="UP",
                start_location_ref="Mast SK-M01", end_location_ref="Mast SK-M15", chainage_start_km=4.0, chainage_end_km=7.5
            ),

            # Kurla–Ghatkopar (KM 7.5 - 11.6)
            Asset(
                section_id=sec_kg.id, department_id=eng_dept.id, asset_type="Track Section", health_state="Good",
                notes="DOWN Track Alignment KG-DN-01", track_line="DOWN",
                start_location_ref="KM 7.5", end_location_ref="KM 11.6", chainage_start_km=7.5, chainage_end_km=11.6
            ),
            Asset(
                section_id=sec_kg.id, department_id=snt_dept.id, asset_type="Signal", health_state="Good",
                notes="Signal S301 Ghatkopar Outer", track_line="UP",
                start_location_ref="Signal S301", end_location_ref="Signal S301", chainage_start_km=8.8, chainage_end_km=8.8
            ),
            Asset(
                section_id=sec_kg.id, department_id=trd_dept.id, asset_type="OHE Mast", health_state="Good",
                notes="OHE Section KG-M01 to M18", track_line="UP",
                start_location_ref="Mast KG-M01", end_location_ref="Mast KG-M18", chainage_start_km=7.5, chainage_end_km=11.6
            ),

            # Ghatkopar–Vikhroli (KM 11.6 - 14.8)
            Asset(
                section_id=sec_gv.id, department_id=eng_dept.id, asset_type="Track Section", health_state="Good",
                notes="UP Track Section GV-UP-01", track_line="UP",
                start_location_ref="KM 11.6", end_location_ref="KM 14.8", chainage_start_km=11.6, chainage_end_km=14.8
            ),
            Asset(
                section_id=sec_gv.id, department_id=snt_dept.id, asset_type="Track Circuit", health_state="Good",
                notes="Track Circuit TC-GV01 Vikhroli Approach", track_line="UP",
                start_location_ref="Track Circuit TC-GV01", end_location_ref="TC-GV01", chainage_start_km=12.5, chainage_end_km=12.7
            ),
            Asset(
                section_id=sec_gv.id, department_id=trd_dept.id, asset_type="OHE Mast", health_state="Good",
                notes="OHE Mast GV-M01 to GV-M14", track_line="UP",
                start_location_ref="Mast GV-M01", end_location_ref="Mast GV-M14", chainage_start_km=11.6, chainage_end_km=14.8
            ),
        ]
        db.add_all(assets)
        db.flush()

        # Asset pointers for task linking
        ast_dm_track = assets[0]
        ast_dm_sig = assets[3]
        ast_dm_ohe = assets[6]
        ast_ms_track = assets[8]
        ast_ms_pm = assets[11]
        ast_ms_ohe = assets[12]
        ast_sk_track = assets[13]
        ast_sk_ohe = assets[16]
        ast_kg_track = assets[17]
        ast_gv_tc = assets[21]

        # 4. 7 Resources
        r_gang_a = Resource(department_id=eng_dept.id, resource_type="Crew", name="Track Maintenance Gang A", is_available=True)
        r_machine_a = Resource(department_id=eng_dept.id, resource_type="Equipment", name="Track Tamping Machine A", is_available=True)
        r_eng_sup = Resource(department_id=eng_dept.id, resource_type="Crew", name="Engineering Supervisor", is_available=True)
        r_snt_team_a = Resource(department_id=snt_dept.id, resource_type="Crew", name="Signal Maintenance Team A", is_available=True)
        r_snt_test_kit = Resource(department_id=snt_dept.id, resource_type="Equipment", name="Signal Testing Kit", is_available=True)
        r_trd_crew_a = Resource(department_id=trd_dept.id, resource_type="Crew", name="TRD Maintenance Crew A", is_available=True)
        r_tower_a = Resource(department_id=trd_dept.id, resource_type="Equipment", name="Tower Wagon TW-01", is_available=True)

        db.add_all([r_gang_a, r_machine_a, r_eng_sup, r_snt_team_a, r_snt_test_kit, r_trd_crew_a, r_tower_a])
        db.flush()

        # 5. Train Movements on DEMO_DATE (2026-09-24)
        base_dt = datetime.strptime(DEMO_DATE_STR, "%Y-%m-%d")

        trains = [
            # Train 12021 (CSMT - Pune Superfast Express) - departs CSMT, passes Dadar-Matunga 02:20 - 02:40
            TrainMovement(
                section_id=sec_dm.id, train_type="Passenger", train_number="12021",
                entry_time=base_dt + timedelta(hours=2, minutes=20),
                exit_time=base_dt + timedelta(hours=2, minutes=40),
                scheduled_entry_time=base_dt + timedelta(hours=2, minutes=20),
                scheduled_exit_time=base_dt + timedelta(hours=2, minutes=40),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Timetable",
                notes="CSMT to Pune Superfast (Affects Window 2)",
            ),
            # Down Suburban Fast (CSMT to Kalyan) 05:30 - 05:50
            TrainMovement(
                section_id=sec_dm.id, train_type="Passenger", train_number="95101",
                entry_time=base_dt + timedelta(hours=5, minutes=30),
                exit_time=base_dt + timedelta(hours=5, minutes=50),
                scheduled_entry_time=base_dt + timedelta(hours=5, minutes=30),
                scheduled_exit_time=base_dt + timedelta(hours=5, minutes=50),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Down Suburban Fast Local",
            ),
            # Up Suburban Fast (Kalyan to CSMT) 05:40 - 06:00
            TrainMovement(
                section_id=sec_dm.id, train_type="Passenger", train_number="95102",
                entry_time=base_dt + timedelta(hours=5, minutes=40),
                exit_time=base_dt + timedelta(hours=6, minutes=0),
                scheduled_entry_time=base_dt + timedelta(hours=5, minutes=40),
                scheduled_exit_time=base_dt + timedelta(hours=6, minutes=0),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Up Suburban Fast Local",
            ),
            # Express 11001 (CSMT - Kolhapur Mahalaxmi Express)
            TrainMovement(
                section_id=sec_ms.id, train_type="Passenger", train_number="11001",
                entry_time=base_dt + timedelta(hours=23, minutes=30),
                exit_time=base_dt + timedelta(hours=23, minutes=55),
                scheduled_entry_time=base_dt + timedelta(hours=23, minutes=30),
                scheduled_exit_time=base_dt + timedelta(hours=23, minutes=55),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Timetable",
                notes="Mahalaxmi Express Outbound",
            ),
            # Train 12111 (CSMT - Amravati Express) passing Matunga-Sion 03:30 - 03:50
            TrainMovement(
                section_id=sec_ms.id, train_type="Passenger", train_number="12111",
                entry_time=base_dt + timedelta(hours=3, minutes=30),
                exit_time=base_dt + timedelta(hours=3, minutes=50),
                scheduled_entry_time=base_dt + timedelta(hours=3, minutes=30),
                scheduled_exit_time=base_dt + timedelta(hours=3, minutes=50),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Timetable",
                notes="Amravati Express",
            ),
            # Down Suburban Local (Sion-Kurla) 06:15 - 06:35
            TrainMovement(
                section_id=sec_sk.id, train_type="Passenger", train_number="95201",
                entry_time=base_dt + timedelta(hours=6, minutes=15),
                exit_time=base_dt + timedelta(hours=6, minutes=35),
                scheduled_entry_time=base_dt + timedelta(hours=6, minutes=15),
                scheduled_exit_time=base_dt + timedelta(hours=6, minutes=35),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Morning Down Suburban Local",
            ),
            # Up Suburban Local (Sion-Kurla) 06:30 - 06:50
            TrainMovement(
                section_id=sec_sk.id, train_type="Passenger", train_number="95202",
                entry_time=base_dt + timedelta(hours=6, minutes=30),
                exit_time=base_dt + timedelta(hours=6, minutes=50),
                scheduled_entry_time=base_dt + timedelta(hours=6, minutes=30),
                scheduled_exit_time=base_dt + timedelta(hours=6, minutes=50),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Morning Up Suburban Local",
            ),
            # JNPT Container Freight Rake G-801 on Kurla-Ghatkopar DOWN 01:15 - 01:45
            TrainMovement(
                section_id=sec_kg.id, train_type="Goods", train_number="G-801",
                entry_time=base_dt + timedelta(hours=1, minutes=15),
                exit_time=base_dt + timedelta(hours=1, minutes=45),
                scheduled_entry_time=base_dt + timedelta(hours=1, minutes=15),
                scheduled_exit_time=base_dt + timedelta(hours=1, minutes=45),
                priority=2, delay_minutes=0, forecast_confidence=0.9, source="FOIS Goods Feed",
                notes="JNPT Container Freight Rake",
            ),
            # Suburban Local 95301 (Kurla - Vikhroli) 07:00 - 07:25
            TrainMovement(
                section_id=sec_gv.id, train_type="Passenger", train_number="95301",
                entry_time=base_dt + timedelta(hours=7, minutes=0),
                exit_time=base_dt + timedelta(hours=7, minutes=25),
                scheduled_entry_time=base_dt + timedelta(hours=7, minutes=0),
                scheduled_exit_time=base_dt + timedelta(hours=7, minutes=25),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Early Peak Commuter Local",
            ),
            # Suburban Local 95302 (Vikhroli - Kurla) 07:15 - 07:40
            TrainMovement(
                section_id=sec_gv.id, train_type="Passenger", train_number="95302",
                entry_time=base_dt + timedelta(hours=7, minutes=15),
                exit_time=base_dt + timedelta(hours=7, minutes=40),
                scheduled_entry_time=base_dt + timedelta(hours=7, minutes=15),
                scheduled_exit_time=base_dt + timedelta(hours=7, minutes=40),
                priority=1, delay_minutes=0, forecast_confidence=1.0, source="CR Suburban Timetable",
                notes="Early Peak Commuter Up Local",
            ),
        ]
        db.add_all(trains)
        db.flush()

        # 6. Candidate Block Windows (Explicitly seeded for predictable, intuitive planning)
        windows = [
            # Dadar–Matunga Candidate Windows (UP & DOWN)
            # Window 1: 00:40 - 01:55 (75m, UP, 0 trains)
            BlockWindow(
                section_id=sec_dm.id,
                window_start=base_dt + timedelta(hours=0, minutes=40),
                window_end=base_dt + timedelta(hours=1, minutes=55),
                block_type="Maintenance",
                is_available=True,
                risk_score=0.10,
            ),
            # Window 2: 02:10 - 03:25 (75m, UP, 1 train affected: 12021)
            BlockWindow(
                section_id=sec_dm.id,
                window_start=base_dt + timedelta(hours=2, minutes=10),
                window_end=base_dt + timedelta(hours=3, minutes=25),
                block_type="Maintenance",
                is_available=True,
                risk_score=0.35,
            ),
            # Window 3: 03:45 - 05:00 (75m, UP, 0 trains)
            BlockWindow(
                section_id=sec_dm.id,
                window_start=base_dt + timedelta(hours=3, minutes=45),
                window_end=base_dt + timedelta(hours=5, minutes=0),
                block_type="Maintenance",
                is_available=True,
                risk_score=0.12,
            ),
            # Window 4: DOWN line window 01:00 - 02:30 (90m)
            BlockWindow(
                section_id=sec_dm.id,
                window_start=base_dt + timedelta(hours=1, minutes=0),
                window_end=base_dt + timedelta(hours=2, minutes=30),
                block_type="Maintenance",
                is_available=True,
                risk_score=0.15,
            ),

            # Matunga–Sion Candidate Windows
            BlockWindow(
                section_id=sec_ms.id,
                window_start=base_dt + timedelta(hours=0, minutes=30),
                window_end=base_dt + timedelta(hours=2, minutes=30),  # 120 min
                block_type="Maintenance",
                is_available=True,
                risk_score=0.15,
            ),
            BlockWindow(
                section_id=sec_ms.id,
                window_start=base_dt + timedelta(hours=2, minutes=45),
                window_end=base_dt + timedelta(hours=4, minutes=45),  # 120 min
                block_type="Maintenance",
                is_available=True,
                risk_score=0.25,
            ),

            # Sion–Kurla Candidate Windows
            BlockWindow(
                section_id=sec_sk.id,
                window_start=base_dt + timedelta(hours=0, minutes=45),
                window_end=base_dt + timedelta(hours=3, minutes=15),  # 150 min
                block_type="Maintenance",
                is_available=True,
                risk_score=0.20,
            ),
            BlockWindow(
                section_id=sec_sk.id,
                window_start=base_dt + timedelta(hours=3, minutes=30),
                window_end=base_dt + timedelta(hours=5, minutes=30),  # 120 min
                block_type="Maintenance",
                is_available=True,
                risk_score=0.18,
            ),

            # Kurla–Ghatkopar Candidate Windows
            BlockWindow(
                section_id=sec_kg.id,
                window_start=base_dt + timedelta(hours=1, minutes=30),
                window_end=base_dt + timedelta(hours=3, minutes=30),  # 120 min
                block_type="Maintenance",
                is_available=True,
                risk_score=0.25,
            ),

            # Ghatkopar–Vikhroli Candidate Windows
            BlockWindow(
                section_id=sec_gv.id,
                window_start=base_dt + timedelta(hours=0, minutes=45),
                window_end=base_dt + timedelta(hours=2, minutes=15),  # 90 min
                block_type="Maintenance",
                is_available=True,
                risk_score=0.15,
            ),
            BlockWindow(
                section_id=sec_gv.id,
                window_start=base_dt + timedelta(hours=2, minutes=30),
                window_end=base_dt + timedelta(hours=4, minutes=0),  # 90 min
                block_type="Maintenance",
                is_available=True,
                risk_score=0.20,
            ),
        ]
        db.add_all(windows)
        db.flush()

        # 7. Exactly 10 Small, Intentional Maintenance Tasks
        # Demonstrates:
        # - Independent work
        # - Compatible joint work (ENG-01 + SNT-01 + TRD-01 on Dadar-Matunga UP)
        # - Compatible joint work (ENG-02 + SNT-02 on Matunga-Sion DOWN)
        # - Incompatible work (ENG-02 on DOWN vs TRD-02 on UP)
        # - Traffic Block, Power Block, S&T Disconnection
        # - UP vs DOWN line separation
        detected_time = base_dt - timedelta(hours=12)
        due_time = base_dt + timedelta(days=1, hours=12)

        tasks = [
            # TASK 1: ENG-01 (Track Inspection on Dadar–Matunga UP)
            MaintenanceTask(
                task_code="ENG-01",
                department_id=eng_dept.id,
                section_id=sec_dm.id,
                asset_id=ast_dm_track.id,
                maintenance_type="Track Inspection",
                severity="Critical",
                detected_at=detected_time,
                due_date=due_time,
                estimated_duration_min=60,
                minimum_contiguous_block_min=45,
                requires_power_isolation=False,
                requires_signal_disconnection=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.4,
                chainage_to_km=1.2,
                location_type="chainage",
                start_entity_id="KM 0.4",
                end_entity_id="KM 1.2",
                location_display="KM 0.400 → KM 1.200 [UP Line]",
                status="Ready for Planning",
                source="Civil P-Way Inspection",
                description="Ultrasonic flaw detection follow-up and rail joint inspection on UP line.",
                priority_score=85.0,
            ),
            # TASK 2: SNT-01 (Signal Inspection on Dadar–Matunga UP - Coordinated with ENG-01)
            MaintenanceTask(
                task_code="SNT-01",
                department_id=snt_dept.id,
                section_id=sec_dm.id,
                asset_id=ast_dm_sig.id,
                maintenance_type="Signal Inspection",
                severity="High",
                detected_at=detected_time,
                due_date=due_time,
                estimated_duration_min=60,
                minimum_contiguous_block_min=45,
                requires_power_isolation=False,
                requires_signal_disconnection=True,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.8,
                chainage_to_km=1.3,
                location_type="chainage",
                start_entity_id="Signal S101",
                end_entity_id="Signal S102",
                location_display="KM 0.800 → KM 1.300 [Signal S101-S102]",
                status="Ready for Planning",
                source="S&T Maintenance Register",
                description="Quarterly signal interlocking and track circuit shunt testing.",
                priority_score=80.0,
            ),
            # TASK 3: TRD-01 (OHE Inspection on Dadar–Matunga UP - Coordinated with ENG-01 & SNT-01)
            MaintenanceTask(
                task_code="TRD-01",
                department_id=trd_dept.id,
                section_id=sec_dm.id,
                asset_id=ast_dm_ohe.id,
                maintenance_type="OHE Inspection",
                severity="High",
                detected_at=detected_time,
                due_date=due_time,
                estimated_duration_min=60,
                minimum_contiguous_block_min=45,
                requires_power_isolation=True,
                requires_signal_disconnection=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=0.7,
                chainage_to_km=1.5,
                location_type="chainage",
                start_entity_id="Mast M01",
                end_entity_id="Mast M08",
                location_display="KM 0.700 → KM 1.500 [Mast M01-M08]",
                status="Ready for Planning",
                source="TRD Catenary Register",
                description="Contact wire stagger measurement and dropper tightening under power block.",
                priority_score=80.0,
            ),

            # TASK 4: ENG-02 (Rail Joint Maintenance on Matunga–Sion DOWN)
            MaintenanceTask(
                task_code="ENG-02",
                department_id=eng_dept.id,
                section_id=sec_ms.id,
                asset_id=ast_ms_track.id,
                maintenance_type="Rail Joint Maintenance",
                severity="High",
                detected_at=detected_time,
                due_date=due_time,
                estimated_duration_min=90,
                minimum_contiguous_block_min=75,
                requires_power_isolation=False,
                requires_signal_disconnection=False,
                can_run_parallel=True,
                track_line="DOWN",
                chainage_from_km=2.2,
                chainage_to_km=3.0,
                location_type="chainage",
                start_entity_id="KM 2.2",
                end_entity_id="KM 3.0",
                location_display="KM 2.200 → KM 3.000 [DOWN Line]",
                status="Ready for Planning",
                source="P-Way Gang Register",
                description="Thermit weld grinding and fishplate tightening on DOWN track.",
                priority_score=75.0,
            ),
            # TASK 5: SNT-02 (Point Machine Overhaul on Matunga–Sion DOWN - Coordinated with ENG-02)
            MaintenanceTask(
                task_code="SNT-02",
                department_id=snt_dept.id,
                section_id=sec_ms.id,
                asset_id=ast_ms_pm.id,
                maintenance_type="Point Machine Overhaul",
                severity="Medium",
                detected_at=detected_time,
                due_date=due_time,
                estimated_duration_min=75,
                minimum_contiguous_block_min=60,
                requires_power_isolation=False,
                requires_signal_disconnection=True,
                can_run_parallel=True,
                track_line="DOWN",
                chainage_from_km=2.2,
                chainage_to_km=2.6,
                location_type="chainage",
                start_entity_id="Point PM-102",
                end_entity_id="Point PM-102",
                location_display="KM 2.200 → KM 2.600 [Point PM-102]",
                status="Ready for Planning",
                source="S&T Inspection",
                description="Point machine lubrication and stroke timing calibration.",
                priority_score=70.0,
            ),

            # TASK 6: TRD-02 (Cantilever Adjustment on Matunga–Sion UP - Incompatible with ENG-02/SNT-02 because different line)
            MaintenanceTask(
                task_code="TRD-02",
                department_id=trd_dept.id,
                section_id=sec_ms.id,
                asset_id=ast_ms_ohe.id,
                maintenance_type="Cantilever Adjustment",
                severity="Medium",
                detected_at=detected_time,
                due_date=due_time,
                estimated_duration_min=90,
                minimum_contiguous_block_min=60,
                requires_power_isolation=True,
                requires_signal_disconnection=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=2.0,
                chainage_to_km=3.2,
                location_type="chainage",
                start_entity_id="Mast MS-M01",
                end_entity_id="Mast MS-M10",
                location_display="KM 2.000 → KM 3.200 [UP Line OHE]",
                status="Ready for Planning",
                source="TRD Tower Wagon Schedule",
                description="Bracket insulator cleaning and steady arm alignment.",
                priority_score=65.0,
            ),

            # TASK 7: ENG-03 (Turnout Deep Screening on Sion–Kurla UP)
            MaintenanceTask(
                task_code="ENG-03",
                department_id=eng_dept.id,
                section_id=sec_sk.id,
                asset_id=ast_sk_track.id,
                maintenance_type="Turnout Deep Screening",
                severity="Medium",
                detected_at=detected_time,
                due_date=due_time,
                estimated_duration_min=120,
                minimum_contiguous_block_min=90,
                requires_power_isolation=False,
                requires_signal_disconnection=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=4.5,
                chainage_to_km=5.5,
                location_type="chainage",
                start_entity_id="Turnout T-201",
                end_entity_id="Turnout T-201",
                location_display="KM 4.500 → KM 5.500 [Turnout T-201]",
                status="Ready for Planning",
                source="Track Machine Division",
                description="Ballast cleaning machine deployment on Turnout 201.",
                priority_score=60.0,
            ),
            # TASK 8: TRD-03 (Contact Wire Replacement on Sion–Kurla UP - Coordinated with ENG-03)
            MaintenanceTask(
                task_code="TRD-03",
                department_id=trd_dept.id,
                section_id=sec_sk.id,
                asset_id=ast_sk_ohe.id,
                maintenance_type="Contact Wire Replacement",
                severity="Medium",
                detected_at=detected_time,
                due_date=due_time,
                estimated_duration_min=120,
                minimum_contiguous_block_min=90,
                requires_power_isolation=True,
                requires_signal_disconnection=False,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=4.8,
                chainage_to_km=6.0,
                location_type="chainage",
                start_entity_id="Mast SK-M01",
                end_entity_id="Mast SK-M15",
                location_display="KM 4.800 → KM 6.000 [OHE Span SK-CW01]",
                status="Ready for Planning",
                source="TRD Annual Overhaul",
                description="Renewal of worn contact wire segment under Tower Wagon.",
                priority_score=65.0,
            ),

            # TASK 9: ENG-04 (Ultrasonic Flaw Detection on Kurla–Ghatkopar DOWN)
            MaintenanceTask(
                task_code="ENG-04",
                department_id=eng_dept.id,
                section_id=sec_kg.id,
                asset_id=ast_kg_track.id,
                maintenance_type="Ultrasonic Flaw Detection",
                severity="High",
                detected_at=detected_time,
                due_date=due_time,
                estimated_duration_min=60,
                minimum_contiguous_block_min=45,
                requires_power_isolation=False,
                requires_signal_disconnection=False,
                can_run_parallel=True,
                track_line="DOWN",
                chainage_from_km=8.0,
                chainage_to_km=9.5,
                location_type="chainage",
                start_entity_id="KM 8.0",
                end_entity_id="KM 9.5",
                location_display="KM 8.000 → KM 9.500 [DOWN Line]",
                status="Ready for Planning",
                source="USFD Team",
                description="Flaw detector trolley testing on continuous welded rail.",
                priority_score=70.0,
            ),

            # TASK 10: SNT-03 (Track Circuit Testing on Ghatkopar–Vikhroli UP)
            MaintenanceTask(
                task_code="SNT-03",
                department_id=snt_dept.id,
                section_id=sec_gv.id,
                asset_id=ast_gv_tc.id,
                maintenance_type="Track Circuit Testing",
                severity="Medium",
                detected_at=detected_time,
                due_date=due_time,
                estimated_duration_min=45,
                minimum_contiguous_block_min=30,
                requires_power_isolation=False,
                requires_signal_disconnection=True,
                can_run_parallel=True,
                track_line="UP",
                chainage_from_km=12.0,
                chainage_to_km=13.2,
                location_type="chainage",
                start_entity_id="TC-GV01",
                end_entity_id="TC-GV01",
                location_display="KM 12.000 → KM 13.200 [Track Circuit TC-GV01]",
                status="Ready for Planning",
                source="S&T Routine Roster",
                description="Drop shunt value and relay room voltage verification.",
                priority_score=55.0,
            ),
        ]
        db.add_all(tasks)
        db.flush()

        # Link Task Resource Requirements
        # ENG-01 needs Gang A & Supervisor
        trr_rows = [
            TaskResourceRequirement(task_id=tasks[0].id, resource_id=r_gang_a.id),
            TaskResourceRequirement(task_id=tasks[0].id, resource_id=r_eng_sup.id),
            # SNT-01 needs Signal Team A & Test Kit
            TaskResourceRequirement(task_id=tasks[1].id, resource_id=r_snt_team_a.id),
            TaskResourceRequirement(task_id=tasks[1].id, resource_id=r_snt_test_kit.id),
            # TRD-01 needs TRD Crew A & Tower Wagon A
            TaskResourceRequirement(task_id=tasks[2].id, resource_id=r_trd_crew_a.id),
            TaskResourceRequirement(task_id=tasks[2].id, resource_id=r_tower_a.id),
            # ENG-02 needs Gang A & Machine A
            TaskResourceRequirement(task_id=tasks[3].id, resource_id=r_gang_a.id),
            TaskResourceRequirement(task_id=tasks[3].id, resource_id=r_machine_a.id),
            # SNT-02 needs Signal Team A
            TaskResourceRequirement(task_id=tasks[4].id, resource_id=r_snt_team_a.id),
            # TRD-02 needs Tower Wagon
            TaskResourceRequirement(task_id=tasks[5].id, resource_id=r_tower_a.id),
        ]
        db.add_all(trr_rows)
        db.commit()

        # 8. Pre-compute solver plan using actual CP-SAT optimizer for Dadar–Matunga & Corridor
        sec_ids = [str(s.id) for s in sections]
        bundle = prepare_optimization_input(
            db=db,
            section_ids=sec_ids,
            start_date=base_dt,
            end_date=base_dt + timedelta(days=1),
            horizon="weekly",
        )
        opt_res = run_sangam_optimizer(bundle, db, time_limit_seconds=15, generate_alternatives=True)
        print(f"Generated optimization run: {opt_res.get('run_id')} ({opt_res.get('tasks_scheduled')} tasks scheduled, {opt_res.get('blocks_count')} blocks).")

        # 9. Create 1 pre-approved block as baseline demonstration on Ghatkopar-Vikhroli
        # so Operations Overview shows: Approved Today = 1, Proposed Blocks = 3, Pending Maintenance = 9
        app_block = GeneratedBlock(
            id=uuid.uuid4(),
            run_id=uuid.UUID(opt_res["run_id"]),
            section_id=sec_gv.id,
            block_start=base_dt + timedelta(hours=0, minutes=45),
            block_end=base_dt + timedelta(hours=1, minutes=30),  # 45 min
            is_joint_block=False,
            corridor_display="Ghatkopar ↔ Vikhroli",
            spatial_coverage="KM 12.00 – 13.20 (Track Circuit TC-GV01)",
            approval_status="approved",
            execution_status="approved",
            approval_note="Night possession sanctioned by Chief Operating Controller",
            approved_at=datetime.utcnow() - timedelta(hours=1),
            approved_by="Sr. DOM (Coaching) Mumbai",
            locked=True,
        )
        db.add(app_block)
        db.flush()

        gbt = GeneratedBlockTask(
            block_id=app_block.id,
            task_id=tasks[9].id,  # SNT-03
            task_start=app_block.block_start,
            task_end=app_block.block_end,
            scheduled_duration_min=45,
        )
        db.add(gbt)
        tasks[9].status = "Scheduled"
        db.commit()

        print(f"Pre-approved block created: {app_block.id} (SNT-03 marked as Scheduled).")
        print("=== SANGAM DEMO DATASET READY ===")

    except Exception as e:
        db.rollback()
        print(f"ERROR resetting demo dataset: {e}")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    reset_demo()
