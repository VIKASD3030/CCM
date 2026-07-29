"""Activity / ActivityGroup / WorkPackage master backed by dedicated tables."""
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import upsert_model
from backend.models.user import User
from backend.models.activity_group import ActivityGroup
from backend.models.activity import Activity
from backend.models.work_package import WorkPackage
from backend.models.project_master import ProjectMaster
from backend.models.contract import Contract

router = APIRouter(prefix="/common", tags=["master-activities"])

GROUP_MAP = {
    "ActivityGroupCode": "code",
    "ActivityGroupName": "name",
    "ActivityGroupParentId": "parent_id",
    "ProjectId": "project_id",
    "ProjectMasterId": "project_id",
    "ContractId": "contract_id",
    "LocationId": "location_id",
    "ModuleGroupId": "module_group_id",
    "Quantity": "quantity",
    "Weightage": "weightage",
    "StartDate": "start_date",
    "EndDate": "end_date",
    "Remarks": "remarks",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}

ACTIVITY_MAP = {
    "ActivityCode": "code",
    "ActivityName": "name",
    "ActivityGroupId": "activity_group_id",
    "ProjectId": "project_id",
    "ProjectMasterId": "project_id",
    "ContractId": "contract_id",
    "ActivityParentId": "parent_id",
    "Duration": "duration",
    "IsCritical": "is_critical",
    "IsSubActivity": "is_sub_activity",
    "Quantity": "quantity",
    "Weightage": "weightage",
    "StartDate": "start_date",
    "EndDate": "end_date",
    "Remarks": "remarks",
    "UnitId": "unit_id",
    "ReferenceCode": "reference_code",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}

WORK_PACKAGE_MAP = {
    "WorkPackageCode": "code",
    "WorkPackageName": "name",
    "ParentWorkPackageId": "parent_id",
    "ProjectId": "project_id",
    "ProjectMasterId": "project_id",
    "ContractId": "contract_id",
    "Level": "level",
    "Remarks": "remarks",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}


async def _project_name_map(db: AsyncSession) -> dict[int, str]:
    result = await db.execute(select(ProjectMaster).where(ProjectMaster.status != "9"))
    return {row.id: row.project_name or row.project_code or "" for row in result.scalars().all()}


async def _contract_name_map(db: AsyncSession) -> dict[int, str]:
    result = await db.execute(select(Contract).where(Contract.status != "9"))
    return {row.id: row.contract_name or "" for row in result.scalars().all()}


