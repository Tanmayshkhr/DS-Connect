from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import PyObjectId


class StatusEnum(str, Enum):
    open = "open"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"
    overdue = "overdue"


class PriorityEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class CategoryEnum(str, Enum):
    software = "software"
    hardware = "hardware"
    network = "network"
    payroll = "payroll"
    access = "access"
    operations = "operations"
    other = "other"


class TicketCreate(BaseModel):
    title: str
    description: str
    category: CategoryEnum
    priority: PriorityEnum = PriorityEnum.medium
    department_id: PyObjectId


class TicketInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    title: str
    description: str
    category: CategoryEnum
    priority: PriorityEnum = PriorityEnum.medium
    status: StatusEnum = StatusEnum.open
    raised_by: PyObjectId
    department_id: PyObjectId
    assigned_resolver_id: Optional[PyObjectId] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    is_delayed: bool = False
    delay_reason: Optional[str] = None


class TicketResponse(BaseModel):
    id: str
    title: str
    description: str
    category: CategoryEnum
    priority: PriorityEnum
    status: StatusEnum
    raised_by: str
    department_id: str
    assigned_resolver_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    is_delayed: bool = False
    delay_reason: Optional[str] = None


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[CategoryEnum] = None
    priority: Optional[PriorityEnum] = None
    status: Optional[StatusEnum] = None
    department_id: Optional[PyObjectId] = None
    assigned_resolver_id: Optional[PyObjectId] = None
