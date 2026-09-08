from pydantic import BaseModel, ConfigDict
from typing import Optional


class ResourceBase(BaseModel):
    department_id: str
    resource_type: str  # Crew | Equipment
    name: str
    is_available: bool = True


class ResourceCreate(ResourceBase):
    pass


class ResourceRead(ResourceBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


class TaskResourceRequirementBase(BaseModel):
    task_id: str
    resource_id: str


class TaskResourceRequirementCreate(TaskResourceRequirementBase):
    pass


class TaskResourceRequirementRead(TaskResourceRequirementBase):
    id: str

    model_config = ConfigDict(from_attributes=True)
