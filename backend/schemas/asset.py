from pydantic import BaseModel, ConfigDict
from typing import Optional


class AssetBase(BaseModel):
    asset_type: str
    section_id: str
    department_id: str
    health_state: str = "Good"  # Good | Degraded | Critical
    notes: Optional[str] = None


class AssetCreate(AssetBase):
    pass


class AssetRead(AssetBase):
    id: str

    model_config = ConfigDict(from_attributes=True)
