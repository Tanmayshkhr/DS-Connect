"""FAQs router"""

from datetime import datetime, timezone
from typing import Annotated, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.database import db
from app.models.audit_log import ActionEnum
from app.models.faq import FAQCreate, FAQStatusEnum
from app.models.user import RoleEnum, UserInDB
from app.utils.rbac import get_current_user

router = APIRouter(prefix="/faqs", tags=["faqs"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _oid(value: str) -> ObjectId:
    """Convert string to ObjectId, raising 422 on invalid value."""
    if ObjectId.is_valid(value):
        return ObjectId(value)
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Invalid ObjectId: {value}",
    )


def _role_value(user: UserInDB) -> str:
    return (
        user.role.value if isinstance(user.role, RoleEnum) else str(user.role)
    )


def _serialize_faq(f: dict) -> dict:
    return {
        "id": str(f["_id"]),
        "question": f["question"],
        "answer": f["answer"],
        "department_id": str(f["department_id"]),
        "created_by": str(f["created_by"]),
        "reviewed_by": str(f["reviewed_by"]) if f.get("reviewed_by") else None,
        "approved_by": str(f["approved_by"]) if f.get("approved_by") else None,
        "rejected_by": str(f["rejected_by"]) if f.get("rejected_by") else None,
        "status": f["status"],
        "keywords": f.get("keywords", []),
        "review_notes": f.get("review_notes"),
        "rejection_reason": f.get("rejection_reason"),
        "created_at": f.get("created_at"),
        "updated_at": f.get("updated_at"),
        "reviewed_at": f.get("reviewed_at"),
        "approved_at": f.get("approved_at"),
        "rejected_at": f.get("rejected_at"),
    }


async def _insert_audit_log(
    action: ActionEnum,
    actor_id: ObjectId,
    entity_id: ObjectId,
    metadata: dict,
) -> None:
    await db.audit_logs.insert_one(
        {
            "action": action.value,
            "actor_id": actor_id,
            "entity_type": "faq",
            "entity_id": entity_id,
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc),
        }
    )


async def _get_faq_or_404(faq_id: str) -> dict:
    faq = await db.faqs.find_one({"_id": _oid(faq_id)})
    if not faq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FAQ not found",
        )
    return faq


# ---------------------------------------------------------------------------
# POST /faqs/ — resolver suggests a new FAQ
# ---------------------------------------------------------------------------

@router.post("/", status_code=status.HTTP_201_CREATED)
async def suggest_faq(
    body: FAQCreate,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    """Resolver only — suggest a new FAQ (status=suggested)."""
    role = _role_value(current_user)
    if role != RoleEnum.resolver.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only resolvers can suggest FAQs",
        )

    now = datetime.now(timezone.utc)
    user_oid = _oid(current_user.id)
    dept_oid = _oid(str(body.department_id))

    doc = {
        "question": body.question,
        "answer": body.answer,
        "department_id": dept_oid,
        "created_by": user_oid,
        "reviewed_by": None,
        "approved_by": None,
        "rejected_by": None,
        "status": FAQStatusEnum.suggested.value,
        "keywords": body.keywords,
        "review_notes": None,
        "rejection_reason": None,
        "created_at": now,
        "updated_at": None,
        "reviewed_at": None,
        "approved_at": None,
        "rejected_at": None,
    }

    result = await db.faqs.insert_one(doc)

    await _insert_audit_log(
        action=ActionEnum.faq_suggested,
        actor_id=user_oid,
        entity_id=result.inserted_id,
        metadata={
            "question": body.question,
            "department_id": str(dept_oid),
        },
    )

    faq = await db.faqs.find_one({"_id": result.inserted_id})
    return _serialize_faq(faq)


# ---------------------------------------------------------------------------
# GET /faqs/ — list FAQs with role-based visibility
# ---------------------------------------------------------------------------

