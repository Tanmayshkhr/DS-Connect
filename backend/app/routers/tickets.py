"""Tickets router"""

from datetime import datetime, timezone
from typing import Annotated, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.database import db
from app.models.audit_log import ActionEnum
from app.models.ticket import (
    CategoryEnum,
    PriorityEnum,
    StatusEnum,
    TicketCreate,
)
from app.models.user import RoleEnum, UserInDB
from app.utils.rbac import get_current_user

router = APIRouter(prefix="/tickets", tags=["tickets"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _oid(value: str) -> ObjectId:
    """Convert string to ObjectId, raising 422 on bad value."""
    if ObjectId.is_valid(value):
        return ObjectId(value)
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Invalid ObjectId: {value}",
    )


def _to_utc_iso(dt) -> str | None:
    """
    Convert a datetime returned by Motor to an ISO-8601 string with an explicit
    UTC offset (e.g. "2026-07-23T06:51:55+00:00").

    Motor's AsyncIOMotorClient without tz_aware=True returns *naive* datetime
    objects even though the values stored in MongoDB are UTC.  Python's
    datetime.isoformat() on a naive datetime omits any timezone suffix,
    producing e.g. "2026-07-23T06:51:55".  JavaScript's new Date() treats a
    no-suffix ISO string as *local* time, not UTC — causing timestamps to appear
    shifted by the server/browser timezone offset (e.g. 5 h 30 min on IST).

    This helper re-attaches UTC tzinfo before serialising so the wire format
    is always unambiguous.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _serialize_ticket(t: dict) -> dict:
    return {
        "id": str(t["_id"]),
        "title": t["title"],
        "description": t["description"],
        "category": t["category"],
        "priority": t["priority"],
        "status": t["status"],
        "raised_by": str(t["raised_by"]),
        "department_id": str(t["department_id"]),
        "assigned_resolver_id": (
            str(t["assigned_resolver_id"])
            if t.get("assigned_resolver_id")
            else None
        ),
        "created_at": _to_utc_iso(t.get("created_at")),
        "updated_at": _to_utc_iso(t.get("updated_at")),
        "resolved_at": _to_utc_iso(t.get("resolved_at")),
        "closed_at": _to_utc_iso(t.get("closed_at")),
        "is_delayed": t.get("is_delayed", False),
        "delay_reason": t.get("delay_reason"),
    }


def _serialize_comment(c: dict) -> dict:
    return {
        "id": str(c["_id"]),
        "ticket_id": str(c["ticket_id"]),
        "body": c["body"],
        "is_internal": c.get("is_internal", False),
        "created_by": str(c["created_by"]),
        "created_at": _to_utc_iso(c.get("created_at")),
    }


async def _insert_audit_log(
    action: ActionEnum,
    actor_id: ObjectId,
    entity_type: str,
    entity_id: ObjectId,
    metadata: dict,
) -> None:
    now = datetime.now(timezone.utc)
    await db.audit_logs.insert_one(
        {
            "action": action.value,
            "actor_id": actor_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "metadata": metadata,
            "created_at": now,
        }
    )


async def _get_ticket_or_404(ticket_id: str) -> dict:
    ticket = await db.tickets.find_one({"_id": _oid(ticket_id)})
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )
    return ticket


def _role_value(user: UserInDB) -> str:
    return (
        user.role.value if isinstance(user.role, RoleEnum) else str(user.role)
    )


# ---------------------------------------------------------------------------
# POST /tickets/ — raise a ticket
# ---------------------------------------------------------------------------

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_ticket(
    body: TicketCreate,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    """Any authenticated user can raise a ticket."""
    now = datetime.now(timezone.utc)
    user_oid = _oid(current_user.id)
    dept_oid = _oid(str(body.department_id))

    doc = {
        "title": body.title,
        "description": body.description,
        "category": body.category.value,
        "priority": body.priority.value,
        "status": StatusEnum.open.value,
        "raised_by": user_oid,
        "department_id": dept_oid,
        "assigned_resolver_id": None,
        "created_at": now,
        "updated_at": None,
        "resolved_at": None,
        "closed_at": None,
        "is_delayed": False,
        "delay_reason": None,
    }

    result = await db.tickets.insert_one(doc)
    ticket = await db.tickets.find_one({"_id": result.inserted_id})

    await _insert_audit_log(
        action=ActionEnum.ticket_created,
        actor_id=user_oid,
        entity_type="ticket",
        entity_id=result.inserted_id,
        metadata={
            "title": body.title,
            "category": body.category.value,
            "priority": body.priority.value,
            "department_id": str(dept_oid),
        },
    )

    return _serialize_ticket(ticket)


# ---------------------------------------------------------------------------
# GET /tickets/ — list tickets with role-based filtering
# ---------------------------------------------------------------------------

@router.get("/")
async def list_tickets(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
    ticket_status: Optional[StatusEnum] = Query(default=None, alias="status"),
    priority: Optional[PriorityEnum] = Query(default=None),
    category: Optional[CategoryEnum] = Query(default=None),
) -> list[dict]:
    """
    Role-filtered list:
    - employee      → own tickets only
    - resolver      → tickets assigned to them + tickets in their dept (open/unassigned)
    - dept_admin    → all tickets in their department
    - system_admin  → all tickets
    """
    role = _role_value(current_user)
    user_oid = _oid(current_user.id)
    dept_oid = (
        _oid(str(current_user.department_id))
        if current_user.department_id
        else None
    )

    base_filter: dict = {}

    if role == RoleEnum.employee.value:
        base_filter["raised_by"] = user_oid

    elif role == RoleEnum.resolver.value:
        # resolver sees tickets assigned to them OR unassigned open tickets in their dept
        resolver_filter: list[dict] = [{"assigned_resolver_id": user_oid}]
        if dept_oid:
            resolver_filter.append(
                {
                    "department_id": dept_oid,
                    "assigned_resolver_id": None,
                    "status": StatusEnum.open.value,
                }
            )
        base_filter["$or"] = resolver_filter

    elif role == RoleEnum.dept_admin.value:
        if dept_oid:
            base_filter["department_id"] = dept_oid
        else:
            # dept_admin with no department assigned — return nothing rather
            # than falling through to an empty filter that exposes all tickets.
            base_filter["department_id"] = None  # matches zero documents

    # Apply optional query filters on top
    if ticket_status:
        base_filter["status"] = ticket_status.value
    if priority:
        base_filter["priority"] = priority.value
    if category:
        base_filter["category"] = category.value

    tickets = await db.tickets.find(base_filter).sort("created_at", -1).to_list(length=None)
    return [_serialize_ticket(t) for t in tickets]


# ---------------------------------------------------------------------------
# GET /tickets/{ticket_id} — detail view, role-checked
# ---------------------------------------------------------------------------

@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    ticket = await _get_ticket_or_404(ticket_id)
    role = _role_value(current_user)
    user_oid = _oid(current_user.id)

    # Access control
    if role == RoleEnum.employee.value:
        if ticket["raised_by"] != user_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
    elif role == RoleEnum.resolver.value:
        is_assigned = ticket.get("assigned_resolver_id") == user_oid
        dept_oid = (
            _oid(str(current_user.department_id))
            if current_user.department_id
            else None
        )
        in_dept = dept_oid and ticket["department_id"] == dept_oid
        if not is_assigned and not in_dept:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
    elif role == RoleEnum.dept_admin.value:
        dept_oid = (
            _oid(str(current_user.department_id))
            if current_user.department_id
            else None
        )
        if dept_oid and ticket["department_id"] != dept_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
    # system_admin: full access, no check needed

    return _serialize_ticket(ticket)


# ---------------------------------------------------------------------------
# PATCH /tickets/{ticket_id}/status — update ticket status
# ---------------------------------------------------------------------------

class StatusUpdateBody(BaseModel):
    status: StatusEnum


@router.patch("/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    body: StatusUpdateBody,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    """Resolver, dept_admin, system_admin can update ticket status."""
    role = _role_value(current_user)
    allowed = {
        RoleEnum.resolver.value,
        RoleEnum.dept_admin.value,
        RoleEnum.system_admin.value,
    }
    if role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update status",
        )

    ticket = await _get_ticket_or_404(ticket_id)
    user_oid = _oid(current_user.id)

    # dept_admin may only update tickets belonging to their own department
    if role == RoleEnum.dept_admin.value:
        admin_dept_oid = (
            _oid(str(current_user.department_id))
            if current_user.department_id
            else None
        )
        if not admin_dept_oid or ticket["department_id"] != admin_dept_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="dept_admin can only update status of tickets in their own department",
            )

    # resolver may only update status of tickets explicitly assigned to them
    elif role == RoleEnum.resolver.value:
        if ticket.get("assigned_resolver_id") != user_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="resolver can only update status of tickets assigned to them",
            )

    now = datetime.now(timezone.utc)
    old_status = ticket["status"]
    new_status = body.status.value

    updates: dict = {
        "status": new_status,
        "updated_at": now,
    }
    if new_status == StatusEnum.resolved.value:
        updates["resolved_at"] = now
    elif new_status == StatusEnum.closed.value:
        updates["closed_at"] = now

    await db.tickets.update_one(
        {"_id": ticket["_id"]},
        {"$set": updates},
    )

    await _insert_audit_log(
        action=ActionEnum.ticket_status_changed,
        actor_id=_oid(current_user.id),
        entity_type="ticket",
        entity_id=ticket["_id"],
        metadata={"old_status": old_status, "new_status": new_status},
    )

    updated = await db.tickets.find_one({"_id": ticket["_id"]})
    return _serialize_ticket(updated)


# ---------------------------------------------------------------------------
# PATCH /tickets/{ticket_id}/assign — assign a resolver
# ---------------------------------------------------------------------------

class AssignBody(BaseModel):
    resolver_id: str


@router.patch("/{ticket_id}/assign")
async def assign_ticket(
    ticket_id: str,
    body: AssignBody,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    """dept_admin and system_admin can assign a resolver to a ticket."""
    role = _role_value(current_user)
    allowed = {RoleEnum.dept_admin.value, RoleEnum.system_admin.value}
    if role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to assign tickets",
        )

    ticket = await _get_ticket_or_404(ticket_id)
    resolver_oid = _oid(body.resolver_id)

    # dept_admin may only assign tickets in their own department
    if role == RoleEnum.dept_admin.value:
        admin_dept_oid = (
            _oid(str(current_user.department_id))
            if current_user.department_id
            else None
        )
        if not admin_dept_oid or ticket["department_id"] != admin_dept_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="dept_admin can only assign tickets in their own department",
            )

    # Verify the resolver exists and actually has the resolver role
    resolver = await db.users.find_one({"_id": resolver_oid})
    if not resolver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resolver user not found",
        )
    if resolver.get("role") not in (RoleEnum.resolver.value, "resolver"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target user is not a resolver",
        )

    now = datetime.now(timezone.utc)
    await db.tickets.update_one(
        {"_id": ticket["_id"]},
        {
            "$set": {
                "assigned_resolver_id": resolver_oid,
                "status": StatusEnum.assigned.value,
                "updated_at": now,
            }
        },
    )

    await _insert_audit_log(
        action=ActionEnum.ticket_assigned,
        actor_id=_oid(current_user.id),
        entity_type="ticket",
        entity_id=ticket["_id"],
        metadata={
            "resolver_id": str(resolver_oid),
            "resolver_email": resolver.get("email"),
        },
    )

    updated = await db.tickets.find_one({"_id": ticket["_id"]})
    return _serialize_ticket(updated)


# ---------------------------------------------------------------------------
# PATCH /tickets/{ticket_id}/delay — flag a ticket as delayed (resolver only)
# ---------------------------------------------------------------------------

class DelayBody(BaseModel):
    is_delayed: bool = True
    delay_reason: str


@router.patch("/{ticket_id}/delay")
async def flag_ticket_delayed(
    ticket_id: str,
    body: DelayBody,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    """Resolver can flag a ticket they own as delayed (or clear the flag)."""
    role = _role_value(current_user)
    if role != RoleEnum.resolver.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only resolvers can flag tickets as delayed",
        )

    ticket = await _get_ticket_or_404(ticket_id)
    user_oid = _oid(current_user.id)

    # Ownership check — resolver must be assigned to this ticket
    if ticket.get("assigned_resolver_id") != user_oid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only flag tickets assigned to you as delayed",
        )

    if body.is_delayed and not body.delay_reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A non-empty delay_reason is required when flagging as delayed",
        )

    now = datetime.now(timezone.utc)
    updates: dict = {
        "is_delayed": body.is_delayed,
        "delay_reason": body.delay_reason.strip() if body.is_delayed else None,
        "updated_at": now,
    }

    await db.tickets.update_one(
        {"_id": ticket["_id"]},
        {"$set": updates},
    )

    await _insert_audit_log(
        action=ActionEnum.ticket_delayed,
        actor_id=user_oid,
        entity_type="ticket",
        entity_id=ticket["_id"],
        metadata={
            "is_delayed": body.is_delayed,
            "delay_reason": body.delay_reason.strip() if body.is_delayed else None,
            "title": ticket["title"],
        },
    )

    updated = await db.tickets.find_one({"_id": ticket["_id"]})
    return _serialize_ticket(updated)


# ---------------------------------------------------------------------------
# POST /tickets/{ticket_id}/comments — add a comment
# ---------------------------------------------------------------------------

class CommentCreateBody(BaseModel):
    body: str
    is_internal: bool = False


@router.post("/{ticket_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(
    ticket_id: str,
    body: CommentCreateBody,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    """
    Any authenticated user can comment. Only resolvers/admins may set
    is_internal=True; for employees the flag is silently forced to False.
    """
    ticket = await _get_ticket_or_404(ticket_id)

    role = _role_value(current_user)
    user_oid = _oid(current_user.id)

    # dept_admin may only comment on tickets in their own department
    if role == RoleEnum.dept_admin.value:
        admin_dept_oid = (
            _oid(str(current_user.department_id))
            if current_user.department_id
            else None
        )
        if not admin_dept_oid or ticket["department_id"] != admin_dept_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="dept_admin can only comment on tickets in their own department",
            )

    # resolver may only comment on tickets explicitly assigned to them
    elif role == RoleEnum.resolver.value:
        if ticket.get("assigned_resolver_id") != user_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="resolver can only comment on tickets assigned to them",
            )

    privileged_roles = {
        RoleEnum.resolver.value,
        RoleEnum.dept_admin.value,
        RoleEnum.system_admin.value,
    }
    is_internal = body.is_internal if role in privileged_roles else False

    now = datetime.now(timezone.utc)

    doc = {
        "ticket_id": ticket["_id"],
        "body": body.body,
        "is_internal": is_internal,
        "created_by": user_oid,
        "created_at": now,
    }

    result = await db.comments.insert_one(doc)

    await _insert_audit_log(
        action=ActionEnum.comment_added,
        actor_id=user_oid,
        entity_type="ticket",
        entity_id=ticket["_id"],
        metadata={"comment_id": str(result.inserted_id), "is_internal": is_internal},
    )

    comment = await db.comments.find_one({"_id": result.inserted_id})
    return _serialize_comment(comment)


# ---------------------------------------------------------------------------
# GET /tickets/{ticket_id}/comments — list comments (filtered by role)
# ---------------------------------------------------------------------------

@router.get("/{ticket_id}/comments")
async def list_comments(
    ticket_id: str,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> list[dict]:
    """
    Employees only see public (is_internal=False) comments.
    Resolvers, dept_admin, and system_admin see all comments.
    """
    ticket = await _get_ticket_or_404(ticket_id)

    role = _role_value(current_user)

    # dept_admin may only list comments on tickets in their own department
    if role == RoleEnum.dept_admin.value:
        admin_dept_oid = (
            _oid(str(current_user.department_id))
            if current_user.department_id
            else None
        )
        if not admin_dept_oid or ticket["department_id"] != admin_dept_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="dept_admin can only list comments on tickets in their own department",
            )

    privileged_roles = {
        RoleEnum.resolver.value,
        RoleEnum.dept_admin.value,
        RoleEnum.system_admin.value,
    }

    comment_filter: dict = {"ticket_id": ticket["_id"]}
    if role not in privileged_roles:
        comment_filter["is_internal"] = False

    comments = (
        await db.comments.find(comment_filter)
        .sort("created_at", 1)
        .to_list(length=None)
    )
    return [_serialize_comment(c) for c in comments]
