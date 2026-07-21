"""Activity / ActivityGroup / SubActivity / WorkPackage master — MasterRecord-backed."""
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import mr_list, mr_save, mr_save_bulk, mr_delete
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-activities"])

GROUP, GROUP_ID = "activity_group", "ActivityGroupId"
ACT, ACT_ID = "activity", "ActivityId"
WP, WP_ID = "work_package", "WorkPackageId"


# ─── Activity Groups ────────────────────────────────────────────────────

@router.get("/getActivityGroup")
async def get_activity_groups(projectId: int = Query(0), contractId: int = Query(0),
                              db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {}
    if projectId:
        filters["ProjectMasterId"] = projectId
    if contractId:
        filters["ContractId"] = contractId
    return await mr_list(db, GROUP, GROUP_ID, filters or None)


@router.post("/saveActivityGroupDetails")
async def save_activity_group(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, GROUP, GROUP_ID, body)


@router.post("/deleteActivityGroupDetails")
async def delete_activity_group(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, GROUP, GROUP_ID, body)


# ─── Activities ─────────────────────────────────────────────────────────

@router.get("/getActivity")
async def get_activities(activityGroupId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {"ActivityGroupId": activityGroupId} if activityGroupId else None
    return await mr_list(db, ACT, ACT_ID, filters)


@router.get("/getSubActivity")
async def get_sub_activities(activityGroupId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {"ActivityGroupId": activityGroupId} if activityGroupId else None
    rows = await mr_list(db, ACT, ACT_ID, filters)
    return [r for r in rows if r.get("IsSubActivity") in (1, "1", True)]


@router.post("/saveActivityDetails")
async def save_activity(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, ACT, ACT_ID, body)


@router.post("/saveActivityBulkDetails")
async def save_activity_bulk(body: Any, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = body if isinstance(body, list) else body.get("Activities", body.get("data", []))
    return await mr_save_bulk(db, ACT, ACT_ID, rows)


@router.post("/deleteActivityDetails")
async def delete_activity(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, ACT, ACT_ID, body)


# ─── Work Packages ──────────────────────────────────────────────────────

@router.get("/getWorkPackage")
async def get_work_packages(projectId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {"ProjectMasterId": projectId} if projectId else None
    return await mr_list(db, WP, WP_ID, filters)
