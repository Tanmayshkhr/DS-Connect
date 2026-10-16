from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.database import db
from app.models.audit_log import ActionEnum
from app.models.user import TokenResponse
from app.utils.email import send_otp_email
from app.utils.jwt import create_access_token, create_refresh_token
from app.utils.otp import generate_otp, hash_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["auth"])

OTP_EXPIRE_MINUTES = 5
RATE_LIMIT_SECONDS = 60


class RequestOTPBody(BaseModel):
    email: EmailStr


class VerifyOTPBody(BaseModel):
    email: EmailStr
    otp: str


@router.post("/request-otp")
async def request_otp(body: RequestOTPBody) -> dict[str, str]:
    email = body.email.lower()
    now = datetime.now(timezone.utc)

    existing_otp = await db.otps.find_one({"email": email})
    if existing_otp:
        created_at = existing_otp["created_at"]
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        age_seconds = (now - created_at).total_seconds()
        if age_seconds < RATE_LIMIT_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait before requesting another OTP",
            )

    raw_otp = generate_otp()
    otp_hash = hash_otp(raw_otp)
    expires_at = now + timedelta(minutes=OTP_EXPIRE_MINUTES)

    await db.otps.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "otp_hash": otp_hash,
                "created_at": now,
                "expires_at": expires_at,
            }
        },
        upsert=True,
    )

    try:
        await send_otp_email(email, raw_otp)
    except Exception as exc:
        await db.otps.delete_one({"email": email})
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send OTP email: {str(exc)}",
        ) from exc

    return {"message": "OTP sent"}


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp_endpoint(body: VerifyOTPBody) -> TokenResponse:
    email = body.email.lower()
    now = datetime.now(timezone.utc)

    otp_doc = await db.otps.find_one({"email": email})
    if not otp_doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP",
        )

    expires_at = otp_doc["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        await db.otps.delete_one({"email": email})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired",
        )

    if not verify_otp(body.otp, otp_doc["otp_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP",
        )

    await db.otps.delete_one({"email": email})

    user = await db.users.find_one({"email": email})
    if user:
        if user.get("is_active") is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account deactivated. Contact your system admin.",
            )
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": now}},
        )
        user = await db.users.find_one({"_id": user["_id"]})
    else:
        insert_result = await db.users.insert_one(
            {
                "email": email,
                "role": "employee",
                "created_at": now,
                "last_login": now,
            }
        )
        user = await db.users.find_one({"_id": insert_result.inserted_id})

        # Notify system_admin that a new user needs role + department assignment.
        # actor_id == entity_id == the new user's own _id (no other actor exists).
        await db.audit_logs.insert_one(
            {
                "action": ActionEnum.new_user_pending_setup.value,
                "actor_id": insert_result.inserted_id,
                "entity_type": "user",
                "entity_id": insert_result.inserted_id,
                "metadata": {
                    "user_id": str(insert_result.inserted_id),
                    "email": email,
                    "created_at": now.isoformat(),
                },
                "created_at": now,
            }
        )

    user_id = str(user["_id"])
    role = user.get("role", "employee")
    department_id = user.get("department_id")
    user_response = {
        "id": user_id,
        "email": user["email"],
        "name": user.get("name"),
        "role": role,
        "department_id": str(department_id) if department_id else None,
    }

    token_payload = {
        "sub": user_id,
        "user_id": user_id,
        "email": email,
        "role": role,
    }
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_response,
    )
