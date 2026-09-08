import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.database import Base, GUID


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    task_code = Column(String(50), nullable=False, unique=True, index=True)
    department_id = Column(GUID, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id = Column(GUID, ForeignKey("railway_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(GUID, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True)
    maintenance_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False, default="Medium")  # Low | Medium | High | Critical
    detected_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=False, index=True)
    estimated_duration_min = Column(Integer, nullable=False)
    minimum_contiguous_block_min = Column(Integer, nullable=False)
    requires_power_isolation = Column(Boolean, nullable=False, default=False)
    can_run_parallel = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="Pending", index=True)  # Pending | Ready for Planning | Scheduled | Completed | Deferred
    priority_score = Column(Float, nullable=True, index=True)
    description = Column(String(500), nullable=True)
    operational_notes = Column(String(500), nullable=True)
    source = Column(String(50), nullable=False, default="Synthetic Demo")  # Manual | CSV Import | Synthetic Demo | API
    deferred_reason = Column(String(255), nullable=True)
    deferred_until = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    completion_notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    department = relationship("Department", back_populates="tasks")
    section = relationship("RailwaySection", back_populates="tasks")
    asset = relationship("Asset", back_populates="tasks")
    resource_requirements = relationship("TaskResourceRequirement", back_populates="task", cascade="all, delete-orphan")
    conflicts_as_a = relationship("TaskConflict", foreign_keys="[TaskConflict.task_a_id]", back_populates="task_a", cascade="all, delete-orphan")
    conflicts_as_b = relationship("TaskConflict", foreign_keys="[TaskConflict.task_b_id]", back_populates="task_b", cascade="all, delete-orphan")
    block_assignments = relationship("GeneratedBlockTask", back_populates="task", cascade="all, delete-orphan")


Index("ix_tasks_section_status", MaintenanceTask.section_id, MaintenanceTask.status)
Index("ix_tasks_dept_status_due", MaintenanceTask.department_id, MaintenanceTask.status, MaintenanceTask.due_date)