async def _refresh_activity_groups(
    db: AsyncSession,
    project_id: int = 0,
    contract_id: int = 0,
) -> list[dict]:
    stmt = select(ActivityGroup).where(ActivityGroup.status != "9").order_by(ActivityGroup.id)
    if project_id:
        stmt = stmt.where(ActivityGroup.project_id == project_id)
    if contract_id:
        stmt = stmt.where(ActivityGroup.contract_id == contract_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    parent_map = {row.id: row.name or "" for row in rows}
    project_map = await _project_name_map(db)
    contract_map = await _contract_name_map(db)

    out = []
    for row in rows:
        payload = row.to_dict()
        payload["ParentActivityGroupName"] = parent_map.get(row.parent_id or 0)
        payload["ProjectName"] = project_map.get(row.project_id or 0, "")
        payload["ContractName"] = contract_map.get(row.contract_id or 0, "")
        out.append(payload)
    return out


async def _resolve_activity_defaults(db: AsyncSession, obj: Activity) -> None:
    if (obj.project_id in (None, 0) or obj.contract_id in (None, 0)) and obj.activity_group_id:
        group = await db.get(ActivityGroup, obj.activity_group_id)
        if group is not None:
            if obj.project_id in (None, 0):
                obj.project_id = group.project_id or 0
            if obj.contract_id in (None, 0):
                obj.contract_id = group.contract_id or 0

    if obj.parent_id and obj.parent_id > 0:
        obj.is_sub_activity = True
        return

    ref = (obj.reference_code or "").strip()
    if not ref or ref.upper() == "NA":
        obj.parent_id = 0
        obj.is_sub_activity = False
        return

    stmt = select(Activity).where(
        Activity.activity_group_id == obj.activity_group_id,
        Activity.code == ref,
        Activity.id != obj.id,
    )
    result = await db.execute(stmt)
    parent = result.scalars().first()
    if parent is not None:
        obj.parent_id = parent.id
        obj.is_sub_activity = True
    else:
        obj.parent_id = 0
        obj.is_sub_activity = False


async def _refresh_activities(db: AsyncSession, activity_group_id: int = 0) -> list[dict]:
    stmt = select(Activity).where(Activity.status != "9").order_by(Activity.id)
    if activity_group_id:
        stmt = stmt.where(Activity.activity_group_id == activity_group_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    parent_map = {row.id: row.name or "" for row in rows}
    group_result = await db.execute(select(ActivityGroup).where(ActivityGroup.status != "9"))
    group_rows = group_result.scalars().all()
    group_map = {row.id: row.name or "" for row in group_rows}
    group_project_map = {row.id: row.project_id or 0 for row in group_rows}
    group_contract_map = {row.id: row.contract_id or 0 for row in group_rows}
    project_map = await _project_name_map(db)
    contract_map = await _contract_name_map(db)

    out = []
    for row in rows:
        payload = row.to_dict()
        project_id = row.project_id or group_project_map.get(row.activity_group_id or 0, 0)
        contract_id = row.contract_id or group_contract_map.get(row.activity_group_id or 0, 0)
        payload["ParentActivityName"] = parent_map.get(row.parent_id or 0)
        payload["ActivityGroupName"] = group_map.get(row.activity_group_id or 0, "")
        payload["ProjectName"] = project_map.get(project_id, "")
        payload["ContractName"] = contract_map.get(contract_id, "")
        payload["ProjectId"] = project_id
        payload["ContractId"] = contract_id
        out.append(payload)
    return out


async def _refresh_work_packages(db: AsyncSession, project_id: int = 0) -> list[dict]:
    stmt = select(WorkPackage).where(WorkPackage.status != "9").order_by(WorkPackage.id)
    if project_id:
        stmt = stmt.where(WorkPackage.project_id == project_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    project_map = await _project_name_map(db)
    contract_map = await _contract_name_map(db)
    out = []
    for row in rows:
        payload = row.to_dict()
        payload["ProjectName"] = project_map.get(row.project_id or 0, "")
        payload["ContractName"] = contract_map.get(row.contract_id or 0, "")
        out.append(payload)
    return out


async def _soft_delete(db: AsyncSession, model, pk) -> None:
    if not pk:
        return
    if isinstance(pk, str):
        pk = int(pk) if pk.strip() else 0
    if not pk:
        return
    obj = await db.get(model, pk)
    if obj is not None:
        obj.status = "9"
        await db.flush()


@router.get("/getActivityGroup")
async def get_activity_groups(
    projectId: int = Query(0),
    contractId: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _refresh_activity_groups(db, projectId, contractId)


@router.post("/saveActivityGroupDetails")
async def save_activity_group(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await upsert_model(db, ActivityGroup, body, "ActivityGroupId", GROUP_MAP)
    return await _refresh_activity_groups(db)


@router.post("/deleteActivityGroupDetails")
async def delete_activity_group(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    pk = body.get("ActivityGroupId")
    await _soft_delete(db, ActivityGroup, pk)
    return await _refresh_activity_groups(db)


@router.get("/getActivity")
async def get_activities(
    activityGroupId: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _refresh_activities(db, activityGroupId)


@router.get("/getSubActivity")
async def get_sub_activities(
    activityGroupId: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = await _refresh_activities(db, activityGroupId)
    return [row for row in rows if row.get("IsSubActivity") in (1, "1", True)]


@router.post("/saveActivityDetails")
async def save_activity(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = await upsert_model(db, Activity, body, "ActivityId", ACTIVITY_MAP)
    await _resolve_activity_defaults(db, obj)
    await db.flush()
    return await _refresh_activities(db)


@router.post("/saveActivityBulkDetails")
async def save_activity_bulk(
    body: Any,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = body if isinstance(body, list) else body.get("Activities", body.get("data", []))
    for row in rows or []:
        obj = await upsert_model(db, Activity, row, "ActivityId", ACTIVITY_MAP)
        await _resolve_activity_defaults(db, obj)
    await db.flush()
    return await _refresh_activities(db)


@router.post("/deleteActivityDetails")
async def delete_activity(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    pk = body.get("ActivityId")
    await _soft_delete(db, Activity, pk)
    return await _refresh_activities(db)


@router.get("/getWorkPackage")
async def get_work_packages(
    projectId: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _refresh_work_packages(db, projectId)
