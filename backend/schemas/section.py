from pydantic import BaseModel, ConfigDict
from typing import Optional


class RailwaySectionBase(BaseModel):
    name: str
    from_station: str
    to_station: str
    line_type: str = "double"
    section_capacity_notes: Optional[str] = None


class RailwaySectionCreate(RailwaySectionBase):
    pass


class RailwaySectionRead(RailwaySectionBase):
    id: str

    model_config = ConfigDict(from_attributes=True)
