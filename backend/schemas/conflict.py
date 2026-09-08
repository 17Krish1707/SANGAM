from pydantic import BaseModel, ConfigDict
from typing import Optional


class TaskConflictBase(BaseModel):
    task_a_id: str
    task_b_id: str
    relationship: str  # compatible | conflict | dependency
    notes: Optional[str] = None


class TaskConflictCreate(TaskConflictBase):
    pass


class TaskConflictRead(TaskConflictBase):
    id: str

    model_config = ConfigDict(from_attributes=True)
