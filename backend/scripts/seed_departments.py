import sys
import os

# Ensure backend package can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal, init_db
from backend.models.department import Department

DEPARTMENTS = [
    {"name": "Engineering", "code": "ENG"},
    {"name": "Traction Distribution", "code": "TRD"},
    {"name": "Signalling", "code": "SNT"},
]


def seed_departments():
    print("Initializing database schema if not present...")
    init_db()

    db = SessionLocal()
    try:
        inserted = 0
        for dept_data in DEPARTMENTS:
            existing = db.query(Department).filter(Department.code == dept_data["code"]).first()
            if not existing:
                dept = Department(name=dept_data["name"], code=dept_data["code"])
                db.add(dept)
                inserted += 1
                print(f"Added department: {dept_data['name']} ({dept_data['code']})")
            else:
                print(f"Department already exists: {existing.name} ({existing.code})")

        db.commit()
        print(f"Seeding completed successfully. {inserted} new departments added.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding departments: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_departments()
