"""Users router"""

from datetime import datetime, timezone
from typing import Annotated, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.database import db
from app.models.audit_log import ActionEnum
from app.models.user import RoleEnum, UserInDB
from app.utils.rbac import get_current_user, require_roles, require_system_admin

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


class UpdateMeBody(BaseModel):
    name: Optional[str] = None
    department_id: Optional[str] = None


@router.patch("/me")
async def update_me(
    body: UpdateMeBody,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    """Allow any authenticated user to update their own name and department."""
    updates: dict = {"updated_at": datetime.now(timezone.utc)}

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Name cannot be empty.",
            )
        updates["name"] = name

    if body.department_id is not None:
        if body.department_id == "":
            updates["department_id"] = None
        else:
            dept_oid = _lookup_id(body.department_id)
            dept = await db.departments.find_one({"_id": dept_oid})
            if not dept:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Department not found",
                )
            updates["department_id"] = dept_oid

    user_oid = _lookup_id(current_user.id)
    await db.users.update_one({"_id": user_oid}, {"$set": updates})
    updated = await db.users.find_one({"_id": user_oid})
    return _serialize_user(updated)


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


@router.get("/resolvers")
async def list_resolvers(
    _admin: Annotated[
        UserInDB,
        Depends(require_roles(RoleEnum.dept_admin, RoleEnum.system_admin)),
    ],
    department_id: str = Query(...),
) -> list[dict]:
    filters = {
        "role": RoleEnum.resolver.value,
        "department_id": _lookup_id(department_id),
    }

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


# ---------------------------------------------------------------------------
# PATCH /users/{user_id}/onboard — system_admin only
# ---------------------------------------------------------------------------

class OnboardBody(BaseModel):
    role: RoleEnum
    department_id: str


@router.patch("/{user_id}/onboard")
async def onboard_user(
    user_id: str,
    body: OnboardBody,
    admin: Annotated[UserInDB, Depends(require_system_admin)],
) -> dict:
    """
    Assign a role and department to a newly auto-created user.

    Also marks the user is_active=True and writes a 'user_onboarded' audit log
    so the notification can be resolved and the pending-setup badge cleared.
    """
    target = await db.users.find_one({"_id": _lookup_id(user_id)})
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    dept_oid = _lookup_id(body.department_id)
    dept = await db.departments.find_one({"_id": dept_oid})
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found",
        )

    now = datetime.now(timezone.utc)
    updates = {
        "role": body.role.value,
        "department_id": dept_oid,
        "is_active": True,
        "updated_at": now,
    }
    await db.users.update_one({"_id": target["_id"]}, {"$set": updates})

    admin_oid = _lookup_id(admin.id)
    await db.audit_logs.insert_one(
        {
            "action": ActionEnum.user_onboarded.value,
            "actor_id": admin_oid,
            "entity_type": "user",
            "entity_id": target["_id"],
            "metadata": {
                "user_id": str(target["_id"]),
                "email": target["email"],
                "role": body.role.value,
                "department_id": str(dept_oid),
                "department_name": dept["name"],
            },
            "created_at": now,
        }
    )

    updated = await db.users.find_one({"_id": target["_id"]})
    return _serialize_user(updated)

