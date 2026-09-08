import uuid
from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from backend.database import Base, GUID


class RailwaySection(Base):
    __tablename__ = "railway_sections"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    from_station = Column(String(50), nullable=False)
    to_station = Column(String(50), nullable=False)
    line_type = Column(String(20), nullable=False, default="double")  # single | double
    section_capacity_notes = Column(Text, nullable=True)

    assets = relationship("Asset", back_populates="section", cascade="all, delete-orphan")
    tasks = relationship("MaintenanceTask", back_populates="section", cascade="all, delete-orphan")
    train_movements = relationship("TrainMovement", back_populates="section", cascade="all, delete-orphan")
    block_windows = relationship("BlockWindow", back_populates="section", cascade="all, delete-orphan")
    generated_blocks = relationship("GeneratedBlock", back_populates="section", cascade="all, delete-orphan")
