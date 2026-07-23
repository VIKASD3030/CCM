"""Module + Module Group master (UI menu tree) — MasterRecord-backed.

Note: intentionally separate from the RBAC `modules` table (backend.models.module),
which is a fixed permission-area list. These are the admin-editable UI menu entries.
"""
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import mr_list, mr_save, mr_delete
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-modules"])
MOD, MOD_ID = "ui_module", "ModuleId"
GRP, GRP_ID = "module_group", "ModuleGroupId"


@router.post("/getModules")
async def get_modules(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_list(db, MOD, MOD_ID)


@router.post("/saveModuleDetails")
async def save_module(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, MOD, MOD_ID, body)


@router.post("/deleteModuleDetails")
async def delete_module(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, MOD, MOD_ID, body)


@router.get("/getModuleGroups")
async def get_module_groups(moduleGroupId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {GRP_ID: moduleGroupId} if moduleGroupId else None
    return await mr_list(db, GRP, GRP_ID, filters)


@router.post("/getModuleGroups")
async def get_module_groups_post(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    module_group_id = body.get("moduleGroupId") or body.get("ModuleGroupId") or 0
    try:
        module_group_id = int(module_group_id)
    except (TypeError, ValueError):
        module_group_id = 0
    filters = {GRP_ID: module_group_id} if module_group_id else None
    return await mr_list(db, GRP, GRP_ID, filters)


@router.post("/saveModuleGroupDetails")
async def save_module_group(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, GRP, GRP_ID, body)


@router.post("/deleteModuleGroupDetails")
async def delete_module_group(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, GRP, GRP_ID, body)
