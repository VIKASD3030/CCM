"""Monthly Breakup master + estimation months — MasterRecord-backed."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import mr_list, mr_save, mr_delete
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-monthly-breakup"])
ENTITY, ID = "monthly_breakup", "MonthlyBreakUpMasterId"


@router.post("/getMonthlyBreakUpDetailsData")
async def get_monthly_breakup(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_list(db, ENTITY, ID)


@router.post("/saveMonthlyBreakUpDetailsData")
async def save_monthly_breakup(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, ENTITY, ID, body)


@router.post("/deleteMontlyBreakUpDetailsData")
async def delete_monthly_breakup(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, ENTITY, ID, body)


@router.get("/getEstimationMonths")
async def get_estimation_months(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_list(db, "estimation_month", "MonthId")
