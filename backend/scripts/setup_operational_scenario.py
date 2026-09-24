import os
import sys
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

# Ensure root workspace on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.main import app
from backend.database import SessionLocal, init_db
from backend.scripts.reset_operational_data import reset_operational_data

client = TestClient(app)


def setup_representative_scenario(plan_horizon_days: int = 7):
    """
    Sets up a complete, realistic railway operational workstation test scenario
    SOK-aligned and strictly created THROUGH NORMAL APP/API ENDPOINTS.
    No direct SQL or manual database record hacking.
    """
    print("=" * 60)
    print("SANGAM: Setting up Representative Operational Planning Scenario via Normal APIs")
    print("=" * 60)

    # 1. Reset database cleanly to empty state
    reset_operational_data(keep_sections=False)

    # Reference operational planning start date: tomorrow 00:00 UTC
    now_base = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    base_date_str = now_base.strftime("%Y-%m-%d")
    print(f"Operational Reference Planning Date: {base_date_str}")

    # 2. Configure 3 Connected Corridor Sections via POST /api/sections/corridor-setup
    print("\n1. Creating 3 Connected Sections via API...")
    corridor_payload = {
        "corridor_name": "Northern Trunk Quad-Corridor",
        "stations": ["New Delhi (NDLS)", "Ghaziabad Jn (GZB)", "Aligarh Jn (ALJN)", "Tundla Jn (TDL)"],
        "line_type": "double",
        "is_electrified": True,
        "sections": [
            {
                "name": "NDLS - GZB",
                "corridor_name": "Northern Trunk Quad-Corridor",
                "from_station": "New Delhi (NDLS)",
                "to_station": "Ghaziabad Jn (GZB)",
                "length_km": 28.5,
                "line_type": "double",
                "is_electrified": True,
                "traction_type": "25 kV AC OHE",
                "section_capacity_notes": "High traffic density urban approach corridor",
            },
            {
                "name": "GZB - ALJN",
                "corridor_name": "Northern Trunk Quad-Corridor",
                "from_station": "Ghaziabad Jn (GZB)",
                "to_station": "Aligarh Jn (ALJN)",
                "length_km": 106.0,
                "line_type": "double",
                "is_electrified": True,
                "traction_type": "25 kV AC OHE",
                "section_capacity_notes": "Primary trunk section, mixed high-speed passenger and heavy freight",
            },
            {
                "name": "ALJN - TDL",
                "corridor_name": "Northern Trunk Quad-Corridor",
                "from_station": "Aligarh Jn (ALJN)",
                "to_station": "Tundla Jn (TDL)",
                "length_km": 78.0,
                "line_type": "double",
                "is_electrified": True,
                "traction_type": "25 kV AC OHE",
                "section_capacity_notes": "Continuous automatic block signalling territory",
            },
        ],
    }

    setup_res = client.post("/api/sections/corridor-setup", json=corridor_payload)
    assert setup_res.status_code == 200, f"Failed corridor setup: {setup_res.text}"
    sections_list = client.get("/api/sections").json()
    assert len(sections_list) == 3, f"Expected 3 sections, got {len(sections_list)}"
    sec_map = {s["name"]: s["id"] for s in sections_list}
    print(f"Created sections: {list(sec_map.keys())}")

    # 3. Create at least 10 Operational Resources via POST /api/resources
    print("\n2. Creating 10 Operational Resources across departments via API...")
    resources_data = [
        # Engineering (4)
        {"name": "P-Way Gang 01 (Track Maintenance)", "department_code": "ENG", "resource_type": "Crew"},
        {"name": "P-Way Gang 02 (Turnout Special)", "department_code": "ENG", "resource_type": "Crew"},
        {"name": "Tie Tamping Machine CSM-952", "department_code": "ENG", "resource_type": "Tamping Machine"},
        {"name": "Ballast Cleaning Machine BCM-08", "department_code": "ENG", "resource_type": "Equipment"},
        # Traction Distribution (3)
        {"name": "OHE Tower Wagon TW-NCR-01", "department_code": "TRD", "resource_type": "Tower Wagon"},
        {"name": "OHE Tower Wagon TW-NCR-02", "department_code": "TRD", "resource_type": "Tower Wagon"},
        {"name": "TRD Catenary Maintenance Gang 1", "department_code": "TRD", "resource_type": "Crew"},
        # Signalling & Telecommunication (3)
        {"name": "Signal ESM Gang 01", "department_code": "SNT", "resource_type": "Crew"},
        {"name": "Interlocking Testing Team 01", "department_code": "SNT", "resource_type": "Testing Equipment"},
        {"name": "Axle Counter Maintenance Crew", "department_code": "SNT", "resource_type": "Crew"},
    ]

    res_ids = []
    for r in resources_data:
        res = client.post("/api/resources", json=r)
        assert res.status_code == 200, f"Failed adding resource {r['name']}: {res.text}"
        res_ids.append(res.json()["id"])
    print(f"Successfully configured {len(res_ids)} operational crews and heavy track machinery.")

    # 4. Schedule Passenger and Freight Train Timetable Movements via POST /api/corridor/trains
    # Creating: safe large window, tight window, poor/risky window
    print("\n3. Scheduling Passenger and Freight Timetable Movements via API...")
    gzb_aljn_id = sec_map["GZB - ALJN"]
    ndls_gzb_id = sec_map["NDLS - GZB"]
    aljn_tdl_id = sec_map["ALJN - TDL"]

    trains_spec = [
        # GZB - ALJN movements
        {
            "section_id": gzb_aljn_id,
            "train_type": "Passenger",
            "train_number": "12424 Rajdhani Express",
            "entry_time": (now_base + timedelta(hours=3, minutes=30)).isoformat(),
            "exit_time": (now_base + timedelta(hours=4, minutes=45)).isoformat(),
            "priority": 1,
            "notes": "VVIP Rajdhani path - protected headway",
        },
        {
            "section_id": gzb_aljn_id,
            "train_type": "Goods",
            "train_number": "BOXN-602 Coal Freight",
            "entry_time": (now_base + timedelta(hours=5, minutes=15)).isoformat(),
            "exit_time": (now_base + timedelta(hours=6, minutes=30)).isoformat(),
            "priority": 3,
            "forecast_confidence": 0.85,
            "notes": "FOIS scheduled coal rake",
        },
        # (Safe Large Gap: 06:30 to 11:30 = 5 hour traffic gap!)
        {
            "section_id": gzb_aljn_id,
            "train_type": "Passenger",
            "train_number": "12004 Shatabdi Express",
            "entry_time": (now_base + timedelta(hours=11, minutes=30)).isoformat(),
            "exit_time": (now_base + timedelta(hours=12, minutes=30)).isoformat(),
            "priority": 1,
            "notes": "High-speed intercity passenger",
        },
        # (Tight Window: 12:30 to 14:00 = 90 min gap)
        {
            "section_id": gzb_aljn_id,
            "train_type": "Goods",
            "train_number": "BCN-410 Cement Freight",
            "entry_time": (now_base + timedelta(hours=14, minutes=0)).isoformat(),
            "exit_time": (now_base + timedelta(hours=15, minutes=15)).isoformat(),
            "priority": 3,
            "forecast_confidence": 0.70,
            "notes": "Bulk cement rake",
        },
        # (Risky tight window: 15:15 to 16:00 = 45 min gap)
        {
            "section_id": gzb_aljn_id,
            "train_type": "Passenger",
            "train_number": "12314 Sealdah Rajdhani",
            "entry_time": (now_base + timedelta(hours=16, minutes=0)).isoformat(),
            "exit_time": (now_base + timedelta(hours=17, minutes=10)).isoformat(),
            "priority": 1,
            "notes": "Evening trunk express",
        },
        {
            "section_id": gzb_aljn_id,
            "train_type": "Passenger",
            "train_number": "12280 Taj Express",
            "entry_time": (now_base + timedelta(hours=18, minutes=0)).isoformat(),
            "exit_time": (now_base + timedelta(hours=19, minutes=0)).isoformat(),
            "priority": 2,
            "notes": "Tourist express",
        },
        # NDLS - GZB movements
        {
            "section_id": ndls_gzb_id,
            "train_type": "Passenger",
            "train_number": "64402 Ghaziabad Suburban EMU",
            "entry_time": (now_base + timedelta(hours=6, minutes=0)).isoformat(),
            "exit_time": (now_base + timedelta(hours=6, minutes=45)).isoformat(),
            "priority": 2,
            "notes": "Suburban commuter path",
        },
        {
            "section_id": ndls_gzb_id,
            "train_type": "Passenger",
            "train_number": "12056 Dehradun Janshatabdi",
            "entry_time": (now_base + timedelta(hours=10, minutes=0)).isoformat(),
            "exit_time": (now_base + timedelta(hours=10, minutes=40)).isoformat(),
            "priority": 1,
            "notes": "Trunk express",
        },
        # ALJN - TDL movements
        {
            "section_id": aljn_tdl_id,
            "train_type": "Goods",
            "train_number": "CONT-902 CONCOR Container",
            "entry_time": (now_base + timedelta(hours=4, minutes=0)).isoformat(),
            "exit_time": (now_base + timedelta(hours=5, minutes=15)).isoformat(),
            "priority": 3,
            "forecast_confidence": 0.80,
            "notes": "Freight container rake",
        },
        {
            "section_id": aljn_tdl_id,
            "train_type": "Passenger",
            "train_number": "12402 Magadh Express",
            "entry_time": (now_base + timedelta(hours=8, minutes=30)).isoformat(),
            "exit_time": (now_base + timedelta(hours=9, minutes=45)).isoformat(),
            "priority": 1,
            "notes": "Mail express",
        },
    ]

    for tr in trains_spec:
        tr_res = client.post("/api/corridor/trains", json=tr)
        assert tr_res.status_code == 200, f"Failed adding train {tr['train_number']}: {tr_res.text}"
    print(f"Successfully scheduled {len(trains_spec)} realistic passenger & freight movements.")

    # 5. Create Maintenance Tasks across ENG, TRD, S&T via POST /api/tasks
    # Meeting all requirements:
    # >= 1 critical task
    # >= 1 overdue task
    # >= 1 near-due task
    # >= 1 low-priority task
    # >= 1 power-isolation TRD task
    # >= 1 signalling disconnection task
    # >= 1 ENG track task
    # Naturally produces joint blocks on GZB - ALJN!
    print("\n4. Submitting Work Orders across ENG, TRD, and S&T via API...")
    tasks_spec = [
        # Task 1: Critical Track Defect (ENG) on GZB - ALJN
        {
            "department_code": "ENG",
            "section_id": gzb_aljn_id,
            "asset_name": "Turnout Switch 1:12 No. 24B",
            "maintenance_type": "Ultrasonic Testing & Emergency Rail Weld",
            "description": "Critical transverse fissure defect detected in rail head. Immediate 30 km/h caution order in effect.",
            "severity": "Critical",
            "detected_at": (now_base - timedelta(days=2)).isoformat(),
            "due_date": (now_base + timedelta(hours=18)).isoformat(), # Due within 24 hours!
            "estimated_duration_min": 90,
            "minimum_contiguous_block_min": 60,
            "requires_power_isolation": False,
            "can_run_parallel": True,
            "track_line": "UP",
            "chainage_from_km": 38.2,
            "chainage_to_km": 41.7,
            "block_type_required": "Traffic Block",
            "requires_traffic_block": True,
            "requires_signal_disconnection": False,
            "is_joint_block_eligible": True,
            "required_crew": "P-Way Gang 01 (Track Maintenance)",
            "required_equipment": None,
            "status": "Pending",
            "operational_notes": "High priority safety flaw; must be repaired before speed restoration.",
        },
        # Task 2: Overdue Traction Power Isolation (TRD) on GZB - ALJN
        {
            "department_code": "TRD",
            "section_id": gzb_aljn_id,
            "asset_name": "OHE Mast & Cantilever Structure 40/12",
            "maintenance_type": "Cantilever Assembly & Dropper Inspection",
            "description": "Overdue catenary wire tensioning and insulator washing under 25 kV AC isolation.",
            "severity": "High",
            "detected_at": (now_base - timedelta(days=10)).isoformat(),
            "due_date": (now_base - timedelta(days=2)).isoformat(), # Overdue by 2 days!
            "estimated_duration_min": 60,
            "minimum_contiguous_block_min": 45,
            "requires_power_isolation": True,
            "can_run_parallel": True,
            "track_line": "UP",
            "chainage_from_km": 39.0,
            "chainage_to_km": 41.0,
            "block_type_required": "Power Block",
            "requires_traffic_block": True,
            "requires_signal_disconnection": False,
            "is_joint_block_eligible": True,
            "required_crew": "TRD Catenary Maintenance Gang 1",
            "required_equipment": "OHE Tower Wagon TW-NCR-01",
            "status": "Pending",
            "operational_notes": "Requires Traction Power Disconnection on UP mainline catenary.",
        },
        # Task 3: Near-Due Signalling Overhaul (SNT) on GZB - ALJN
        {
            "department_code": "SNT",
            "section_id": gzb_aljn_id,
            "asset_name": "Point Machine 220V Dual Control No. 24",
            "maintenance_type": "Point Machine Inspection & Interlocking Test",
            "description": "Obstruction test, friction clutch check, and track detection overhaul.",
            "severity": "Medium",
            "detected_at": (now_base - timedelta(days=4)).isoformat(),
            "due_date": (now_base + timedelta(days=1)).isoformat(), # Due tomorrow!
            "estimated_duration_min": 45,
            "minimum_contiguous_block_min": 30,
            "requires_power_isolation": False,
            "can_run_parallel": True,
            "track_line": "UP",
            "chainage_from_km": 38.5,
            "chainage_to_km": 39.5,
            "block_type_required": "S&T Disconnection",
            "requires_traffic_block": True,
            "requires_signal_disconnection": True,
            "is_joint_block_eligible": True,
            "required_crew": "Signal ESM Gang 01",
            "required_equipment": "Interlocking Testing Team 01",
            "status": "Pending",
            "operational_notes": "Interlocking disconnection notice (S&T T/351) issued.",
        },
        # Task 4: Low-Priority Track Dressing (ENG) on GZB - ALJN
        {
            "department_code": "ENG",
            "section_id": gzb_aljn_id,
            "asset_name": "Track Section 100m Bed KM 42",
            "maintenance_type": "Ballast Dressing & Cess Cleaning",
            "description": "Routine ballast shoulder profile restoration and drainage clearing.",
            "severity": "Low",
            "detected_at": (now_base - timedelta(days=1)).isoformat(),
            "due_date": (now_base + timedelta(days=12)).isoformat(), # Due in 12 days
            "estimated_duration_min": 45,
            "minimum_contiguous_block_min": 30,
            "requires_power_isolation": False,
            "can_run_parallel": True,
            "track_line": "DOWN",
            "chainage_from_km": 42.0,
            "chainage_to_km": 43.5,
            "block_type_required": "Traffic Block",
            "requires_traffic_block": True,
            "requires_signal_disconnection": False,
            "is_joint_block_eligible": True,
            "required_crew": "P-Way Gang 02 (Turnout Special)",
            "status": "Pending",
            "operational_notes": "Non-critical routine work.",
        },
        # Task 5: High-Priority Track Tamping (ENG) on NDLS - GZB
        {
            "department_code": "ENG",
            "section_id": ndls_gzb_id,
            "asset_name": "Turnout Switch 1:12 Anand Vihar Crossover",
            "maintenance_type": "Track Tamping & Crossings Packing",
            "description": "Ride index degradation recorded by OMS car. Deep tamping required.",
            "severity": "High",
            "detected_at": (now_base - timedelta(days=3)).isoformat(),
            "due_date": (now_base + timedelta(days=2)).isoformat(),
            "estimated_duration_min": 90,
            "minimum_contiguous_block_min": 60,
            "requires_power_isolation": False,
            "can_run_parallel": True,
            "track_line": "BOTH",
            "chainage_from_km": 12.0,
            "chainage_to_km": 14.5,
            "block_type_required": "Traffic Block",
            "requires_traffic_block": True,
            "requires_signal_disconnection": False,
            "is_joint_block_eligible": True,
            "required_equipment": "Tie Tamping Machine CSM-952",
            "status": "Pending",
        },
        # Task 6: Catenary Inspection (TRD) on NDLS - GZB
        {
            "department_code": "TRD",
            "section_id": ndls_gzb_id,
            "asset_name": "OHE Contact Wire Span 12-14",
            "maintenance_type": "OHE Routine Inspection & Stagger Adjustment",
            "description": "Routine laser stagger verification and contact wire wear measurement.",
            "severity": "Medium",
            "detected_at": (now_base - timedelta(days=2)).isoformat(),
            "due_date": (now_base + timedelta(days=3)).isoformat(),
            "estimated_duration_min": 60,
            "minimum_contiguous_block_min": 45,
            "requires_power_isolation": True,
            "can_run_parallel": True,
            "track_line": "UP",
            "chainage_from_km": 12.5,
            "chainage_to_km": 14.0,
            "block_type_required": "Power Block",
            "requires_traffic_block": True,
            "requires_signal_disconnection": False,
            "is_joint_block_eligible": True,
            "required_equipment": "OHE Tower Wagon TW-NCR-02",
            "status": "Pending",
        },
        # Task 7: Signal Interlocking Check (SNT) on ALJN - TDL
        {
            "department_code": "SNT",
            "section_id": aljn_tdl_id,
            "asset_name": "Electronic Interlocking Rack Hathras Jn",
            "maintenance_type": "Track Circuit & Axle Counter Calibration",
            "description": "Axle counter reset verification and relay rack thermographic inspection.",
            "severity": "Medium",
            "detected_at": (now_base - timedelta(days=2)).isoformat(),
            "due_date": (now_base + timedelta(days=4)).isoformat(),
            "estimated_duration_min": 60,
            "minimum_contiguous_block_min": 45,
            "requires_power_isolation": False,
            "can_run_parallel": True,
            "track_line": "DOWN",
            "chainage_from_km": 24.0,
            "chainage_to_km": 26.0,
            "block_type_required": "S&T Disconnection",
            "requires_traffic_block": True,
            "requires_signal_disconnection": True,
            "is_joint_block_eligible": True,
            "required_crew": "Axle Counter Maintenance Crew",
            "status": "Pending",
        },
    ]

    task_ids = []
    for t_spec in tasks_spec:
        res = client.post("/api/tasks", json=t_spec)
        assert res.status_code == 200, f"Failed creating task: {res.text}"
        data = res.json()
        task_ids.append(data["id"])
        print(f"  • Added Task {data['task_code']} | Priority Score: {data['priority_score']} | Section: {t_spec['section_id'][:8]}...")

    print(f"\nSuccessfully added {len(task_ids)} work orders spanning all departments and severity tiers.")

    # 6. Trigger Candidate Corridor Window Generation via POST /api/corridor/recompute-windows
    print("\n5. Computing candidate corridor windows across timetable gaps...")
    recomp_res = client.post(
        "/api/corridor/recompute-windows",
        params={
            "start_date": now_base.strftime("%Y-%m-%dT%H:%M:%S"),
            "end_date": (now_base + timedelta(days=plan_horizon_days)).strftime("%Y-%m-%dT%H:%M:%S"),
        },
    )
    assert recomp_res.status_code == 200, f"Failed recomputing windows: {recomp_res.text}"
    w_data = recomp_res.json()
    win_cnt = w_data.get("windows_count", 0)
    print(f"Computed {win_cnt} candidate block windows across corridor.")

    # 7. Generate Optimized Plan via POST /api/plans/generate
    print("\n6. Running CP-SAT Joint Block Optimizer via POST /api/plans/generate...")
    gen_payload = {
        "section_ids": list(sec_map.values()),
        "start_date": now_base.strftime("%Y-%m-%dT%H:%M:%S"),
        "end_date": (now_base + timedelta(days=plan_horizon_days)).strftime("%Y-%m-%dT%H:%M:%S"),
        "horizon": "weekly",
        "objective_profile": "balanced",
        "run_types": ["sangam_optimized", "greedy_baseline", "independent_baseline"],
    }
    gen_res = client.post("/api/plans/generate", json=gen_payload)
    assert gen_res.status_code == 200, f"Failed plan generation: {gen_res.text}"
    plan_result = gen_res.json()

    print(f"Plan Generation Status: {plan_result['status']}")
    print(f"Alternatives Generated: {len(plan_result.get('alternatives', []))}")
    for alt in plan_result.get("alternatives", []):
        rec_tag = " [RECOMMENDED]" if alt.get("is_recommended") else ""
        print(f"  • {alt['plan_label']}{rec_tag}: Closure {alt['track_closure_hours']}h | Trains Affected: {alt['trains_affected_count']} | Margin: {alt['min_train_margin_min']}m | Joint Blocks: {alt['joint_blocks_count']}")
        print(f"    Explanation: {alt.get('recommendation_explanation')}")

    rec_plan = plan_result.get("recommended_plan")
    assert rec_plan is not None, "Expected recommended plan"
    assert rec_plan["trains_affected_count"] == 0, f"Expected 0 trains affected in strict mode, got {rec_plan['trains_affected_count']}"
    assert rec_plan["joint_blocks_count"] >= 1, f"Expected >= 1 joint block, got {rec_plan['joint_blocks_count']}"

    print("\n" + "=" * 60)
    print("REPRESENTATIVE OPERATIONAL SCENARIO SUCCESSFULLY GENERATED THROUGH APIS!")
    print("=" * 60)
    return {
        "base_date": base_date_str,
        "sections": sec_map,
        "tasks_count": len(task_ids),
        "windows_count": win_cnt,
        "recommended_plan": rec_plan,
        "alternatives": plan_result.get("alternatives", []),
    }


if __name__ == "__main__":
    setup_representative_scenario()
