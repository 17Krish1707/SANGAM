from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional


class BlockWindowBase(BaseModel):
    section_id: str
    window_start: datetime
    window_end: datetime
    block_type: str = "Maintenance"  # Maintenance | Mega-block
    is_available: bool = True
    risk_score: Optional[float] = None


class BlockWindowCreate(BlockWindowBase):
    pass


class BlockWindowRead(BlockWindowBase):
    id: str

    model_config = ConfigDict(from_attributes=True)