@router.get("/")
async def list_faqs(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> list[dict]:
    """
    Role-based FAQ visibility:
    - employee      → published FAQs only (all departments)
    - resolver      → suggested + published FAQs in their department
    - dept_admin    → suggested + reviewed FAQs in their department
    - system_admin  → all FAQs across all departments and statuses

    All four actor fields (created_by, reviewed_by, approved_by, rejected_by)
    are resolved to human-readable name/email via $lookup so the frontend never
    shows raw ObjectId strings.
    """
    role = _role_value(current_user)

    dept_oid: Optional[ObjectId] = (
        _oid(str(current_user.department_id))
        if current_user.department_id
        else None
    )

    if role == RoleEnum.employee.value:
        match_stage = {"status": FAQStatusEnum.published.value}

    elif role == RoleEnum.resolver.value:
        match_stage = {
            "status": {"$in": [
                FAQStatusEnum.suggested.value,
                FAQStatusEnum.published.value,
            ]},
        }
        if dept_oid:
            match_stage["department_id"] = dept_oid

    elif role == RoleEnum.dept_admin.value:
        match_stage = {
            "status": {"$in": [
                FAQStatusEnum.suggested.value,
                FAQStatusEnum.reviewed.value,
            ]},
        }
        if dept_oid:
            match_stage["department_id"] = dept_oid

    else:
        # system_admin — no filter
        match_stage = {}

    def _user_lookup(from_field: str, alias: str) -> list[dict]:
        """Build a $lookup + $unwind pair for a single actor field."""
        return [
            {
                "$lookup": {
                    "from": "users",
                    "localField": from_field,
                    "foreignField": "_id",
                    "as": alias,
                }
            },
            {
                "$unwind": {
                    "path": f"${alias}",
                    "preserveNullAndEmptyArrays": True,
                }
            },
        ]

    pipeline: list[dict] = [
        {"$match": match_stage},
        {"$sort": {"created_at": -1}},
        *_user_lookup("created_by",  "_created_by_user"),
        *_user_lookup("reviewed_by", "_reviewed_by_user"),
        *_user_lookup("approved_by", "_approved_by_user"),
        *_user_lookup("rejected_by", "_rejected_by_user"),
    ]

    faqs = await db.faqs.aggregate(pipeline).to_list(length=None)
    return [_serialize_faq(f) for f in faqs]


# ---------------------------------------------------------------------------
# PATCH /faqs/{faq_id}/review — dept_admin reviews and adds notes
# ---------------------------------------------------------------------------

class ReviewBody(BaseModel):
    notes: Optional[str] = None


@router.patch("/{faq_id}/review")
async def review_faq(
    faq_id: str,
    body: ReviewBody,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    """dept_admin only — mark FAQ as reviewed, optionally add notes."""
    role = _role_value(current_user)
    if role != RoleEnum.dept_admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only dept_admin can review FAQs",
        )

    faq = await _get_faq_or_404(faq_id)

    # dept_admin may only review FAQs belonging to their own department
    admin_dept_oid = (
        _oid(str(current_user.department_id))
        if current_user.department_id
        else None
    )
    if not admin_dept_oid or faq["department_id"] != admin_dept_oid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="dept_admin can only review FAQs in their own department",
        )

    if faq["status"] != FAQStatusEnum.suggested.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot review an FAQ with status '{faq['status']}' — must be 'suggested'",
        )

    now = datetime.now(timezone.utc)
    user_oid = _oid(current_user.id)

    await db.faqs.update_one(
        {"_id": faq["_id"]},
        {
            "$set": {
                "status": FAQStatusEnum.reviewed.value,
                "reviewed_by": user_oid,
                "review_notes": body.notes,
                "reviewed_at": now,
                "updated_at": now,
            }
        },
    )

    await _insert_audit_log(
        action=ActionEnum.faq_reviewed,
        actor_id=user_oid,
        entity_id=faq["_id"],
        metadata={"notes": body.notes, "previous_status": faq["status"]},
    )

    updated = await db.faqs.find_one({"_id": faq["_id"]})
    return _serialize_faq(updated)


# ---------------------------------------------------------------------------
# PATCH /faqs/{faq_id}/approve — system_admin publishes the FAQ
# ---------------------------------------------------------------------------

@router.patch("/{faq_id}/approve")
async def approve_faq(
    faq_id: str,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    """system_admin only — set status=published and record approved_by."""
    role = _role_value(current_user)
    if role != RoleEnum.system_admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only system_admin can approve FAQs",
        )

    faq = await _get_faq_or_404(faq_id)

    approvable_statuses = {
        FAQStatusEnum.suggested.value,
        FAQStatusEnum.reviewed.value,
    }
    if faq["status"] not in approvable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve an FAQ with status '{faq['status']}' — must be 'suggested' or 'reviewed'",
        )

    now = datetime.now(timezone.utc)
    user_oid = _oid(current_user.id)

    await db.faqs.update_one(
        {"_id": faq["_id"]},
        {
            "$set": {
                "status": FAQStatusEnum.published.value,
                "approved_by": user_oid,
                "approved_at": now,
                "updated_at": now,
            }
        },
    )

    await _insert_audit_log(
        action=ActionEnum.faq_approved,
        actor_id=user_oid,
        entity_id=faq["_id"],
        metadata={"previous_status": faq["status"]},
    )

    updated = await db.faqs.find_one({"_id": faq["_id"]})
    return _serialize_faq(updated)


# ---------------------------------------------------------------------------
# PATCH /faqs/{faq_id}/reject — dept_admin or system_admin rejects the FAQ
# ---------------------------------------------------------------------------

class RejectBody(BaseModel):
    reason: Optional[str] = None


@router.patch("/{faq_id}/reject")
async def reject_faq(
    faq_id: str,
    body: RejectBody,
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> dict:
    """dept_admin or system_admin — set status=rejected with an optional reason."""
    role = _role_value(current_user)
    allowed = {RoleEnum.dept_admin.value, RoleEnum.system_admin.value}
    if role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only dept_admin or system_admin can reject FAQs",
        )

    faq = await _get_faq_or_404(faq_id)

    # dept_admin may only reject FAQs in their own department
    if role == RoleEnum.dept_admin.value:
        admin_dept_oid = (
            _oid(str(current_user.department_id))
            if current_user.department_id
            else None
        )
        if not admin_dept_oid or faq["department_id"] != admin_dept_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="dept_admin can only reject FAQs in their own department",
            )

    # Cannot reject an already-published or already-rejected FAQ
    non_rejectable = {
        FAQStatusEnum.published.value,
        FAQStatusEnum.rejected.value,
    }
    if faq["status"] in non_rejectable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject an FAQ with status '{faq['status']}'",
        )

    now = datetime.now(timezone.utc)
    user_oid = _oid(current_user.id)

    await db.faqs.update_one(
        {"_id": faq["_id"]},
        {
            "$set": {
                "status": FAQStatusEnum.rejected.value,
                "rejected_by": user_oid,
                "rejection_reason": body.reason,
                "rejected_at": now,
                "updated_at": now,
            }
        },
    )

    await _insert_audit_log(
        action=ActionEnum.faq_rejected,
        actor_id=user_oid,
        entity_id=faq["_id"],
        metadata={"reason": body.reason, "previous_status": faq["status"]},
    )

    updated = await db.faqs.find_one({"_id": faq["_id"]})
    return _serialize_faq(updated)
