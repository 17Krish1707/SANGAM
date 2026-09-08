import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.database import Base, GUID


class TrainMovement(Base):
    __tablename__ = "train_movements"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    section_id = Column(GUID, ForeignKey("railway_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    train_type = Column(String(20), nullable=False)  # Passenger | Goods
    entry_time = Column(DateTime, nullable=False, index=True)
    exit_time = Column(DateTime, nullable=False, index=True)
    priority = Column(Integer, nullable=False, default=1)  # 1 = Highest, higher numbers = lower priority
    forecast_confidence = Column(Float, nullable=True)  # For goods trains (0.0 to 1.0)

    section = relationship("RailwaySection", back_populates="train_movements")


Index("ix_train_movements_section_times", TrainMovement.section_id, TrainMovement.entry_time, TrainMovement.exit_time)
