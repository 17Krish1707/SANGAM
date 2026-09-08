import uuid
from sqlalchemy import Column, String, Text, ForeignKey, Index
from sqlalchemy.orm import relationship as orm_relationship
from backend.database import Base, GUID


class TaskConflict(Base):
    __tablename__ = "task_conflicts"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    task_a_id = Column(GUID, ForeignKey("maintenance_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    task_b_id = Column(GUID, ForeignKey("maintenance_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship = Column(String(20), nullable=False)  # compatible | conflict | dependency
    notes = Column(Text, nullable=True)

    task_a = orm_relationship("MaintenanceTask", foreign_keys=[task_a_id], back_populates="conflicts_as_a")
    task_b = orm_relationship("MaintenanceTask", foreign_keys=[task_b_id], back_populates="conflicts_as_b")


Index("ix_task_conflicts_ab", TaskConflict.task_a_id, TaskConflict.task_b_id)
Index("ix_task_conflicts_rel", TaskConflict.relationship)
