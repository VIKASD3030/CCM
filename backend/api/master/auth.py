"""
Master sub-app authentication bridge.

Validates either a CCM HS256 JWT (from get_current_user) or an
Azure AD JWT against the tenant JWKS endpoint, based on the token
type / presence of the azure_oid claim on the user record returned.

This module is preserved for backward compatibility with the
/master SPA endpoints; Azure AD users are provisioned into the
single core users table (see auth.py azure_login).
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from backend.config import get_settings
from backend.models.user import User
from backend.api.deps import get_current_user

bearer_scheme = HTTPBearer(auto_error=False)
settings = get_settings()

AZURE_ALGORITHMS = {"RS256", "RS384", "RS512"}


async def get_master_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> User:
    """
    Try CCM JWT first. If it fails, attempt Azure AD validation.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
        )

    token = credentials.credentials

    # Try CCM JWT first
    ccm_secret = settings.auth.secret_key
    try:
        payload = jwt.decode(token, ccm_secret, algorithms=["HS256"])
        from sqlalchemy import select
        from backend.database import async_session_factory

        user_id: str = payload.get("sub")
        if user_id:
            async with async_session_factory() as db:
                result = await db.execute(
                    select(User).where(User.id == user_id, User.is_active.is_(True))
                )
                user = result.scalar_one_or_none()
                if user:
                    return user
    except JWTError:
        pass

    # Fall back to Azure AD validation
    tenant_id = settings.azure_tenant_id
    client_id = settings.azure_client_id

    if not tenant_id or not client_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token and Azure AD is not configured.",
        )

    try:
        unverified_headers = jwt.get_unverified_headers(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to parse token.",
        )

    import httpx
    from jose import jwk

    jwks_url = settings.azure_jwks_url or f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
    async with httpx.AsyncClient() as client:
        jwks_resp = await client.get(jwks_url)
        if jwks_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch Azure AD JWKS.")
        jwks = jwks_resp.json()

    kid = unverified_headers.get("kid")
    rsa_key = None
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            rsa_key = key
            break

    if not rsa_key:
        raise HTTPException(status_code=401, detail="Unable to find Azure AD signing key.")

    try:
        public_key = jwk.construct(rsa_key)
    except Exception:
        raise HTTPException(status_code=401, detail="Unable to construct Azure AD public key.")

    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=list(AZURE_ALGORITHMS),
            audience=client_id,
            issuer=f"https://login.microsoftonline.com/{tenant_id}/v2.0",
            options={"verify_exp": True},
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Azure AD token validation failed: {str(e)}",
        )

    azure_oid = payload.get("oid")
    email = payload.get("email") or payload.get("preferred_username") or ""
    name = payload.get("name", "")

    if not azure_oid:
        raise HTTPException(status_code=401, detail="Azure AD token missing 'oid' claim.")

    from backend.database import async_session_factory
    from backend.api.ccm.auth import provision_azure_ad_user

    async with async_session_factory() as db:
        user = await provision_azure_ad_user(
            db=db,
            azure_oid=azure_oid,
            tenant_id=tenant_id,
            email=email,
            name=name,
        )
        await db.commit()
        return user
