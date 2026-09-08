import uuid
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.database import Base, GUID


class BlockWindow(Base):
    __tablename__ = "block_windows"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    section_id = Column(GUID, ForeignKey("railway_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    window_start = Column(DateTime, nullable=False, index=True)
    window_end = Column(DateTime, nullable=False, index=True)
    block_type = Column(String(50), nullable=False, default="Maintenance")  # Maintenance | Mega-block
    is_available = Column(Boolean, nullable=False, default=True)
    unavailability_reason = Column(String(255), nullable=True)  # Operational restriction, VIP train, Weather, etc.
    source = Column(String(50), nullable=False, default="Computed Gap")  # Computed Gap | Manual | COA
    risk_score = Column(Float, nullable=True)

    section = relationship("RailwaySection", back_populates="block_windows")


Index("ix_block_windows_section_available", BlockWindow.section_id, BlockWindow.is_available, BlockWindow.window_start)
