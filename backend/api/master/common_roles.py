"""Role + Role-Right master (admin sub-app) — MasterRecord-backed.

Separate from the core RBAC roles API (backend.api.master.roles → /api/roles).
These serve the admin React screens' PascalCase /common contract.
"""
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import mr_list, mr_save, mr_delete
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-roles"])
ROLE, ROLE_ID = "role", "RoleId"
RIGHT, RIGHT_ID = "role_right", "RoleRightId"


@router.get("/getRoles")
async def get_roles(roleId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {ROLE_ID: roleId} if roleId else None
    return await mr_list(db, ROLE, ROLE_ID, filters)


@router.post("/saveRoles")
async def save_roles(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, ROLE, ROLE_ID, body)


@router.post("/deleteRoles")
async def delete_roles(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, ROLE, ROLE_ID, body)


@router.get("/getRoleRightDetails")
async def get_role_right_details(roleId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {ROLE_ID: roleId} if roleId else None
    return await mr_list(db, RIGHT, RIGHT_ID, filters)


@router.post("/saveRoleRightDetails")
async def save_role_right_details(body: Any, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = body if isinstance(body, list) else body.get("RoleRights", [body])
    for row in rows:
        await mr_save(db, RIGHT, RIGHT_ID, row)
    role_id = rows[0].get(ROLE_ID) if rows else 0
    filters = {ROLE_ID: role_id} if role_id else None
    return await mr_list(db, RIGHT, RIGHT_ID, filters)


@router.post("/deleteRoleRightDetails")
async def delete_role_right_details(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, RIGHT, RIGHT_ID, body)
