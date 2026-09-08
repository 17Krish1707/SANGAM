from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional


class TrainMovementBase(BaseModel):
    section_id: str
    train_type: str  # Passenger | Goods
    entry_time: datetime
    exit_time: datetime
    priority: int = 1
    forecast_confidence: Optional[float] = None


class TrainMovementCreate(TrainMovementBase):
    pass


class TrainMovementRead(TrainMovementBase):
    id: str

    model_config = ConfigDict(from_attributes=True)
