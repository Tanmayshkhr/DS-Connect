"""Audit Logs router — GET /audit-logs/"""

from datetime import timezone
from typing import Annotated, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Query

from app.database import db
from app.models.user import RoleEnum, UserInDB
from app.utils.rbac import get_current_user

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


def _oid(value: str) -> ObjectId:
    return ObjectId(value) if ObjectId.is_valid(value) else None


def _to_utc_iso(dt) -> str | None:
    """Re-attach UTC tzinfo stripped by Motor before calling .isoformat()."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _serialize_log(log: dict) -> dict:
    return {
        "id": str(log["_id"]),
        "action": log.get("action"),
        "actor_id": str(log.get("actor_id", "")),
        "entity_type": log.get("entity_type"),
        "entity_id": str(log.get("entity_id", "")),
        "metadata": log.get("metadata", {}),
        "created_at": _to_utc_iso(log.get("created_at")),
    }


def _role_value(user: UserInDB) -> str:
    return user.role.value if isinstance(user.role, RoleEnum) else str(user.role)


@router.get("/")
async def list_audit_logs(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
    entity_id: Optional[str] = Query(default=None),
    limit: int = Query(default=20, le=100),
) -> list[dict]:
    """
    Returns audit log entries scoped by role (most recent first).

    - employee      → entries where actor_id == current user
    - resolver      → entries where actor_id == current user
    - dept_admin    → entries where entity is a ticket in their department,
                      or entity is an FAQ in their department
    - system_admin  → all entries

    Optional query param:
      entity_id — filter to logs for a specific entity (e.g. a ticket id)
    """
    role = _role_value(current_user)
    user_oid = _oid(current_user.id)

    query: dict = {}

    # entity_id override (e.g. "View Full History" for a specific ticket)
    if entity_id and ObjectId.is_valid(entity_id):
        query["entity_id"] = ObjectId(entity_id)
    else:
        # Role-scoped filtering
        if role in (RoleEnum.employee.value, RoleEnum.resolver.value):
            query["actor_id"] = user_oid

        elif role == RoleEnum.dept_admin.value:
            if current_user.department_id:
                dept_oid = _oid(str(current_user.department_id))
                # Find all ticket ids in this department
                dept_ticket_ids = [
                    t["_id"]
                    async for t in db.tickets.find(
                        {"department_id": dept_oid}, {"_id": 1}
                    )
                ]
                # Find all FAQ ids in this department
                dept_faq_ids = [
                    f["_id"]
                    async for f in db.faqs.find(
                        {"department_id": dept_oid}, {"_id": 1}
                    )
                ]
                relevant_ids = dept_ticket_ids + dept_faq_ids
                if relevant_ids:
                    query["entity_id"] = {"$in": relevant_ids}
                else:
                    # No tickets/FAQs in dept yet — return empty
                    return []
            else:
                return []
        # system_admin: no filter — sees everything

    logs = (
        await db.audit_logs.find(query)
        .sort("created_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    return [_serialize_log(log) for log in logs]
