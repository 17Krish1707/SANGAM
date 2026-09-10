import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal
from backend.models.optimization import GeneratedBlock
from backend.services.kpi_engine import compute_kpis, compute_downtime_saved
from backend.scripts.run_small_testcase import seed_and_init_small_testcase


def seed_judge_demo():
    print("=== INITIALIZING SANGAM DETERMINISTIC TESTCASE DATASET ===")
    db = SessionLocal()
    try:
        data = seed_and_init_small_testcase(db)
        opt_run_id = data["opt_run_id"]
        ind_run_id = data["ind_run_id"]
        opt_blocks = db.query(GeneratedBlock).filter(GeneratedBlock.run_id == opt_run_id).all()
        kpis_opt = compute_kpis(db, opt_run_id)
        savings = compute_downtime_saved(db, ind_run_id, opt_run_id)

        print("\n=== DETERMINISTIC TESTCASE DATASET INITIALIZED ===")
        print("Sections:               3 (Dadar–Matunga, Matunga–Sion, Sion–Kurla)")
        print("Trains:                 4 (P101, P102, G201, P301)")
        print("Resources:              10 (All available)")
        print("Tasks:                  6 across ENG, S&T, TRD")
        print(f"Candidate Windows:      {len(data['windows'])}")
        print(f"SANGAM Blocks:          {len(opt_blocks)}")
        print(f"Joint Blocks:           {kpis_opt.get('joint_blocks_count', 0)}")
        print(f"Baseline Closure:       {savings.get('baseline_hours', 0)} hrs")
        print(f"SANGAM Closure:         {savings.get('optimized_hours', 0)} hrs")
        print(f"Closure Hours Saved:    {savings.get('hours_saved', 0)} hrs ({savings.get('percent_saved', 0)}%)")

        return {
            "status": "success",
            "sections": 3,
            "trains": 4,
            "resources": 10,
            "tasks": 6,
            "windows": len(data['windows']),
            "opt_run_id": opt_run_id,
            "baseline_run_id": ind_run_id,
            "savings": savings,
        }
    finally:
        db.close()


seed_standard_dataset = seed_judge_demo

if __name__ == "__main__":
    seed_judge_demo()
