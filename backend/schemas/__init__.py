from backend.schemas.department import DepartmentCreate, DepartmentRead
from backend.schemas.section import RailwaySectionCreate, RailwaySectionRead
from backend.schemas.asset import AssetCreate, AssetRead
from backend.schemas.task import MaintenanceTaskCreate, MaintenanceTaskRead
from backend.schemas.train import TrainMovementCreate, TrainMovementRead
from backend.schemas.block_window import BlockWindowCreate, BlockWindowRead
from backend.schemas.resource import ResourceCreate, ResourceRead, TaskResourceRequirementCreate, TaskResourceRequirementRead
from backend.schemas.conflict import TaskConflictCreate, TaskConflictRead
from backend.schemas.optimization import (
    OptimizationRunCreate,
    OptimizationRunRead,
    GeneratedBlockCreate,
    GeneratedBlockRead,
    GeneratedBlockTaskCreate,
    GeneratedBlockTaskRead,
)

__all__ = [
    "DepartmentCreate",
    "DepartmentRead",
    "RailwaySectionCreate",
    "RailwaySectionRead",
    "AssetCreate",
    "AssetRead",
    "MaintenanceTaskCreate",
    "MaintenanceTaskRead",
    "TrainMovementCreate",
    "TrainMovementRead",
    "BlockWindowCreate",
    "BlockWindowRead",
    "ResourceCreate",
    "ResourceRead",
    "TaskResourceRequirementCreate",
    "TaskResourceRequirementRead",
    "TaskConflictCreate",
    "TaskConflictRead",
    "OptimizationRunCreate",
    "OptimizationRunRead",
    "GeneratedBlockCreate",
    "GeneratedBlockRead",
    "GeneratedBlockTaskCreate",
    "GeneratedBlockTaskRead",
]
