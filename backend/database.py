import os
import uuid
from sqlalchemy import create_engine, String, TypeDecorator
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sangam.db")

# For SQLite, ensure check_same_thread=False
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36), storing as stringified hex values.
    """
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return str(value)
        try:
            return str(uuid.UUID(str(value)))
        except (ValueError, AttributeError):
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return str(value)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(drop_first: bool = False):
    import backend.models  # noqa: F401
    if drop_first:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Safe column migration for SQLite
    if DATABASE_URL.startswith("sqlite"):
        from sqlalchemy import text
        with engine.connect() as conn:
            # Check maintenance_tasks
            res = conn.execute(text("PRAGMA table_info(maintenance_tasks)")).fetchall()
            cols = {r[1] for r in res}
            if "description" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN description VARCHAR(500)"))
            if "operational_notes" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN operational_notes VARCHAR(500)"))
            if "source" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN source VARCHAR(50) DEFAULT 'Manual'"))
            if "deferred_reason" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN deferred_reason VARCHAR(255)"))
            if "deferred_until" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN deferred_until DATETIME"))
            if "completed_at" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN completed_at DATETIME"))
            if "completion_notes" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN completion_notes VARCHAR(255)"))
            if "track_line" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN track_line VARCHAR(20) DEFAULT 'UP'"))
            if "chainage_from_km" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN chainage_from_km FLOAT"))
            if "chainage_to_km" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN chainage_to_km FLOAT"))
            if "location_type" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN location_type VARCHAR(30)"))
            if "start_entity_id" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN start_entity_id VARCHAR(50)"))
            if "end_entity_id" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN end_entity_id VARCHAR(50)"))
            if "location_display" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN location_display VARCHAR(120)"))
            if "block_type_required" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN block_type_required VARCHAR(50) DEFAULT 'Traffic Block'"))
            if "requires_traffic_block" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN requires_traffic_block BOOLEAN DEFAULT 1"))
            if "requires_signal_disconnection" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN requires_signal_disconnection BOOLEAN DEFAULT 0"))
            if "is_joint_block_eligible" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN is_joint_block_eligible BOOLEAN DEFAULT 1"))
            if "required_crew" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN required_crew VARCHAR(100)"))
            if "required_equipment" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN required_equipment VARCHAR(100)"))
            if "predecessor_task_id" not in cols:
                conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN predecessor_task_id VARCHAR(36)"))

            # Check assets table for spatial references
            res_ast = conn.execute(text("PRAGMA table_info(assets)")).fetchall()
            cols_ast = {r[1] for r in res_ast}
            if "track_line" not in cols_ast:
                conn.execute(text("ALTER TABLE assets ADD COLUMN track_line VARCHAR(20) DEFAULT 'UP'"))
            if "start_location_ref" not in cols_ast:
                conn.execute(text("ALTER TABLE assets ADD COLUMN start_location_ref VARCHAR(50)"))
            if "end_location_ref" not in cols_ast:
                conn.execute(text("ALTER TABLE assets ADD COLUMN end_location_ref VARCHAR(50)"))
            if "chainage_start_km" not in cols_ast:
                conn.execute(text("ALTER TABLE assets ADD COLUMN chainage_start_km FLOAT"))
            if "chainage_end_km" not in cols_ast:
                conn.execute(text("ALTER TABLE assets ADD COLUMN chainage_end_km FLOAT"))

            # Check generated_blocks
            res = conn.execute(text("PRAGMA table_info(generated_blocks)")).fetchall()
            cols = {r[1] for r in res}
            if "execution_status" not in cols:
                conn.execute(text("ALTER TABLE generated_blocks ADD COLUMN execution_status VARCHAR(30) DEFAULT 'pending'"))
            if "cancellation_reason" not in cols:
                conn.execute(text("ALTER TABLE generated_blocks ADD COLUMN cancellation_reason VARCHAR(255)"))
            if "corridor_display" not in cols:
                conn.execute(text("ALTER TABLE generated_blocks ADD COLUMN corridor_display VARCHAR(100)"))
            if "spatial_coverage" not in cols:
                conn.execute(text("ALTER TABLE generated_blocks ADD COLUMN spatial_coverage VARCHAR(150)"))

            # Check generated_block_tasks
            res_gbt = conn.execute(text("PRAGMA table_info(generated_block_tasks)")).fetchall()
            cols_gbt = {r[1] for r in res_gbt}
            if "task_start" not in cols_gbt:
                conn.execute(text("ALTER TABLE generated_block_tasks ADD COLUMN task_start DATETIME"))
            if "task_end" not in cols_gbt:
                conn.execute(text("ALTER TABLE generated_block_tasks ADD COLUMN task_end DATETIME"))
            if "scheduled_duration_min" not in cols_gbt:
                conn.execute(text("ALTER TABLE generated_block_tasks ADD COLUMN scheduled_duration_min INTEGER"))

            # Check train_movements
            res = conn.execute(text("PRAGMA table_info(train_movements)")).fetchall()
            cols = {r[1] for r in res}
            if "train_number" not in cols:
                conn.execute(text("ALTER TABLE train_movements ADD COLUMN train_number VARCHAR(50)"))
            if "scheduled_entry_time" not in cols:
                conn.execute(text("ALTER TABLE train_movements ADD COLUMN scheduled_entry_time DATETIME"))
            if "scheduled_exit_time" not in cols:
                conn.execute(text("ALTER TABLE train_movements ADD COLUMN scheduled_exit_time DATETIME"))
            if "delay_minutes" not in cols:
                conn.execute(text("ALTER TABLE train_movements ADD COLUMN delay_minutes INTEGER DEFAULT 0"))
            if "source" not in cols:
                conn.execute(text("ALTER TABLE train_movements ADD COLUMN source VARCHAR(50) DEFAULT 'Manual'"))
            if "notes" not in cols:
                conn.execute(text("ALTER TABLE train_movements ADD COLUMN notes VARCHAR(255)"))

            # Check block_windows
            res = conn.execute(text("PRAGMA table_info(block_windows)")).fetchall()
            cols = {r[1] for r in res}
            if "unavailability_reason" not in cols:
                conn.execute(text("ALTER TABLE block_windows ADD COLUMN unavailability_reason VARCHAR(255)"))
            if "source" not in cols:
                conn.execute(text("ALTER TABLE block_windows ADD COLUMN source VARCHAR(50) DEFAULT 'Computed Gap'"))
            if "availability_reasons" not in cols:
                conn.execute(text("ALTER TABLE block_windows ADD COLUMN availability_reasons VARCHAR(500)"))
            if "provenance_label" not in cols:
                conn.execute(text("ALTER TABLE block_windows ADD COLUMN provenance_label VARCHAR(100) DEFAULT 'Representative prototype operational data'"))

            # Check resources
            res = conn.execute(text("PRAGMA table_info(resources)")).fetchall()
            cols = {r[1] for r in res}
            if "unavailability_reason" not in cols:
                conn.execute(text("ALTER TABLE resources ADD COLUMN unavailability_reason VARCHAR(255)"))
            if "unavailable_from" not in cols:
                conn.execute(text("ALTER TABLE resources ADD COLUMN unavailable_from VARCHAR(50)"))
            if "unavailable_until" not in cols:
                conn.execute(text("ALTER TABLE resources ADD COLUMN unavailable_until VARCHAR(50)"))

            # Check generated_blocks
            res = conn.execute(text("PRAGMA table_info(generated_blocks)")).fetchall()
            cols = {r[1] for r in res}
            if "execution_status" not in cols:
                conn.execute(text("ALTER TABLE generated_blocks ADD COLUMN execution_status VARCHAR(30) DEFAULT 'pending'"))
            if "cancellation_reason" not in cols:
                conn.execute(text("ALTER TABLE generated_blocks ADD COLUMN cancellation_reason VARCHAR(255)"))

            # Check railway_sections
            res = conn.execute(text("PRAGMA table_info(railway_sections)")).fetchall()
            cols = {r[1] for r in res}
            if "corridor_name" not in cols:
                conn.execute(text("ALTER TABLE railway_sections ADD COLUMN corridor_name VARCHAR(100) DEFAULT 'Main Corridor'"))
            if "length_km" not in cols:
                conn.execute(text("ALTER TABLE railway_sections ADD COLUMN length_km FLOAT DEFAULT 25.0"))
            if "is_electrified" not in cols:
                conn.execute(text("ALTER TABLE railway_sections ADD COLUMN is_electrified BOOLEAN DEFAULT 1"))
            if "traction_type" not in cols:
                conn.execute(text("ALTER TABLE railway_sections ADD COLUMN traction_type VARCHAR(50) DEFAULT '25 kV AC OHE'"))

            conn.commit()
