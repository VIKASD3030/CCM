"""User / UserRole / UserRights admin master — MasterRecord-backed.

Intentionally decoupled from the core CCM `users` auth table (managed via
auth + cli.py). These are the admin sub-app's editable directory rows so the
MASTER/ADMIN screens are self-contained and removable.
"""
from typing import Any
import random
from datetime import timedelta

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.ccm.auth import create_access_token
from backend.api.master._helpers import mr_list, mr_save, mr_delete
from backend.api.master._menu import build_user_rights
from backend.models.user import User

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/common", tags=["master-users"])
USR, USR_ID = "user", "UserId"
UROLE, UROLE_ID = "user_role", "UserRoleId"


@router.post("/getUsers")
async def get_users(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_list(db, USR, USR_ID)


@router.post("/getUserDetails")
async def get_user_details(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db)):
    # External / OTP login path: the login page calls this (unauthenticated, no
    # token yet) with { UserName, UserType: 'External' }. Resolve the real CCM
    # user by email, mint a real JWT as TokenValue, and hand back an OTP that the
    # frontend verifies client-side. Any other call (admin User Management, which
    # passes UserId) returns the master directory rows.
    username = body.get("UserName")
    if username:
        result = await db.execute(
            select(User).where(func.lower(User.email) == username.strip().lower(), User.is_active.is_(True))
        )
        user = result.scalar_one_or_none()
        if user is None:
            return []
        otp = f"{random.randint(0, 999999):06d}"
        token = create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role},
            expires_delta=timedelta(hours=8),
        )
        logger.info("otp_login.generated", email=user.email, otp=otp)
        return [{
            "UserId": str(user.id),
            "EmployeeName": user.name or user.email.split("@")[0],
            "EmailId": user.email,
            "OTP": otp,
            "TokenValue": token,
            "TourStatus": "1",
        }]

    filters = {USR_ID: body.get("UserId")} if body.get("UserId") else None
    return await mr_list(db, USR, USR_ID, filters)


@router.post("/saveUserDetails")
async def save_user(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    # Frontend sends { User: {...}, EmailModel: {...} }; persist the User part.
    user_body = body.get("User", body)
    return await mr_save(db, USR, USR_ID, user_body)


@router.post("/deleteUserDetails")
async def delete_user(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, USR, USR_ID, body)


@router.post("/getUserRights")
async def get_user_rights(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    # Drives the sidebar menu tree. Frontend expects { parentData, childData }.
    return build_user_rights()


@router.get("/getUserRights")
async def get_user_rights_query(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return build_user_rights()


@router.post("/GetUserAccessFilters")
async def get_user_access_filters(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_list(db, "user_access_filter", "FilterId")


@router.get("/getUserRoles")
async def get_user_roles(userId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {USR_ID: userId} if userId else None
    return await mr_list(db, UROLE, UROLE_ID, filters)


@router.post("/saveUserRoles")
async def save_user_roles(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, UROLE, UROLE_ID, body)


@router.post("/deleteUserRoles")
async def delete_user_roles(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, UROLE, UROLE_ID, body)


@router.get("/getApproverRoles")
async def get_approver_roles(userId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_list(db, "approver_role", "RoleId")


@router.post("/updateTourStatus")
async def update_tour_status(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return {"status": 1}
