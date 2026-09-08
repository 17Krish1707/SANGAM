import uuid
from sqlalchemy import Column, String
from sqlalchemy.orm import relationship
from backend.database import Base, GUID


class Department(Base):
    __tablename__ = "departments"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    code = Column(String(20), nullable=False, unique=True)

    assets = relationship("Asset", back_populates="department", cascade="all, delete-orphan")
    tasks = relationship("MaintenanceTask", back_populates="department", cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="department", cascade="all, delete-orphan")
