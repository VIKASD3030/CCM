"""User / UserRole / UserRights admin master backed by dedicated tables."""
from typing import Any
import random
from datetime import timedelta

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.ccm.auth import create_access_token
from backend.api.master._helpers import upsert_model, soft_delete_model
from backend.api.master._menu import build_user_rights
from backend.models.user import User
from backend.models.directory_user import DirectoryUser
from backend.models.user_role import UserRole
from backend.models.user_access_filter import UserAccessFilter
from backend.models.approver_role import ApproverRole
from backend.models.designation import Designation
from backend.models.department import Department
from backend.models.common_role import CommonRole

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/common", tags=["master-users"])

DIRECTORY_USER_MAP = {
    "Id": "legacy_id",
    "UserName": "user_name",
    "AdUserName": "ad_user_name",
    "EmployeeNo": "employee_no",
    "EmployeeName": "employee_name",
    "DesignationId": "designation_id",
    "DepartmentId": "department_id",
    "UserType": "user_type",
    "EmailId": "email_id",
    "MobileNo": "mobile_no",
    "ModuleGroupId": "module_group_id",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LastUpdatedBy": "last_updated_by",
    "LastUpdatedDate": "last_updated_date",
    "SecurityId": "security_id",
}

USER_ROLE_MAP = {
    "UserId": "user_id",
    "RoleId": "role_id",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}


def _normalize_list(values: Any) -> list[Any]:
    if values in (None, "", 0):
        return []
    if isinstance(values, list):
        return values
    return [values]


def _normalize_filter_value(filter_type: str, value: Any) -> str:
    if filter_type == "Project" and str(value).isdigit():
        return str(int(value))
    return str(value)


async def _refresh_users(
    db: AsyncSession,
    user_id: int = 0,
    designation_id: int = 0,
    department_id: int = 0,
) -> list[dict]:
    designation_result = await db.execute(select(Designation).where(Designation.status != "9"))
    designation_map = {row.id: row.name or "" for row in designation_result.scalars().all()}

    department_result = await db.execute(select(Department).where(Department.status != "9"))
    department_map = {row.id: row.name or "" for row in department_result.scalars().all()}

    stmt = select(DirectoryUser).where(DirectoryUser.status != "9").order_by(DirectoryUser.id)
    if user_id:
        stmt = stmt.where(DirectoryUser.id == user_id)
    if designation_id:
        stmt = stmt.where(DirectoryUser.designation_id == designation_id)
    if department_id:
        stmt = stmt.where(DirectoryUser.department_id == department_id)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    out = []
    for row in rows:
        payload = row.to_dict()
        payload["DesignationName"] = designation_map.get(row.designation_id or 0, "")
        payload["DepartmentName"] = department_map.get(row.department_id or 0, "")
        out.append(payload)
    return out


async def _refresh_access_filters(db: AsyncSession, user_role_id: int = 0, user_id: int = 0) -> list[dict]:
    stmt = select(UserAccessFilter).where(UserAccessFilter.status != "9").order_by(UserAccessFilter.id)
    if user_role_id:
        stmt = stmt.where(UserAccessFilter.user_role_id == user_role_id)
    if user_id:
        stmt = stmt.where(UserAccessFilter.user_id == user_id)
    result = await db.execute(stmt)
    return [row.to_dict() for row in result.scalars().all()]


