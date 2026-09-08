import uuid
from sqlalchemy import Column, String, Text, Float, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base, GUID


class RailwaySection(Base):
    __tablename__ = "railway_sections"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    corridor_name = Column(String(100), nullable=True, default="Main Corridor")
    from_station = Column(String(50), nullable=False)
    to_station = Column(String(50), nullable=False)
    length_km = Column(Float, nullable=True, default=25.0)
    line_type = Column(String(20), nullable=False, default="double")  # single | double
    is_electrified = Column(Boolean, nullable=True, default=True)
    traction_type = Column(String(50), nullable=True, default="25 kV AC OHE")
    section_capacity_notes = Column(Text, nullable=True)

    assets = relationship("Asset", back_populates="section", cascade="all, delete-orphan")
    tasks = relationship("MaintenanceTask", back_populates="section", cascade="all, delete-orphan")
    train_movements = relationship("TrainMovement", back_populates="section", cascade="all, delete-orphan")
    block_windows = relationship("BlockWindow", back_populates="section", cascade="all, delete-orphan")
    generated_blocks = relationship("GeneratedBlock", back_populates="section", cascade="all, delete-orphan")
