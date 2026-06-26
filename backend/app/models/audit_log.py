from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import PyObjectId


class ActionEnum(str, Enum):
    ticket_created = "ticket_created"
    ticket_assigned = "ticket_assigned"
    ticket_status_changed = "ticket_status_changed"
    comment_added = "comment_added"
    faq_suggested = "faq_suggested"
    faq_reviewed = "faq_reviewed"
    faq_approved = "faq_approved"
    faq_rejected = "faq_rejected"
    user_role_updated = "user_role_updated"
    user_deactivated = "user_deactivated"
    department_created = "department_created"
    department_updated = "department_updated"


class AuditLogCreate(BaseModel):
    action: ActionEnum
    actor_id: PyObjectId
    entity_type: str
    entity_id: PyObjectId
    metadata: dict[str, Any] = Field(default_factory=dict)


class AuditLogInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    action: ActionEnum
    actor_id: PyObjectId
    entity_type: str
    entity_id: PyObjectId
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
