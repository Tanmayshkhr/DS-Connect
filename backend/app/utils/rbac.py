"""RBAC dependencies"""

from typing import Annotated

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from app.database import db
from app.models.user import RoleEnum, UserInDB
from app.utils.jwt import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/verify-otp")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> UserInDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
    except JWTError as exc:
        raise credentials_exception from exc

    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        raise credentials_exception

    lookup_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    user = await db.users.find_one({"_id": lookup_id})
    if not user:
        raise credentials_exception

    if user.get("is_active") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated. Contact your system admin.",
        )

    return UserInDB.model_validate(user)


def require_roles(*roles: RoleEnum | str):
    allowed_roles = {
        role.value if isinstance(role, RoleEnum) else role for role in roles
    }

    async def dependency(
        current_user: Annotated[UserInDB, Depends(get_current_user)],
    ) -> UserInDB:
        user_role = (
            current_user.role.value
            if isinstance(current_user.role, RoleEnum)
            else current_user.role
        )
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return dependency


require_employee = require_roles(RoleEnum.employee)
require_resolver = require_roles(RoleEnum.resolver)
require_dept_admin = require_roles(RoleEnum.dept_admin)
require_system_admin = require_roles(RoleEnum.system_admin)
