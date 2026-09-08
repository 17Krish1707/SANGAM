import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.database import Base, GUID


class Resource(Base):
    __tablename__ = "resources"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    department_id = Column(GUID, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False)  # Crew | Equipment
    name = Column(String(100), nullable=False)
    is_available = Column(Boolean, nullable=False, default=True)
    unavailability_reason = Column(String(255), nullable=True)  # Maintenance, breakdown, diverted, etc.
    unavailable_from = Column(String(50), nullable=True)
    unavailable_until = Column(String(50), nullable=True)

    department = relationship("Department", back_populates="resources")
    task_requirements = relationship("TaskResourceRequirement", back_populates="resource", cascade="all, delete-orphan")


class TaskResourceRequirement(Base):
    __tablename__ = "task_resource_requirements"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    task_id = Column(GUID, ForeignKey("maintenance_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_id = Column(GUID, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)

    task = relationship("MaintenanceTask", back_populates="resource_requirements")
    resource = relationship("Resource", back_populates="task_requirements")


Index("ix_task_resource_unique", TaskResourceRequirement.task_id, TaskResourceRequirement.resource_id, unique=True)
