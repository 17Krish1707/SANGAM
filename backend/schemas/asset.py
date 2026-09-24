from pydantic import BaseModel, ConfigDict
from typing import Optional


class AssetBase(BaseModel):
    asset_type: str
    section_id: str
    department_id: str
    health_state: str = "Good"  # Good | Degraded | Critical
    notes: Optional[str] = None
    track_line: Optional[str] = "UP"
    start_location_ref: Optional[str] = None
    end_location_ref: Optional[str] = None
    chainage_start_km: Optional[float] = None
    chainage_end_km: Optional[float] = None


class AssetCreate(AssetBase):
    pass


class AssetRead(AssetBase):
    id: str

    model_config = ConfigDict(from_attributes=True)
