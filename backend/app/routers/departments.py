from typing import Annotated, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.database import db
from app.models.user import RoleEnum, UserInDB
from app.utils.rbac import get_current_user

router = APIRouter(prefix="/departments", tags=["departments"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _oid(value: str) -> ObjectId:
    if ObjectId.is_valid(value):
        return ObjectId(value)
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Invalid ObjectId: {value}",
    )


def _role_value(user: UserInDB) -> str:
    return user.role.value if isinstance(user.role, RoleEnum) else str(user.role)


def _serialize_dept(d: dict) -> dict:
    return {
        "id": str(d["_id"]),
        "name": d["name"],
        "admin_id": str(d["admin_id"]) if d.get("admin_id") else None,
    }


def _require_roles(user: UserInDB, *roles: str) -> None:
    if _role_value(user) not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DepartmentCreate(BaseModel):
    name: str


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    admin_id: Optional[str] = None


# ---------------------------------------------------------------------------
# GET /departments/ — all authenticated roles
# ---------------------------------------------------------------------------

@router.get("/")
async def list_departments(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> list[dict]:
    departments = await db.departments.find().sort("name", 1).to_list(length=None)
    return [_serialize_dept(d) for d in departments]


# ---------------------------------------------------------------------------
# POST /departments/ — system_admin only
# ---------------------------------------------------------------------------

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_department(
    body: DepartmentCreate,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    _require_roles(current_user, RoleEnum.system_admin.value)

    existing = await db.departments.find_one({"name": {"$regex": f"^{body.name}$", "$options": "i"}})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Department '{body.name}' already exists",
        )

    doc = {"name": body.name, "admin_id": None}
    result = await db.departments.insert_one(doc)
    created = await db.departments.find_one({"_id": result.inserted_id})
    return _serialize_dept(created)


# ---------------------------------------------------------------------------
# PATCH /departments/{dept_id} — system_admin only
# ---------------------------------------------------------------------------

@router.patch("/{dept_id}")
async def update_department(
    dept_id: str,
    body: DepartmentUpdate,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    _require_roles(current_user, RoleEnum.system_admin.value)

    dept = await db.departments.find_one({"_id": _oid(dept_id)})
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found",
        )

    updates: dict = {}

    if body.name is not None:
        duplicate = await db.departments.find_one({
            "name": {"$regex": f"^{body.name}$", "$options": "i"},
            "_id": {"$ne": _oid(dept_id)},
        })
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Department '{body.name}' already exists",
            )
        updates["name"] = body.name

    if body.admin_id is not None:
        admin_oid = _oid(body.admin_id)
        admin_user = await db.users.find_one({"_id": admin_oid})
        if not admin_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        allowed_admin_roles = {RoleEnum.dept_admin.value, RoleEnum.system_admin.value}
        if admin_user.get("role") not in allowed_admin_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have dept_admin or system_admin role to be set as department admin",
            )
        updates["admin_id"] = admin_oid

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )

    await db.departments.update_one({"_id": dept["_id"]}, {"$set": updates})
    updated = await db.departments.find_one({"_id": dept["_id"]})
    return _serialize_dept(updated)


# ---------------------------------------------------------------------------
# GET /departments/{dept_id}/stats — dept_admin + system_admin
# ---------------------------------------------------------------------------

@router.get("/{dept_id}/stats")
async def department_stats(
    dept_id: str,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    _require_roles(
        current_user,
        RoleEnum.dept_admin.value,
        RoleEnum.system_admin.value,
    )

    dept_oid = _oid(dept_id)
    dept = await db.departments.find_one({"_id": dept_oid})
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found",
        )

    pipeline = [
        {"$match": {"department_id": dept_oid}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    cursor = db.tickets.aggregate(pipeline)
    raw = await cursor.to_list(length=None)

    counts: dict[str, int] = {row["_id"]: row["count"] for row in raw}

    return {
        "department_id": dept_id,
        "department_name": dept["name"],
        "open": counts.get("open", 0),
        "in_progress": counts.get("in_progress", 0),
        "resolved": counts.get("resolved", 0),
        "closed": counts.get("closed", 0),
        "total": sum(counts.values()),
    }
