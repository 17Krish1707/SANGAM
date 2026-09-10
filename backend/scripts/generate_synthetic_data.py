import os
import sys
import random
from datetime import datetime, timedelta

# Ensure backend package can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal, init_db
from backend.models.department import Department
from backend.models.section import RailwaySection
from backend.models.asset import Asset
from backend.models.task import MaintenanceTask
from backend.models.train import TrainMovement
from backend.models.block_window import BlockWindow
from backend.models.resource import Resource, TaskResourceRequirement
from backend.models.conflict import TaskConflict
from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask

# Task catalog with realistic durations
TASK_CATALOG = {
    "ENG": [
        {"type": "Weld Repair & Ultrasonic Testing", "min_dur": 60, "max_dur": 120, "power_iso_prob": 0.1, "parallel_prob": 0.6},
        {"type": "Track Tamping & Packing", "min_dur": 90, "max_dur": 180, "power_iso_prob": 0.4, "parallel_prob": 0.3},
        {"type": "Rail Joint De-stressing", "min_dur": 75, "max_dur": 150, "power_iso_prob": 0.2, "parallel_prob": 0.4},
        {"type": "Turnout & Crossings Overhaul", "min_dur": 120, "max_dur": 240, "power_iso_prob": 0.3, "parallel_prob": 0.2},
        {"type": "Ballast Screening & Cleaning", "min_dur": 150, "max_dur": 240, "power_iso_prob": 0.2, "parallel_prob": 0.2},
    ],
    "TRD": [
        {"type": "OHE Routine Inspection & Stagger Adjustment", "min_dur": 45, "max_dur": 90, "power_iso_prob": 0.9, "parallel_prob": 0.7},
        {"type": "Contact Wire Tensioning & Replacement", "min_dur": 90, "max_dur": 180, "power_iso_prob": 1.0, "parallel_prob": 0.3},
        {"type": "Isolator & Sectioning Switch Servicing", "min_dur": 60, "max_dur": 120, "power_iso_prob": 0.95, "parallel_prob": 0.5},
        {"type": "Cantilever Assembly Overhaul", "min_dur": 75, "max_dur": 150, "power_iso_prob": 1.0, "parallel_prob": 0.4},
        {"type": "Neutral Section & Insulator Washing", "min_dur": 45, "max_dur": 90, "power_iso_prob": 0.85, "parallel_prob": 0.6},
    ],
    "SNT": [
        {"type": "Point Machine Inspection & Testing", "min_dur": 30, "max_dur": 60, "power_iso_prob": 0.05, "parallel_prob": 0.7},
        {"type": "Track Circuit & Axle Counter Calibration", "min_dur": 45, "max_dur": 90, "power_iso_prob": 0.05, "parallel_prob": 0.8},
        {"type": "Signal Aspect Bulb & LED Replacement", "min_dur": 30, "max_dur": 60, "power_iso_prob": 0.0, "parallel_prob": 0.8},
        {"type": "Electronic Interlocking Diagnostic Overhaul", "min_dur": 60, "max_dur": 120, "power_iso_prob": 0.0, "parallel_prob": 0.5},
        {"type": "Cables & Relay Rack Maintenance", "min_dur": 60, "max_dur": 120, "power_iso_prob": 0.0, "parallel_prob": 0.6},
    ],
}

ASSET_CATALOG = {
    "ENG": ["Track Section 100m", "Turnout Switch 1:12", "Insulated Rail Joint", "Ballast Cushion Bed"],
    "TRD": ["OHE Mast & Cantilever", "Contact Wire Segment 500m", "Substation Isolator Switch", "Section Insulator Assembly"],
    "SNT": ["Point Machine 220V", "Axle Counter Detection Unit", "Colour Light Signal Mast", "Electronic Interlocking Rack"],
}


def clear_existing_data(db):
    """Cleanly clear existing generated and operational data for idempotency."""
    db.query(GeneratedBlockTask).delete()
    db.query(GeneratedBlock).delete()
    db.query(OptimizationRun).delete()
    db.query(TaskConflict).delete()
    db.query(TaskResourceRequirement).delete()
    db.query(BlockWindow).delete()
    db.query(TrainMovement).delete()
    db.query(MaintenanceTask).delete()
    db.query(Resource).delete()
    db.query(Asset).delete()
    db.query(RailwaySection).delete()
    db.commit()


