"""Role + Role-Right master backed by dedicated tables."""
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import upsert_model, soft_delete_model
from backend.models.user import User
from backend.models.common_role import CommonRole
from backend.models.role_right import RoleRight

router = APIRouter(prefix="/common", tags=["master-roles"])

ROLE_MAP = {
    "RoleCode": "code",
    "RoleName": "name",
    "ParentRoleId": "parent_id",
    "Level": "level",
    "Remarks": "remarks",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}

RIGHT_MAP = {
    "RoleId": "role_id",
    "ModuleId": "module_id",
    "ModuleGroupId": "module_group_id",
    "ParentModuleGroupId": "parent_module_group_id",
    "UserShownName": "user_shown_name",
    "ModuleGroupName": "module_group_name",
    "ParentModuleGroupName": "parent_module_group_name",
    "RightStatus": "right_status",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}


async def _refresh_roles(db: AsyncSession, role_id: int = 0) -> list[dict]:
    name_result = await db.execute(select(CommonRole).where(CommonRole.status != "9"))
    role_name_map = {row.id: row.name or "" for row in name_result.scalars().all()}

    stmt = select(CommonRole).where(CommonRole.status != "9").order_by(CommonRole.id)
    if role_id:
        stmt = stmt.where(CommonRole.id == role_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    out = []
    for row in rows:
        payload = row.to_dict()
        payload["ParentRoleName"] = role_name_map.get(row.parent_id or 0)
        out.append(payload)
    return out


async def _refresh_role_rights(db: AsyncSession, role_id: int = 0) -> list[dict]:
    stmt = select(RoleRight).where(RoleRight.status != "9").order_by(RoleRight.id)
    if role_id:
        stmt = stmt.where(RoleRight.role_id == role_id)
    result = await db.execute(stmt)
    return [row.to_dict() for row in result.scalars().all()]


@router.get("/getRoles")
async def get_roles(
    roleId: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _refresh_roles(db, roleId)


@router.post("/saveRoles")
async def save_roles(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await upsert_model(db, CommonRole, body, "RoleId", ROLE_MAP)
    return await _refresh_roles(db)


@router.post("/deleteRoles")
async def delete_roles(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await soft_delete_model(db, CommonRole, body.get("RoleId"))
    return await _refresh_roles(db)


@router.get("/getRoleRightDetails")
async def get_role_right_details(
    roleId: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _refresh_role_rights(db, roleId)


@router.post("/saveRoleRightDetails")
async def save_role_right_details(
    body: Any,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = body if isinstance(body, list) else body.get("RoleRights", [body])
    for row in rows:
        await upsert_model(db, RoleRight, row, "RoleRightId", RIGHT_MAP)
    role_id = rows[0].get("RoleId") if rows else 0
    return await _refresh_role_rights(db, int(role_id or 0))


@router.post("/deleteRoleRightDetails")
async def delete_role_right_details(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await soft_delete_model(db, RoleRight, body.get("RoleRightId"))
    return await _refresh_role_rights(db, int(body.get("RoleId") or 0))
