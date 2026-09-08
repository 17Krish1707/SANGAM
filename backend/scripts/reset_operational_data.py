import sys
import os

# Ensure backend package can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal, init_db, engine
from sqlalchemy import text
from backend.models.department import Department

def reset_operational_data(keep_sections: bool = False):
    """
    Safely delete all operational and demo records from the active database in FK order.
    Preserves schema, department definitions (Engineering, TRD, Signalling), and rules.
    """
    print("Ensuring database schema exists...")
    init_db()

    db = SessionLocal()
    try:
        print("Clearing operational tables in FK-safe order...")

        # Disable foreign key checks during truncation if SQLite/Postgres
        if engine.url.drivername.startswith("sqlite"):
            db.execute(text("PRAGMA foreign_keys = OFF;"))

        # Clear associations and run results first
        db.execute(text("DELETE FROM generated_block_tasks;"))
        db.execute(text("DELETE FROM generated_blocks;"))
        db.execute(text("DELETE FROM optimization_runs;"))
        db.execute(text("DELETE FROM task_resource_requirements;"))
        db.execute(text("DELETE FROM task_conflicts;"))

        # Clear maintenance demand and assets
        db.execute(text("DELETE FROM maintenance_tasks;"))
        db.execute(text("DELETE FROM assets;"))

        # Clear train timetable, windows, and resources
        db.execute(text("DELETE FROM block_windows;"))
        db.execute(text("DELETE FROM train_movements;"))
        db.execute(text("DELETE FROM resources;"))

        # Clear sections if requested (user-driven corridor setup)
        if not keep_sections:
            db.execute(text("DELETE FROM railway_sections;"))
            print("Cleared railway_sections.")

        if engine.url.drivername.startswith("sqlite"):
            db.execute(text("PRAGMA foreign_keys = ON;"))

        db.commit()
        print("All operational records successfully wiped.")

        # Ensure standard 3 department master records exist
        from backend.scripts.seed_departments import seed_departments
        seed_departments()

        print("Operational database is now in a completely clean, EMPTY state ready for manual setup.")
    except Exception as e:
        db.rollback()
        print(f"Error resetting database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    keep_sec = "--keep-sections" in sys.argv
    reset_operational_data(keep_sections=keep_sec)
