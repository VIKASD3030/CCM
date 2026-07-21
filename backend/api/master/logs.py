"""User logs + error logs (admin) — MasterRecord-backed."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import mr_list, mr_save
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-logs"])
LOG, LOG_ID = "user_log", "LogId"
ERR, ERR_ID = "error_log", "ErrorId"


@router.post("/getUserLogs")
async def get_user_logs(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_list(db, LOG, LOG_ID)


@router.post("/saveUserLogDetails")
async def save_user_log(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, LOG, LOG_ID, body)


@router.post("/getErrorLogs")
async def get_error_logs(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_list(db, ERR, ERR_ID)
