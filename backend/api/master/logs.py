"""User logs + error logs backed by dedicated tables."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import upsert_model
from backend.models.user import User
from backend.models.user_log import UserLog
from backend.models.error_log import ErrorLog

router = APIRouter(prefix="/common", tags=["master-logs"])

USER_LOG_MAP = {
    "UserId": "user_id",
    "IPAddress": "ip_address",
    "MACAddress": "mac_address",
    "LogInStatus": "log_in_status",
    "LoginDate": "login_date",
    "LogOutDate": "log_out_date",
    "TokenValue": "token_value",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}


async def _user_name_map(db: AsyncSession) -> dict[str, str]:
    result = await db.execute(select(User).where(User.is_active.is_(True)))
    out: dict[str, str] = {}
    for row in result.scalars().all():
        label = row.name or row.email.split("@")[0]
        out[str(row.id)] = label
    return out


async def _refresh_user_logs(db: AsyncSession) -> list[dict]:
    name_map = await _user_name_map(db)
    result = await db.execute(select(UserLog).where(UserLog.status != "9").order_by(UserLog.id))
    rows = result.scalars().all()
    out = []
    for row in rows:
        payload = row.to_dict()
        payload["UserName"] = name_map.get(row.user_id or "", "")
        out.append(payload)
    return out


async def _refresh_error_logs(db: AsyncSession) -> list[dict]:
    name_map = await _user_name_map(db)
    result = await db.execute(select(ErrorLog).where(ErrorLog.status != "9").order_by(ErrorLog.id))
    rows = result.scalars().all()
    out = []
    for row in rows:
        payload = row.to_dict()
        if not payload.get("UserName"):
            payload["UserName"] = name_map.get(row.user_id or "", "")
        out.append(payload)
    return out


@router.post("/getUserLogs")
async def get_user_logs(
    body: dict[str, Any] = {},
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _refresh_user_logs(db)


@router.post("/saveUserLogDetails")
async def save_user_log(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    payload = dict(body or {})
    payload["LogId"] = payload.get("LogId") or payload.get("UserLogId") or 0
    await upsert_model(db, UserLog, payload, "LogId", USER_LOG_MAP)
    return await _refresh_user_logs(db)


@router.post("/getErrorLogs")
async def get_error_logs(
    body: dict[str, Any] = {},
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _refresh_error_logs(db)
