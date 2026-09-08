from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional


class MaintenanceTaskBase(BaseModel):
    task_code: str
    department_id: str
    section_id: str
    asset_id: Optional[str] = None
    maintenance_type: str
    severity: str = "Medium"  # Low | Medium | High | Critical
    detected_at: Optional[datetime] = None
    due_date: datetime
    estimated_duration_min: int
    minimum_contiguous_block_min: int
    requires_power_isolation: bool = False
    can_run_parallel: bool = False
    status: str = "Pending"  # Pending | Scheduled | Completed | Deferred
    priority_score: Optional[float] = None


class MaintenanceTaskCreate(MaintenanceTaskBase):
    pass


class MaintenanceTaskRead(MaintenanceTaskBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
