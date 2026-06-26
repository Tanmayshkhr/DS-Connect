from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import PyObjectId


class CommentCreate(BaseModel):
    ticket_id: PyObjectId
    body: str
    is_internal: bool = False


class CommentInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    ticket_id: PyObjectId
    body: str
    is_internal: bool = False
    created_by: PyObjectId
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class CommentResponse(BaseModel):
    id: str
    ticket_id: str
    body: str
    is_internal: bool = False
    created_by: str
    created_at: datetime
