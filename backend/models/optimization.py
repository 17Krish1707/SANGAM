import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship
from backend.database import Base, GUID


class OptimizationRun(Base):
    __tablename__ = "optimization_runs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    run_type = Column(String(50), nullable=False, index=True)  # independent_baseline | greedy_baseline | sangam_optimized
    horizon = Column(String(20), nullable=False, default="weekly")  # weekly | monthly
    objective_profile = Column(String(50), nullable=True, default="balanced")  # balanced | max_availability | min_train_impact
    solver_runtime_ms = Column(Float, nullable=True)
    tasks_considered = Column(Integer, nullable=True)
    tasks_scheduled = Column(Integer, nullable=True)
    tasks_deferred = Column(Integer, nullable=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    objective_value = Column(Float, nullable=True)
    status = Column(String(20), nullable=False, default="running", index=True)  # running | completed | infeasible | failed
    parent_run_id = Column(GUID, ForeignKey("optimization_runs.id", ondelete="SET NULL"), nullable=True)

    blocks = relationship("GeneratedBlock", back_populates="run", cascade="all, delete-orphan")
    child_runs = relationship("OptimizationRun", backref="parent_run", remote_side="[OptimizationRun.id]")


class GeneratedBlock(Base):
    __tablename__ = "generated_blocks"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    run_id = Column(GUID, ForeignKey("optimization_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id = Column(GUID, ForeignKey("railway_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    block_start = Column(DateTime, nullable=False, index=True)
    block_end = Column(DateTime, nullable=False, index=True)
    is_joint_block = Column(Boolean, nullable=False, default=False)
    approval_status = Column(String(30), nullable=False, default="recommended")  # recommended | approved | modified | rejected
    execution_status = Column(String(30), nullable=False, default="pending")  # pending | approved | in_progress | completed | cancelled
    cancellation_reason = Column(String(255), nullable=True)
    approval_note = Column(String(255), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(String(100), nullable=True)
    locked = Column(Boolean, nullable=False, default=False)

    run = relationship("OptimizationRun", back_populates="blocks")
    section = relationship("RailwaySection", back_populates="generated_blocks")
    block_tasks = relationship("GeneratedBlockTask", back_populates="block", cascade="all, delete-orphan")


class GeneratedBlockTask(Base):
    __tablename__ = "generated_block_tasks"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    block_id = Column(GUID, ForeignKey("generated_blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(GUID, ForeignKey("maintenance_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    task_start = Column(DateTime, nullable=True)
    task_end = Column(DateTime, nullable=True)
    scheduled_duration_min = Column(Integer, nullable=True)

    block = relationship("GeneratedBlock", back_populates="block_tasks")
    task = relationship("MaintenanceTask", back_populates="block_assignments")


Index("ix_gen_block_task_unique", GeneratedBlockTask.block_id, GeneratedBlockTask.task_id, unique=True)
Index("ix_gen_blocks_run_section", GeneratedBlock.run_id, GeneratedBlock.section_id)
