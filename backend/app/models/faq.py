from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import PyObjectId


class FAQStatusEnum(str, Enum):
    suggested = "suggested"
    reviewed = "reviewed"
    published = "published"
    rejected = "rejected"


class FAQCreate(BaseModel):
    question: str
    answer: str
    department_id: PyObjectId
    keywords: list[str] = Field(default_factory=list)


class FAQInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    question: str
    answer: str
    department_id: PyObjectId
    created_by: PyObjectId
    reviewed_by: Optional[PyObjectId] = None
    approved_by: Optional[PyObjectId] = None
    rejected_by: Optional[PyObjectId] = None
    status: FAQStatusEnum = FAQStatusEnum.suggested
    keywords: list[str] = Field(default_factory=list)
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None


class FAQResponse(BaseModel):
    id: str
    question: str
    answer: str
    department_id: str
    created_by: str
    reviewed_by: Optional[str] = None
    approved_by: Optional[str] = None
    rejected_by: Optional[str] = None
    status: FAQStatusEnum
    keywords: list[str] = Field(default_factory=list)
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None


class FAQUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    department_id: Optional[PyObjectId] = None
    status: Optional[FAQStatusEnum] = None
    keywords: Optional[list[str]] = None
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