def generate_synthetic_data(seed: int = 26027, recreate_tables: bool = True):
    """Generate reproducible synthetic dataset for the demo corridor."""
    random.seed(seed)
    init_db(drop_first=recreate_tables)
    db = SessionLocal()

    try:
        print(f"Clearing old dataset (seed={seed})...")
        clear_existing_data(db)

        # 1. Fetch departments
        depts = {d.code: d for d in db.query(Department).all()}
        if not depts or len(depts) < 3:
            from backend.scripts.seed_departments import seed_departments
            seed_departments()
            depts = {d.code: d for d in db.query(Department).all()}

        # 2. Corridor: Dadar -> Matunga -> Sion -> Kurla -> Ghatkopar -> Vikhroli (5 sections)
        print("Generating 5 railway sections...")
        sections_data = [
            ("Dadar", "Matunga", "Dadar–Matunga", "double", "High-Density Suburban Quadruple Track Corridor"),
            ("Matunga", "Sion", "Matunga–Sion", "double", "Suburban Fast & Slow Trunk Segment"),
            ("Sion", "Kurla", "Sion–Kurla", "double", "Major Junction Approach Segment"),
            ("Kurla", "Ghatkopar", "Kurla–Ghatkopar", "double", "Heavy Commuter Density Bottleneck Segment"),
            ("Ghatkopar", "Vikhroli", "Ghatkopar–Vikhroli", "double", "Suburban Multi-Line Convergence Zone"),
        ]

        sections = []
        for from_stn, to_stn, name, l_type, notes in sections_data:
            sec = RailwaySection(
                name=name,
                from_station=from_stn,
                to_station=to_stn,
                line_type=l_type,
                section_capacity_notes=notes,
            )
            db.add(sec)
            sections.append(sec)
        db.flush()

        # 3. Assets: 4 assets per department per section (60 total assets)
        print("Generating assets across sections and departments...")
        assets_by_dept_sec = {dept_code: {s.id: [] for s in sections} for dept_code in depts}
        health_choices = ["Good", "Degraded", "Critical"]
        health_weights = [0.65, 0.25, 0.10]

        for sec in sections:
            for dept_code, dept in depts.items():
                for asset_type in ASSET_CATALOG[dept_code]:
                    h_state = random.choices(health_choices, weights=health_weights, k=1)[0]
                    asset = Asset(
                        asset_type=asset_type,
                        section_id=sec.id,
                        department_id=dept.id,
                        health_state=h_state,
                        notes=f"{asset_type} located on {sec.name}. Health state: {h_state}.",
                    )
                    db.add(asset)
                    db.flush()
                    assets_by_dept_sec[dept_code][sec.id].append(asset)

        # 4. Resources: 15 resources across 3 departments (Mix of Crew and Equipment)
        print("Generating 15 departmental resources (Crew & Equipment)...")
        resource_specs = [
            # Engineering (5)
            ("ENG", "Crew", "Track Maintenance Gang A"),
            ("ENG", "Crew", "Track Maintenance Gang B"),
            ("ENG", "Equipment", "Heavy Tamping Machine 01"),
            ("ENG", "Equipment", "USFD Flaw Detector Trolley"),
            ("ENG", "Equipment", "Rail Grinder Mobile Unit"),
            # TRD (5)
            ("TRD", "Crew", "OHE Tower Wagon Crew 1"),
            ("TRD", "Crew", "OHE Tower Wagon Crew 2"),
            ("TRD", "Equipment", "Tower Wagon Inspection Car TW-101"),
            ("TRD", "Crew", "Emergency Power Breakdown Squad"),
            ("TRD", "Equipment", "High-Voltage Grounding Trolley"),
            # S&T (5)
            ("SNT", "Crew", "Signal Inspection Team North"),
            ("SNT", "Crew", "Signal Inspection Team South"),
            ("SNT", "Crew", "Telecom & Interlocking Specialist Unit"),
            ("SNT", "Equipment", "Electronic Interlocking Diagnostic Rig"),
            ("SNT", "Equipment", "Point Machine Testing Apparatus"),
        ]

        resources_by_dept = {dept_code: [] for dept_code in depts}
        for dept_code, r_type, r_name in resource_specs:
            res = Resource(
                department_id=depts[dept_code].id,
                resource_type=r_type,
                name=r_name,
                is_available=True,
            )
            db.add(res)
            db.flush()
            resources_by_dept[dept_code].append(res)

        # 5. Maintenance Tasks: Exactly 120 tasks (45 ENG, 35 TRD, 40 SNT)
        print("Generating 120 maintenance tasks with non-uniform distributions...")
        dept_counts = {"ENG": 45, "TRD": 35, "SNT": 40}
        severities = ["Critical", "High", "Medium", "Low"]
        severity_weights = [0.08, 0.22, 0.40, 0.30]  # ~8% Critical, 22% High, 40% Med, 30% Low

        # Base reference date: Monday of current planning week (2026-09-07)
        base_date = datetime(2026, 9, 7, 8, 0, 0)
        tasks = []
        task_counter = 1001

        for dept_code, count in dept_counts.items():
            dept = depts[dept_code]
            for _ in range(count):
                sec = random.choice(sections)
                task_spec = random.choice(TASK_CATALOG[dept_code])
                sec_assets = assets_by_dept_sec[dept_code][sec.id]
                asset = random.choice(sec_assets) if sec_assets else None

                sev = random.choices(severities, weights=severity_weights, k=1)[0]
                dur = random.randint(task_spec["min_dur"], task_spec["max_dur"])
                min_block = max(30, int(dur * random.uniform(0.70, 0.85)))
                power_iso = random.random() < task_spec["power_iso_prob"]
                can_parallel = random.random() < task_spec["parallel_prob"]

                # ~10% overdue backlog, 90% due in upcoming 1-4 weeks
                is_overdue = random.random() < 0.10
                if is_overdue:
                    due_date = base_date - timedelta(days=random.randint(1, 10), hours=random.randint(0, 12))
                    detected_at = due_date - timedelta(days=random.randint(5, 14))
                else:
                    due_date = base_date + timedelta(days=random.randint(1, 28), hours=random.randint(0, 12))
                    detected_at = base_date - timedelta(days=random.randint(1, 10))

                task_code = f"{dept_code}-{task_counter}"
                task_counter += 1

                task = MaintenanceTask(
                    task_code=task_code,
                    department_id=dept.id,
                    section_id=sec.id,
                    asset_id=asset.id if asset else None,
                    maintenance_type=task_spec["type"],
                    severity=sev,
                    detected_at=detected_at,
                    due_date=due_date,
                    estimated_duration_min=dur,
                    minimum_contiguous_block_min=min_block,
                    requires_power_isolation=power_iso,
                    can_run_parallel=can_parallel,
                    status="Pending",
                    created_at=detected_at,
                )
                db.add(task)
                db.flush()
                tasks.append(task)

                # Link 1-3 resources from this department
                dept_res = resources_by_dept[dept_code]
                num_res = min(len(dept_res), random.randint(1, 3))
                chosen_res = random.sample(dept_res, num_res)
                for r in chosen_res:
                    trr = TaskResourceRequirement(task_id=task.id, resource_id=r.id)
                    db.add(trr)

        # 6. Train Movements: 80 trains per week (60 Passenger, 20 Goods) across 5 sections
        print("Generating 80 train movements (60 passenger clustered at peaks, 20 goods)...")
        horizon_days = 7

        # Peak hours: 06:00-10:00 and 17:00-21:00
        # Off-peak: 10:00-17:00 and 21:00-06:00
        for i in range(60):  # Passenger trains
            sec = random.choice(sections)
            day_offset = random.randint(0, horizon_days - 1)
            # 70% chance of peak window, 30% off-peak
            if random.random() < 0.70:
                peak_window = random.choice([(6, 10), (17, 21)])
                hour = random.randint(peak_window[0], peak_window[1] - 1)
            else:
                hour = random.choice([0, 1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16, 22, 23])
            minute = random.randint(0, 59)
            transit_min = random.randint(15, 30)

            entry_time = base_date + timedelta(days=day_offset, hours=hour, minutes=minute)
            exit_time = entry_time + timedelta(minutes=transit_min)

            tm = TrainMovement(
                section_id=sec.id,
                train_type="Passenger",
                entry_time=entry_time,
                exit_time=exit_time,
                priority=1,
                forecast_confidence=1.0,
            )
            db.add(tm)

        for i in range(20):  # Goods trains
            sec = random.choice(sections)
            day_offset = random.randint(0, horizon_days - 1)
            # Goods trains skew toward midday or night windows
            hour = random.choice([0, 1, 2, 3, 4, 11, 12, 13, 14, 15, 22, 23])
            minute = random.randint(0, 59)
            transit_min = random.randint(25, 50)

            entry_time = base_date + timedelta(days=day_offset, hours=hour, minutes=minute)
            exit_time = entry_time + timedelta(minutes=transit_min)
            confidence = round(random.uniform(0.60, 0.95), 2)

            tm = TrainMovement(
                section_id=sec.id,
                train_type="Goods",
                entry_time=entry_time,
                exit_time=exit_time,
                priority=2,
                forecast_confidence=confidence,
            )
            db.add(tm)

        # 7. Task Conflicts & Compatibilities: Seeded using exact business rules
        print("Generating task conflicts, compatibilities, and dependencies using rule-based logic...")
        # Group tasks by section
        tasks_by_sec = {s.id: [] for s in sections}
        for t in tasks:
            tasks_by_sec[t.section_id].append(t)

        conflict_count = 0
        compat_count = 0
        dep_count = 0

        for sec_id, sec_tasks in tasks_by_sec.items():
            n = len(sec_tasks)
            for i in range(n):
                for j in range(i + 1, n):
                    t_a = sec_tasks[i]
                    t_b = sec_tasks[j]

                    # Rule A: Both require power isolation on the same section -> Conflict
                    # (Safety rule: simultaneous heavy high-voltage work / ground switching conflicts)
                    if t_a.requires_power_isolation and t_b.requires_power_isolation:
                        c = TaskConflict(
                            task_a_id=t_a.id,
                            task_b_id=t_b.id,
                            relationship="conflict",
                            notes="Safety Conflict: Both tasks mandate high-voltage traction power isolation on the same section.",
                        )
                        db.add(c)
                        conflict_count += 1

                    # Rule B: Same section, same department, can_run_parallel=True on both, combined duration <= 180 min -> Compatible
                    elif (
                        t_a.department_id == t_b.department_id
                        and t_a.can_run_parallel
                        and t_b.can_run_parallel
                        and (t_a.estimated_duration_min + t_b.estimated_duration_min) <= 180
                    ):
                        c = TaskConflict(
                            task_a_id=t_a.id,
                            task_b_id=t_b.id,
                            relationship="compatible",
                            notes="Compatible: Both tasks are parallel-safe, within the same department and fit joint execution window.",
                        )
                        db.add(c)
                        compat_count += 1

            # Rule C: Precedence dependencies (~5% of tasks)
            # e.g., Inspection precedes overhaul or track packing follows screening
            for i in range(min(2, len(sec_tasks) - 1)):
                t_pred = sec_tasks[i]
                t_succ = sec_tasks[i + 1]
                if t_pred.id != t_succ.id:
                    c = TaskConflict(
                        task_a_id=t_pred.id,
                        task_b_id=t_succ.id,
                        relationship="dependency",
                        notes=f"Precedence Dependency: {t_pred.task_code} must complete before {t_succ.task_code} commences.",
                    )
                    db.add(c)
                    dep_count += 1

        db.commit()
        print("\nSynthetic data generation completed successfully!")
        print(f"  • Sections: {len(sections)}")
        print(f"  • Assets: {db.query(Asset).count()}")
        print(f"  • Resources: {len(resource_specs)}")
        print(f"  • Maintenance Tasks: {len(tasks)}")
        print(f"  • Train Movements: {db.query(TrainMovement).count()}")
        print(f"  • Task Conflicts seeded: {conflict_count}")
        print(f"  • Compatible Pairs seeded: {compat_count}")
        print(f"  • Precedence Dependencies seeded: {dep_count}")

    except Exception as e:
        db.rollback()
        print(f"Error generating synthetic data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed = 26027
    if len(sys.argv) > 1:
        try:
            seed = int(sys.argv[1])
        except ValueError:
            pass
    generate_synthetic_data(seed=seed)
