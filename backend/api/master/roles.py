"""
Roles & Permissions admin API.
Manage dynamic roles and their per-module permission matrix.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import require_permission
from backend.database import get_db
from backend.models.user import User
from backend.models.role import Role
from backend.models.module import Module
from backend.models.role_permission import RolePermission

router = APIRouter(prefix="/api/roles", tags=["Roles & Permissions"])


@router.get("")
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("roles", "view")),
):
    """List all roles, each with its full module permission matrix."""
    roles_result = await db.execute(select(Role).order_by(Role.name))
    roles = roles_result.scalars().all()

    perms_result = await db.execute(select(RolePermission))
    perms = perms_result.scalars().all()

    perms_by_role = {}
    for perm in perms:
        perms_by_role.setdefault(perm.role_name, []).append(perm.to_dict())

    return {
        "roles": [
            {**role.to_dict(), "permissions": perms_by_role.get(role.name, [])}
            for role in roles
        ]
    }


@router.get("/modules")
async def list_modules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("roles", "view")),
):
    """List all modules (static reference list for the permission matrix UI)."""
    result = await db.execute(select(Module).order_by(Module.key))
    modules = result.scalars().all()
    return {"modules": [m.to_dict() for m in modules]}


@router.post("", status_code=201)
async def create_role(
    name: str = Body(...),
    description: str = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("roles", "create")),
):
    """Create a new custom role."""
    existing = await db.execute(select(Role).where(Role.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Role '{name}' already exists.")

    role = Role(name=name, description=description, is_system=False)
    db.add(role)
    await db.commit()
    return {"status": "created", "role": role.to_dict()}


@router.put("/{name}")
async def update_role(
    name: str,
    description: str = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("roles", "edit")),
):
    """Update a role's description. System roles' names cannot be changed."""
    role = await db.get(Role, name)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")

    role.description = description
    await db.commit()
    return {"status": "updated", "role": role.to_dict()}


@router.delete("/{name}")
async def delete_role(
    name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("roles", "delete")),
):
    """Delete a custom role. System roles and roles still assigned to users cannot be deleted."""
    role = await db.get(Role, name)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")

    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted.")

    in_use = await db.execute(select(User).where(User.role == name).limit(1))
    if in_use.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role is still assigned to one or more users.")

    await db.delete(role)
    await db.commit()
    return {"status": "deleted"}


@router.put("/{name}/permissions")
async def update_role_permissions(
    name: str,
    permissions: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("roles", "edit")),
):
    """Bulk upsert the permission matrix for a role.

    Body: {module_key: {can_view, can_create, can_edit, can_delete}, ...}
    """
    role = await db.get(Role, name)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")

    modules_result = await db.execute(select(Module.key))
    valid_module_keys = {row[0] for row in modules_result.all()}

    for module_key, grants in permissions.items():
        if module_key not in valid_module_keys:
            raise HTTPException(status_code=400, detail=f"Unknown module '{module_key}'.")

        existing = await db.execute(
            select(RolePermission).where(
                RolePermission.role_name == name,
                RolePermission.module_key == module_key,
            )
        )
        perm = existing.scalar_one_or_none()
        if not perm:
            perm = RolePermission(role_name=name, module_key=module_key)
            db.add(perm)

        perm.can_view = bool(grants.get("can_view", False))
        perm.can_create = bool(grants.get("can_create", False))
        perm.can_edit = bool(grants.get("can_edit", False))
        perm.can_delete = bool(grants.get("can_delete", False))

    await db.commit()

    result = await db.execute(select(RolePermission).where(RolePermission.role_name == name))
    perms = result.scalars().all()
    return {"status": "updated", "permissions": [p.to_dict() for p in perms]}
