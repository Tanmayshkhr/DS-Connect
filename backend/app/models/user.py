from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic_core import core_schema


class PyObjectId(str):
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        return core_schema.no_info_after_validator_function(
            cls.validate,
            core_schema.union_schema(
                [
                    core_schema.is_instance_schema(ObjectId),
                    core_schema.str_schema(),
                ]
            ),
        )

    @classmethod
    def validate(cls, value):
        if isinstance(value, ObjectId):
            return cls(str(value))
        if ObjectId.is_valid(str(value)):
            return cls(str(value))
        raise ValueError("Invalid ObjectId")


class RoleEnum(str, Enum):
    employee = "employee"
    resolver = "resolver"
    dept_admin = "dept_admin"
    system_admin = "system_admin"


class UserCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: RoleEnum = RoleEnum.employee
    department_id: Optional[PyObjectId] = None


class UserInDB(BaseModel):
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True,
        json_encoders={ObjectId: str},
    )

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    email: EmailStr
    name: Optional[str] = None
    role: RoleEnum = RoleEnum.employee
    department_id: Optional[PyObjectId] = None
    is_active: bool = True
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: Optional[datetime] = None


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    role: RoleEnum
    department_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[RoleEnum] = None
    department_id: Optional[PyObjectId] = None
    is_active: Optional[bool] = None


class AuthUserResponse(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    role: str
    department_id: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: AuthUserResponse
