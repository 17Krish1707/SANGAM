from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class OptimizationRunBase(BaseModel):
    run_type: str  # independent_baseline | greedy_baseline | sangam_optimized
    horizon: str = "weekly"  # weekly | monthly
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    objective_value: Optional[float] = None
    status: str = "running"  # running | completed | infeasible | failed
    parent_run_id: Optional[str] = None


class OptimizationRunCreate(OptimizationRunBase):
    pass


class OptimizationRunRead(OptimizationRunBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


class GeneratedBlockBase(BaseModel):
    run_id: str
    section_id: str
    block_start: datetime
    block_end: datetime
    is_joint_block: bool = False


class GeneratedBlockCreate(GeneratedBlockBase):
    pass


class GeneratedBlockRead(GeneratedBlockBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


class GeneratedBlockTaskBase(BaseModel):
    block_id: str
    task_id: str


class GeneratedBlockTaskCreate(GeneratedBlockTaskBase):
    pass


class GeneratedBlockTaskRead(GeneratedBlockTaskBase):
    id: str

    model_config = ConfigDict(from_attributes=True)