async def _refresh_user_roles(db: AsyncSession, user_id: int = 0) -> list[dict]:
    user_result = await db.execute(select(DirectoryUser).where(DirectoryUser.status != "9"))
    user_map = {row.id: row.employee_name or row.user_name or "" for row in user_result.scalars().all()}

    role_result = await db.execute(select(CommonRole).where(CommonRole.status != "9"))
    role_map = {row.id: row.name or "" for row in role_result.scalars().all()}

    filter_result = await db.execute(select(UserAccessFilter).where(UserAccessFilter.status != "9"))
    filters = filter_result.scalars().all()
    filter_map: dict[int, dict[str, list[Any]]] = {}
    for item in filters:
        filter_map.setdefault(item.user_role_id or 0, {"BusinessUnit": [], "BusinessLine": [], "Project": []})
        if item.filter_type == "Project":
            value: Any = int(item.filter_value) if str(item.filter_value or "").isdigit() else item.filter_value
        else:
            value = item.filter_value
        filter_map[item.user_role_id or 0].setdefault(item.filter_type or "", []).append(value)

    stmt = select(UserRole).where(UserRole.status != "9").order_by(UserRole.id)
    if user_id:
        stmt = stmt.where(UserRole.user_id == user_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    out = []
    for row in rows:
        payload = row.to_dict()
        payload["UserName"] = user_map.get(row.user_id or 0, "")
        payload["RoleName"] = role_map.get(row.role_id or 0, "")
        agg = filter_map.get(row.id, {})
        payload["BusinessUnitIds"] = agg.get("BusinessUnit", [])
        payload["BusinessLineIds"] = agg.get("BusinessLine", [])
        payload["ProjectIds"] = agg.get("Project", [])
        out.append(payload)
    return out


async def _refresh_approver_roles(db: AsyncSession, user_id: int = 0) -> list[dict]:
    stmt = select(ApproverRole).where(ApproverRole.status != "9").order_by(ApproverRole.id)
    if user_id:
        stmt = stmt.where(ApproverRole.user_id == user_id)
    result = await db.execute(stmt)
    return [row.to_dict() for row in result.scalars().all()]


async def _replace_access_filters(db: AsyncSession, user_role: UserRole, body: dict[str, Any]) -> None:
    await db.execute(sa_delete(UserAccessFilter).where(UserAccessFilter.user_role_id == user_role.id))
    await db.flush()

    filter_rows: list[tuple[str, Any]] = []
    for value in _normalize_list(body.get("BusinessUnitIds")):
        filter_rows.append(("BusinessUnit", value))
    for value in _normalize_list(body.get("BusinessLineIds")):
        filter_rows.append(("BusinessLine", value))
    for value in _normalize_list(body.get("ProjectIds")):
        filter_rows.append(("Project", value))

    for filter_type, value in filter_rows:
        if value in (None, ""):
            continue
        db.add(UserAccessFilter(
            user_role_id=user_role.id,
            user_id=user_role.user_id,
            filter_type=filter_type,
            filter_value=_normalize_filter_value(filter_type, value),
            status=str(body.get("Status", "1")) or "1",
            created_by=body.get("CreatedBy"),
            created_date=body.get("CreatedDate"),
            locked_by=body.get("LockedBy"),
            locked_date=body.get("LockedDate"),
            security_id=body.get("SecurityId"),
        ))
    await db.flush()


@router.post("/getUsers")
async def get_users(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    designation_id = body.get("designationId") or body.get("DesignationId") or 0
    department_id = body.get("departmentId") or body.get("DepartmentId") or 0
    try:
        designation_id = int(designation_id)
    except (TypeError, ValueError):
        designation_id = 0
    try:
        department_id = int(department_id)
    except (TypeError, ValueError):
        department_id = 0
    return await _refresh_users(db, designation_id=designation_id, department_id=department_id)


@router.post("/getUserDetails")
async def get_user_details(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db)):
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

    user_id = body.get("UserId") or 0
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        user_id = 0
    return await _refresh_users(db, user_id=user_id)


@router.post("/saveUserDetails")
async def save_user(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    user_body = body.get("User", body)
    await upsert_model(db, DirectoryUser, user_body, "UserId", DIRECTORY_USER_MAP)
    return await _refresh_users(db)


@router.post("/deleteUserDetails")
async def delete_user(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await soft_delete_model(db, DirectoryUser, body.get("UserId"))
    return await _refresh_users(db)


@router.post("/getUserRights")
async def get_user_rights(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return build_user_rights()


@router.get("/getUserRights")
async def get_user_rights_query(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return build_user_rights()


@router.post("/GetUserAccessFilters")
async def get_user_access_filters(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    user_role_id = body.get("UserRoleId") or 0
    user_id = body.get("UserId") or 0
    try:
        user_role_id = int(user_role_id)
    except (TypeError, ValueError):
        user_role_id = 0
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        user_id = 0
    return await _refresh_access_filters(db, user_role_id, user_id)


@router.get("/getUserRoles")
async def get_user_roles(userId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _refresh_user_roles(db, userId)


async def _save_user_role_impl(body: dict[str, Any], db: AsyncSession):
    obj = await upsert_model(db, UserRole, body, "UserRoleId", USER_ROLE_MAP)
    await _replace_access_filters(db, obj, body)
    return await _refresh_user_roles(db)


@router.post("/saveUserRoles")
async def save_user_roles(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _save_user_role_impl(body, db)


@router.post("/saveUserRoleDetails")
async def save_user_role_details(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _save_user_role_impl(body, db)


async def _delete_user_role_impl(body: dict[str, Any], db: AsyncSession):
    user_role_id = body.get("UserRoleId") or 0
    await soft_delete_model(db, UserRole, user_role_id)
    await db.execute(sa_delete(UserAccessFilter).where(UserAccessFilter.user_role_id == user_role_id))
    await db.flush()
    return await _refresh_user_roles(db)


@router.post("/deleteUserRoles")
async def delete_user_roles(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _delete_user_role_impl(body, db)


@router.post("/deleteUserRoleDetails")
async def delete_user_role_details(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _delete_user_role_impl(body, db)


@router.get("/getApproverRoles")
async def get_approver_roles(userId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _refresh_approver_roles(db, userId)


@router.post("/updateTourStatus")
async def update_tour_status(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return {"status": 1}
