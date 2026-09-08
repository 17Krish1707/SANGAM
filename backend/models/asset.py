import uuid
from sqlalchemy import Column, String, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.database import Base, GUID


class Asset(Base):
    __tablename__ = "assets"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    asset_type = Column(String(100), nullable=False)
    section_id = Column(GUID, ForeignKey("railway_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    department_id = Column(GUID, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    health_state = Column(String(20), nullable=False, default="Good")  # Good | Degraded | Critical
    notes = Column(Text, nullable=True)

    section = relationship("RailwaySection", back_populates="assets")
    department = relationship("Department", back_populates="assets")
    tasks = relationship("MaintenanceTask", back_populates="asset")


Index("ix_assets_section_department", Asset.section_id, Asset.department_id)
