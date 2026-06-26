"""Users router"""

from datetime import datetime, timezone
from typing import Annotated, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.database import db
from app.models.user import RoleEnum, UserInDB
from app.utils.rbac import get_current_user, require_system_admin

router = APIRouter(prefix="/users", tags=["users"])


class UserRoleUpdateBody(BaseModel):
    role: RoleEnum
    department_id: Optional[str] = None


def _lookup_id(value: str) -> ObjectId | str:
    return ObjectId(value) if ObjectId.is_valid(value) else value


def _serialize_user(user: dict | UserInDB) -> dict:
    if isinstance(user, UserInDB):
        user = user.model_dump(by_alias=True)

    department_id = user.get("department_id")
    role = user.get("role", RoleEnum.employee)
    if isinstance(role, RoleEnum):
        role = role.value

    return {
        "id": str(user.get("_id") or user.get("id")),
        "email": user["email"],
        "name": user.get("name"),
        "role": role,
        "department_id": str(department_id) if department_id else None,
        "is_active": user.get("is_active", True),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
        "last_login": user.get("last_login"),
    }


@router.get("/me")
async def get_me(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    return _serialize_user(current_user)


@router.get("/")
async def list_users(
    _system_admin: Annotated[UserInDB, Depends(require_system_admin)],
    role: Optional[RoleEnum] = Query(default=None),
    department_id: Optional[str] = Query(default=None),
) -> list[dict]:
    filters = {}
    if role:
        filters["role"] = role.value
    if department_id:
        filters["department_id"] = _lookup_id(department_id)

    users = await db.users.find(filters).to_list(length=None)
    return [_serialize_user(user) for user in users]


@router.patch("/{user_id}/role")
async def update_user_role(
    user_id: str,
    body: UserRoleUpdateBody,
    _system_admin: Annotated[UserInDB, Depends(require_system_admin)],
) -> dict:
    updates = {
        "role": body.role.value,
        "updated_at": datetime.now(timezone.utc),
    }
    if body.department_id is not None:
        updates["department_id"] = _lookup_id(body.department_id)

    result = await db.users.update_one(
        {"_id": _lookup_id(user_id)},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user = await db.users.find_one({"_id": _lookup_id(user_id)})
    return _serialize_user(user)


@router.patch("/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    _system_admin: Annotated[UserInDB, Depends(require_system_admin)],
) -> dict:
    result = await db.users.update_one(
        {"_id": _lookup_id(user_id)},
        {
            "$set": {
                "is_active": False,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user = await db.users.find_one({"_id": _lookup_id(user_id)})
    return _serialize_user(user)
