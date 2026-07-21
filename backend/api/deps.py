"""
API dependencies for authentication and authorization.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.config import get_settings
from backend.database import get_db
from backend.models.user import User
from backend.models.role_permission import RolePermission

settings = get_settings()

# OAuth2 scheme for token extraction.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# JWT settings
SECRET_KEY = settings.auth.secret_key
ALGORITHM = "HS256"


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to get the current authenticated user.
    Raises HTTPException if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    return user


def require_role(*allowed_roles: str):
    """
    Dependency factory to require specific roles.
    Usage: 
        @app.get("/admin-only")
        async def admin_endpoint(user: User = Depends(require_role("admin"))):
            ...
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required one of: {allowed_roles}"
            )
        return current_user
    return role_checker


def require_permission(module_key: str, action: str = "view"):
    """
    Dependency factory to require a specific action (view/create/edit/delete)
    on a module, looked up per-request from the role_permissions table.
    Unlike require_role(), this makes access admin-configurable at runtime
    (via the /api/roles endpoints) instead of hardcoded per route.
    Usage:
        @app.delete("/webhooks/{id}")
        async def delete_webhook(user: User = Depends(require_permission("webhooks", "delete"))):
            ...
    """
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        result = await db.execute(
            select(RolePermission).where(
                RolePermission.role_name == current_user.role,
                RolePermission.module_key == module_key,
            )
        )
        perm = result.scalar_one_or_none()
        if not perm or not getattr(perm, f"can_{action}", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions for {module_key}.{action}",
            )
        return current_user
    return permission_checker
