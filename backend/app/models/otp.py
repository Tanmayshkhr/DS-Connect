from datetime import datetime

from pydantic import BaseModel, EmailStr


class OTPInDB(BaseModel):
    email: EmailStr
    otp_hash: str
    created_at: datetime
    expires_at: datetime
