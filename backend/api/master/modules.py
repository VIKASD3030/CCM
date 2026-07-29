"""Module + Module Group master backed by dedicated tables."""
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import upsert_model, soft_delete_model
from backend.models.user import User
from backend.models.ui_module import UiModule
from backend.models.module_group import ModuleGroup

router = APIRouter(prefix="/common", tags=["master-modules"])

MODULE_MAP = {
    "ModuleName": "name",
    "UserShownName": "user_shown_name",
    "ModuleGroupId": "module_group_id",
    "ParentModuleId": "parent_module_id",
    "Level": "level",
    "ModuleType": "module_type",
    "ModulePath": "module_path",
    "IsExact": "is_exact",
    "IconType": "icon_type",
    "IconPath": "icon_path",
    "Remarks": "remarks",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}

MODULE_GROUP_MAP = {
    "ModuleGroupCode": "code",
    "ModuleGroupName": "name",
    "ParentModuleGroupId": "parent_id",
    "Level": "level",
    "Remarks": "remarks",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}


async def _refresh_module_groups(db: AsyncSession, module_group_id: int = 0) -> list[dict]:
    name_result = await db.execute(select(ModuleGroup).where(ModuleGroup.status != "9"))
    name_map = {row.id: row.name or "" for row in name_result.scalars().all()}

    stmt = select(ModuleGroup).where(ModuleGroup.status != "9").order_by(ModuleGroup.id)
    if module_group_id:
        stmt = stmt.where(ModuleGroup.id == module_group_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    out = []
    for row in rows:
        payload = row.to_dict()
        payload["ParentModuleGroupName"] = name_map.get(row.parent_id or 0)
        out.append(payload)
    return out


async def _refresh_modules(db: AsyncSession) -> list[dict]:
    group_result = await db.execute(select(ModuleGroup).where(ModuleGroup.status != "9"))
    group_map = {row.id: row.name or "" for row in group_result.scalars().all()}

    parent_result = await db.execute(select(UiModule).where(UiModule.status != "9"))
    parent_map = {row.id: row.name or "" for row in parent_result.scalars().all()}

    result = await db.execute(select(UiModule).where(UiModule.status != "9").order_by(UiModule.id))
    rows = result.scalars().all()

    out = []
    for row in rows:
        payload = row.to_dict()
        payload["ModuleGroupName"] = group_map.get(row.module_group_id or 0, "")
        payload["ParentModuleName"] = parent_map.get(row.parent_module_id or 0)
        out.append(payload)
    return out


@router.post("/getModules")
async def get_modules(
    body: dict[str, Any] = {},
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _refresh_modules(db)


@router.post("/saveModuleDetails")
async def save_module(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await upsert_model(db, UiModule, body, "ModuleId", MODULE_MAP)
    return await _refresh_modules(db)


@router.post("/deleteModuleDetails")
async def delete_module(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await soft_delete_model(db, UiModule, body.get("ModuleId"))
    return await _refresh_modules(db)


@router.get("/getModuleGroups")
async def get_module_groups(
    moduleGroupId: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _refresh_module_groups(db, moduleGroupId)


@router.post("/getModuleGroups")
async def get_module_groups_post(
    body: dict[str, Any] = {},
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    module_group_id = body.get("moduleGroupId") or body.get("ModuleGroupId") or 0
    try:
        module_group_id = int(module_group_id)
    except (TypeError, ValueError):
        module_group_id = 0
    return await _refresh_module_groups(db, module_group_id)


@router.post("/saveModuleGroupDetails")
async def save_module_group(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await upsert_model(db, ModuleGroup, body, "ModuleGroupId", MODULE_GROUP_MAP)
    return await _refresh_module_groups(db)


@router.post("/deleteModuleGroupDetails")
async def delete_module_group(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await soft_delete_model(db, ModuleGroup, body.get("ModuleGroupId"))
    return await _refresh_module_groups(db)
