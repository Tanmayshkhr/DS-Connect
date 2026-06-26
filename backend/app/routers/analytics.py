"""Analytics router"""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import db
from app.models.ticket import StatusEnum
from app.models.user import RoleEnum, UserInDB
from app.utils.rbac import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _role_value(user: UserInDB) -> str:
    return (
        user.role.value if isinstance(user.role, RoleEnum) else str(user.role)
    )


def _oid(value: str) -> ObjectId:
    if ObjectId.is_valid(value):
        return ObjectId(value)
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Invalid ObjectId: {value}",
    )


def _require_analytics_role(current_user: UserInDB) -> str:
    """Return role string if allowed, else raise 403."""
    role = _role_value(current_user)
    if role not in {RoleEnum.dept_admin.value, RoleEnum.system_admin.value}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to dept_admin and system_admin",
        )
    return role


def _dept_filter(role: str, user: UserInDB) -> dict:
    """
    Build a MongoDB match clause that scopes results to the user's
    department for dept_admin, or nothing for system_admin.
    """
    if role == RoleEnum.dept_admin.value and user.department_id:
        return {"department_id": _oid(str(user.department_id))}
    return {}


# ---------------------------------------------------------------------------
# GET /analytics/summary
# ---------------------------------------------------------------------------

@router.get("/summary")
async def get_summary(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    """Return ticket, user, and published FAQ summary counts."""
    role = _require_analytics_role(current_user)
    match = _dept_filter(role, current_user)

    pipeline: list = []
    if match:
        pipeline.append({"$match": match})
    pipeline.append(
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
            }
        }
    )

    rows = await db.tickets.aggregate(pipeline).to_list(length=None)
    status_counts: dict[str, int] = {r["_id"]: r["count"] for r in rows}
    total_users = await db.users.count_documents({})
    total_faqs_published = await db.faqs.count_documents(
        {"status": "published"}
    )

    return {
        "total_tickets": sum(status_counts.values()),
        "open_tickets": status_counts.get(StatusEnum.open.value, 0),
        "in_progress_tickets": status_counts.get(
            StatusEnum.in_progress.value, 0
        ),
        "resolved_tickets": status_counts.get(StatusEnum.resolved.value, 0),
        "closed_tickets": status_counts.get(StatusEnum.closed.value, 0),
        "total_users": total_users,
        "total_faqs_published": total_faqs_published,
    }


# ---------------------------------------------------------------------------
# GET /analytics/by-category
# ---------------------------------------------------------------------------

