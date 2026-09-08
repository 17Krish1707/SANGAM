"""
smoke_test.py — Pre-demo sanity check for SANGAM.

Runs against a freshly seeded database and validates that the system
produces correct, internally consistent results end-to-end.

Usage:
    docker compose exec backend python backend/scripts/smoke_test.py
    python backend/scripts/smoke_test.py
"""
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from datetime import datetime, timedelta
from backend.database import SessionLocal, init_db
from backend.models.section import RailwaySection
from backend.models.task import MaintenanceTask
from backend.models.optimization import OptimizationRun, GeneratedBlock, GeneratedBlockTask
from backend.models.conflict import TaskConflict
from backend.services.priority_engine import recompute_all_priority_scores
from backend.services.corridor_availability import populate_block_windows
from backend.services.optimizer_common import prepare_optimization_input
from backend.services.baselines import run_independent_baseline, run_greedy_baseline
from backend.services.optimizer import run_sangam_optimizer
from backend.services.kpi_engine import compute_kpis

PLAN_START = datetime(2026, 9, 7, 0, 0, 0)
PLAN_END   = PLAN_START + timedelta(days=7)

PASS = "\033[92m✓ PASS\033[0m"
FAIL = "\033[91m✗ FAIL\033[0m"

results = []

def check(label: str, passed: bool, detail: str = ""):
    tag = PASS if passed else FAIL
    line = f"  {tag}  {label}"
    if detail:
        line += f"  ({detail})"
    print(line)
    results.append((label, passed))


def main():
    print("=" * 60)
    print("SANGAM — Pre-Demo Smoke Test")
    print(f"  Planning window: {PLAN_START.date()} → {PLAN_END.date()}")
    print("=" * 60 + "\n")

    init_db()
    db = SessionLocal()

    try:
        # ── (a) Recompute priority scores ─────────────────────────────────────
        print("[a] Recomputing priority scores for all tasks...")
        count = recompute_all_priority_scores(db)
        check("Priority scores recomputed", count > 0, f"{count} tasks updated")

        # ── (b) Populate block windows for all 5 sections ─────────────────────
        print("\n[b] Populating corridor block windows for all sections...")
        sections = db.query(RailwaySection).all()
        section_ids = [str(s.id) for s in sections]
        check("5 demo sections found", len(sections) == 5, f"found {len(sections)}")

        windows = populate_block_windows(db, section_ids, PLAN_START, PLAN_END)
        check("Block windows populated", len(windows) > 0, f"{len(windows)} windows generated")

        # ── (c) Run all three schedulers ──────────────────────────────────────
        print("\n[c] Running all three schedulers...")
        bundle = prepare_optimization_input(
            db=db,
            section_ids=section_ids,
            start_date=PLAN_START,
            end_date=PLAN_END,
            horizon="weekly",
        )
        check("Tasks in scope", len(bundle.tasks) > 0, f"{len(bundle.tasks)} pending tasks")
        check("Windows in scope", len(bundle.windows) > 0, f"{len(bundle.windows)} candidate windows")

        ind_result    = run_independent_baseline(bundle, db)
        greedy_result = run_greedy_baseline(bundle, db)
        sangam_result = run_sangam_optimizer(bundle, db, time_limit_seconds=30)

        check("Independent baseline completed",
              ind_result.get("run_id") is not None and
              db.query(OptimizationRun).filter(OptimizationRun.id == ind_result["run_id"]).first() is not None)

        check("Greedy baseline completed",
              greedy_result.get("run_id") is not None)

        sangam_status = sangam_result.get("solver_status") or sangam_result.get("status", "")
        check("SANGAM optimizer completed (OPTIMAL or FEASIBLE)",
              sangam_status in ("OPTIMAL", "FEASIBLE"),
              f"status={sangam_status}")

        # ── (d) SANGAM total_block_hours < independent_baseline ───────────────
        print("\n[d] Checking downtime reduction...")
        ind_hours    = ind_result.get("total_block_hours", 0)
        sangam_hours = sangam_result.get("total_block_hours", 0)
        reduction_pct = round(((ind_hours - sangam_hours) / max(ind_hours, 0.001)) * 100, 1) if ind_hours > 0 else 0.0

        check(
            "SANGAM block hours < Independent baseline",
            sangam_hours < ind_hours,
            f"independent={ind_hours:.1f}h  sangam={sangam_hours:.1f}h  saved={ind_hours - sangam_hours:.1f}h ({reduction_pct}%)"
        )

        # ── (e) No conflict pair co-scheduled in SANGAM result ────────────────
        print("\n[e] Verifying safety constraints: no conflict pairs co-scheduled...")
        sangam_run_id = sangam_result.get("run_id")
        violation_count = 0

        if sangam_run_id:
            conflict_pairs = db.query(TaskConflict).filter(
                TaskConflict.relationship == "conflict"
            ).all()

            for cp in conflict_pairs:
                # Find blocks in SANGAM run containing each task
                blocks_a = (
                    db.query(GeneratedBlock.id)
                    .join(GeneratedBlockTask, GeneratedBlockTask.block_id == GeneratedBlock.id)
                    .filter(
                        GeneratedBlock.run_id == sangam_run_id,
                        GeneratedBlockTask.task_id == cp.task_a_id,
                    )
                    .all()
                )
                blocks_b = (
                    db.query(GeneratedBlock.id)
                    .join(GeneratedBlockTask, GeneratedBlockTask.block_id == GeneratedBlock.id)
                    .filter(
                        GeneratedBlock.run_id == sangam_run_id,
                        GeneratedBlockTask.task_id == cp.task_b_id,
                    )
                    .all()
                )
                # Check if any block ID is shared
                ids_a = {str(r[0]) for r in blocks_a}
                ids_b = {str(r[0]) for r in blocks_b}
                if ids_a & ids_b:
                    violation_count += 1

        check(
            "No conflict pairs co-scheduled in SANGAM result",
            violation_count == 0,
            f"{violation_count} violation(s) found"
        )

        # ── Summary ───────────────────────────────────────────────────────────
        print("\n" + "=" * 60)
        total = len(results)
        passed = sum(1 for _, ok in results if ok)
        failed = total - passed

        if failed == 0:
            print(f"\033[92mALL {total} CHECKS PASSED — SANGAM is demo-ready.\033[0m")
        else:
            print(f"\033[91m{failed}/{total} CHECKS FAILED — Fix issues before the demo.\033[0m")
            for label, ok in results:
                if not ok:
                    print(f"  ✗ {label}")

        print("=" * 60 + "\n")
        return failed == 0

    except Exception as e:
        print(f"\n\033[91mSMOKE TEST ABORTED with exception: {e}\033[0m")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