@router.get("/by-category")
async def get_by_category(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> list[dict]:
    """Ticket counts grouped by category."""
    role = _require_analytics_role(current_user)
    match = _dept_filter(role, current_user)

    pipeline: list = []
    if match:
        pipeline.append({"$match": match})
    pipeline.extend(
        [
            {
                "$group": {
                    "_id": "$category",
                    "value": {"$sum": 1},
                }
            },
            {"$sort": {"value": -1}},
        ]
    )

    rows = await db.tickets.aggregate(pipeline).to_list(length=None)
    return [{"name": r["_id"], "value": r["value"]} for r in rows]


# ---------------------------------------------------------------------------
# GET /analytics/by-priority
# ---------------------------------------------------------------------------

@router.get("/by-priority")
async def get_by_priority(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> list[dict]:
    """Ticket counts grouped by priority."""
    role = _require_analytics_role(current_user)
    match = _dept_filter(role, current_user)

    pipeline: list = []
    if match:
        pipeline.append({"$match": match})
    pipeline.append(
        {
            "$group": {
                "_id": "$priority",
                "value": {"$sum": 1},
            }
        }
    )

    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    rows = await db.tickets.aggregate(pipeline).to_list(length=None)
    rows.sort(key=lambda r: priority_order.get(r["_id"], 99))

    return [{"name": r["_id"], "value": r["value"]} for r in rows]


# ---------------------------------------------------------------------------
# GET /analytics/by-department  (system_admin only)
# ---------------------------------------------------------------------------

@router.get("/by-department")
async def get_by_department(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> list[dict]:
    """Ticket counts per department. system_admin only."""
    role = _require_analytics_role(current_user)
    if role != RoleEnum.system_admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only system_admin can view cross-department analytics",
        )

    pipeline = [
        {
            "$group": {
                "_id": "$department_id",
                "tickets": {"$sum": 1},
            }
        },
        {
            "$lookup": {
                "from": "departments",
                "localField": "_id",
                "foreignField": "_id",
                "as": "dept_info",
            }
        },
        {"$sort": {"tickets": -1}},
    ]

    rows = await db.tickets.aggregate(pipeline).to_list(length=None)
    result = []
    for r in rows:
        dept = r["dept_info"][0] if r["dept_info"] else {}
        result.append(
            {
                "name": dept.get("name") or "",
                "tickets": r["tickets"],
            }
        )
    return result


# ---------------------------------------------------------------------------
# GET /analytics/resolver-performance
# ---------------------------------------------------------------------------

@router.get("/resolver-performance")
async def get_resolver_performance(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> list[dict]:
    """Per-resolver resolved and in-progress counts."""
    role = _require_analytics_role(current_user)
    match = _dept_filter(role, current_user)

    base_match: dict = {"assigned_resolver_id": {"$ne": None}}
    base_match.update(match)

    pipeline = [
        {"$match": base_match},
        {
            "$group": {
                "_id": "$assigned_resolver_id",
                "resolved": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$status", StatusEnum.resolved.value]},
                            1,
                            0,
                        ]
                    }
                },
                "in_progress": {
                    "$sum": {
                        "$cond": [
                            {
                                "$eq": [
                                    "$status",
                                    StatusEnum.in_progress.value,
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
            }
        },
        {
            "$lookup": {
                "from": "users",
                "localField": "_id",
                "foreignField": "_id",
                "as": "resolver_info",
            }
        },
        {"$sort": {"resolved": -1}},
    ]

    rows = await db.tickets.aggregate(pipeline).to_list(length=None)
    result = []
    for r in rows:
        resolver = r["resolver_info"][0] if r["resolver_info"] else {}
        result.append(
            {
                "name": resolver.get("email") or "",
                "resolved": r["resolved"],
                "in_progress": r["in_progress"],
            }
        )
    return result


# ---------------------------------------------------------------------------
# GET /analytics/trend
# ---------------------------------------------------------------------------

@router.get("/trend")
async def get_trend(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
    days: int = 7,
) -> list[dict]:
    """Tickets created and resolved per day for the last N days."""
    role = _require_analytics_role(current_user)
    match = _dept_filter(role, current_user)

    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days - 1)).date()
    since = datetime.combine(start_date, datetime.min.time(), timezone.utc)

    created_match: dict = {"created_at": {"$gte": since}}
    created_match.update(match)

    created_pipeline = [
        {"$match": created_match},
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$created_at"},
                    "month": {"$month": "$created_at"},
                    "day": {"$dayOfMonth": "$created_at"},
                },
                "created": {"$sum": 1},
            }
        },
    ]

    resolved_match: dict = {"resolved_at": {"$gte": since}}
    resolved_match.update(match)

    resolved_pipeline = [
        {"$match": resolved_match},
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$resolved_at"},
                    "month": {"$month": "$resolved_at"},
                    "day": {"$dayOfMonth": "$resolved_at"},
                },
                "resolved": {"$sum": 1},
            }
        },
    ]

    created_rows = await db.tickets.aggregate(created_pipeline).to_list(
        length=None
    )
    resolved_rows = await db.tickets.aggregate(resolved_pipeline).to_list(
        length=None
    )

    created_by_date: dict[str, int] = {}
    for r in created_rows:
        d = r["_id"]
        key = f"{d['year']:04d}-{d['month']:02d}-{d['day']:02d}"
        created_by_date[key] = r["created"]

    resolved_by_date: dict[str, int] = {}
    for r in resolved_rows:
        d = r["_id"]
        key = f"{d['year']:04d}-{d['month']:02d}-{d['day']:02d}"
        resolved_by_date[key] = r["resolved"]

    result = []
    for i in range(days):
        day = start_date + timedelta(days=i)
        key = day.isoformat()
        result.append(
            {
                "date": key,
                "created": created_by_date.get(key, 0),
                "resolved": resolved_by_date.get(key, 0),
            }
        )

    return result
