"""
Authentication API endpoints.
"""

import uuid as uuid_lib
import hashlib
import secrets
import structlog
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_permission
from backend.services.email_service import email_service
from backend.api.limiter import limiter
from backend.config import get_settings
from backend.database import get_db
from backend.models.user import User
from backend.models.role import Role
from backend.models.password_reset import PasswordResetToken
from backend.models.revoked_token import RevokedToken

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
logger = structlog.get_logger()
settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = settings.auth.secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.auth.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = settings.auth.refresh_token_expire_days


def verify_password(plain_password, hashed_password):
    if not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        return False


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "jti": str(uuid_lib.uuid4())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def provision_azure_ad_user(
    db: AsyncSession,
    azure_oid: str,
    tenant_id: str,
    email: str,
    name: str | None = None,
) -> User:
    """JIT-provision a user row from Azure AD token claims."""
    result = await db.execute(
        select(User).where(User.azure_oid == azure_oid)
    )
    user = result.scalar_one_or_none()

    if user:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled.",
            )
        user.name = name or user.name
        user.azure_tenant_id = tenant_id
        user.last_login_at = datetime.now(timezone.utc)
        return user

    result = await db.execute(
        select(User).where(User.email == email)
    )
    existing_email = result.scalar_one_or_none()
    if existing_email:
        existing_email.azure_oid = azure_oid
        existing_email.azure_tenant_id = tenant_id
        existing_email.auth_provider = "azure_ad"
        existing_email.hashed_password = None
        existing_email.last_login_at = datetime.now(timezone.utc)
        return existing_email

    user = User(
        id=uuid_lib.uuid4(),
        name=name,
        email=email,
        azure_oid=azure_oid,
        azure_tenant_id=tenant_id,
        auth_provider="azure_ad",
        hashed_password=None,
        role="drafter",
        is_active=True,
    )
    db.add(user)
    return user


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """OAuth2 compatible token login — accepts form-encoded (username/password)
    or JSON body (email/password) via OAuth2PasswordRequestForm.
    Returns access token + refresh token + user object.
    Locks account for 15 minutes after 5 consecutive failed attempts.
    """
    client_ip = request.client.host if request.client else "unknown"

    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        await _record_failed_attempt(db, None, client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.auth_provider != "password":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses SSO authentication. Please sign in with your identity provider.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account is locked due to too many failed login attempts. Try again later.",
        )

    if not verify_password(form_data.password, user.hashed_password):
        await _record_failed_attempt(db, user, client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = client_ip
    await db.commit()

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "auth_provider": user.auth_provider,
            "is_active": user.is_active,
        }
    }


@router.post("/login/json")
@limiter.limit("5/minute")
async def login_json(
    request: Request,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db)
):
    """Alternative login endpoint accepting JSON body: { email, password }."""
    email = body.get("email", "")
    password = body.get("password", "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    form = OAuth2PasswordRequestForm(username=email, password=password)
    return await login(request, form, db)


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return the current authenticated user's profile."""
    return {
        "user": {
            "id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "auth_provider": current_user.auth_provider,
            "is_active": current_user.is_active,
        }
    }


@router.post("/refresh")
@limiter.limit("10/minute")
async def refresh_token(
    request: Request,
    refresh_token: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        jti: str = payload.get("jti")
        if user_id is None or jti is None:
            raise credentials_exception
        jti = uuid_lib.UUID(jti)
    except (JWTError, ValueError):
        raise credentials_exception

    revoked = await db.execute(select(RevokedToken).where(RevokedToken.jti == jti))
    if revoked.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(
    refresh_token: str = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
):
    """Logout — revokes the refresh token server-side (by its jti)."""
    if not refresh_token:
        return {"message": "Successfully logged out"}

    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp")
        jti = uuid_lib.UUID(jti) if jti else None
    except (JWTError, ValueError):
        return {"message": "Successfully logged out"}

    if jti:
        existing = await db.execute(select(RevokedToken).where(RevokedToken.jti == jti))
        if not existing.scalar_one_or_none():
            expires_at = (
                datetime.fromtimestamp(exp, tz=timezone.utc)
                if exp
                else datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
            )
            db.add(RevokedToken(jti=jti, expires_at=expires_at))
            await db.commit()

    return {"message": "Successfully logged out"}


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Request a password reset email. Always returns 200 to prevent enumeration."""
    email = body.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        reset = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(reset)
        await db.commit()

        reset_link = f"{settings.app_base_url}/reset-password?token={token}"

        sent = await email_service.send(
            template_name="password_reset",
            recipients=[email],
            subject="Reset your CCM password",
            template_data={"reset_link": reset_link},
        )

        if sent:
            logger.info("auth.password_reset_email_sent", email=email)
        else:
            logger.info("auth.password_reset_email_skipped", email=email, link=reset_link, reason="SMTP not configured")

    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
@limiter.limit("3/minute")
async def reset_password(
    request: Request,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Reset password using a valid reset token."""
    token = body.get("token", "")
    new_password = body.get("newPassword", "")

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new password are required.")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    token_hash = hashlib.sha256(token.encode()).hexdigest()

    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )
    reset = result.scalar_one_or_none()

    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    user = await db.get(User, reset.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="User not found.")

    user.hashed_password = get_password_hash(new_password)
    user.auth_provider = "password"
    reset.used = True
    await db.commit()

    logger.info("auth.password_reset_successful", user_id=str(user.id))
    return {"message": "Password has been reset successfully."}


@router.post("/register")
async def register(
    email: str = Body(...),
    password: str = Body(...),
    name: str = Body(None),
    role: str = Body("drafter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users", "create")),
):
    """Admin-only: create a new user."""
    role_exists = await db.execute(select(Role).where(Role.name == role))
    if not role_exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Invalid role '{role}'. No such role exists.")

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A user with this email already exists.")

    user = User(
        id=uuid_lib.uuid4(),
        email=email,
        name=name,
        hashed_password=get_password_hash(password),
        role=role,
        auth_provider="password",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.commit()

    logger.info("auth.user_created", email=email, role=role, created_by=str(current_user.id))
    return {"status": "created", "user": user.to_dict()}


@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users", "view")),
):
    """Admin-only: list all users."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return {"users": [u.to_dict() for u in users]}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users", "delete")),
):
    """Admin-only: delete a user. Cannot delete yourself."""
    if user_id == str(current_user.id):
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    await db.delete(user)
    await db.commit()
    logger.info("auth.user_deleted", user_id=user_id, deleted_by=str(current_user.id))
    return {"status": "deleted"}


# ─── Google OAuth ──────────────────────────────────────────────

@router.get("/google")
async def google_login(request: Request):
    """Redirect to Google OAuth consent screen."""
    client_id = settings.auth.google_client_id
    if not client_id:
        return HTMLResponse('<html><body><p>Google OAuth is not configured. '
                            '<a href="/login">Back to login</a></p></body></html>',
                            status_code=501)
    redirect_uri = f"{settings.app_base_url}/api/auth/google/callback"
    params = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str = Query(None),
    error: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth callback."""
    if error:
        raise HTTPException(status_code=400, detail=f"Google OAuth error: {error}")

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")

    client_id = settings.auth.google_client_id
    client_secret = settings.auth.google_client_secret

    if not client_id or not client_secret:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured.")

    token_url = "https://oauth2.googleapis.com/token"
    redirect_uri = f"{settings.app_base_url}/api/auth/google/callback"

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(token_url, data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        token_data = token_resp.json()

        if "access_token" not in token_data:
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code.")

        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        google_user = userinfo_resp.json()

    google_id = google_user.get("id")
    email = google_user.get("email")
    name = google_user.get("name", "")

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email.")

    allowed_domains = settings.auth.google_allowed_domains
    if allowed_domains:
        domain = email.split("@")[-1] if "@" in email else ""
        if domain not in allowed_domains:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Sign-in restricted to {', '.join(allowed_domains)} domains.",
            )

    result = await db.execute(
        select(User).where((User.google_id == google_id) | (User.email == email))
    )
    user = result.scalar_one_or_none()

    if user:
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is disabled.")
        user.google_id = google_id
        if name and not user.name:
            user.name = name
        user.last_login_at = datetime.now(timezone.utc)
    else:
        user = User(
            id=uuid_lib.uuid4(),
            name=name,
            email=email,
            google_id=google_id,
            hashed_password=None,
            auth_provider="password",
            role="drafter",
            is_active=True,
        )
        db.add(user)

    await db.commit()

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    redirect_url = f"{settings.app_base_url}/login#token={access_token}&refresh={refresh_token}"
    return RedirectResponse(url=redirect_url)


# ─── Azure AD OAuth ────────────────────────────────────────────

@router.post("/azure/login")
@limiter.limit("10/minute")
async def azure_login(
    request: Request,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Exchange an Azure AD access token for a CCM JWT.
    Body: { "token": "<azure-ad-access-token>" }
    Validates the token against Azure AD JWKS, JIT-provisions the user,
    and returns CCM access/refresh tokens.
    """
    import httpx
    from jose import jwk, JWTError

    azure_token = body.get("token")
    if not azure_token:
        raise HTTPException(status_code=400, detail="Azure AD token is required.")

    tenant_id = settings.azure_tenant_id
    client_id = settings.azure_client_id

    if not tenant_id or not client_id:
        raise HTTPException(status_code=501, detail="Azure AD is not configured.")

    try:
        unverified_headers = jwt.get_unverified_headers(azure_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid Azure AD token.")

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
            azure_token,
            public_key,
            algorithms=["RS256", "RS384", "RS512"],
            audience=client_id,
            issuer=f"https://login.microsoftonline.com/{tenant_id}/v2.0",
            options={"verify_exp": True},
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Azure AD token validation failed: {str(e)}")

    email = payload.get("email") or payload.get("preferred_username") or ""
    name = payload.get("name", "")
    azure_oid = payload.get("oid")
    if not azure_oid:
        raise HTTPException(status_code=401, detail="Azure AD token missing 'oid' claim.")

    client_ip = request.client.host if request.client else "unknown"

    user = await provision_azure_ad_user(
        db=db,
        azure_oid=azure_oid,
        tenant_id=tenant_id,
        email=email,
        name=name,
    )
    user.last_login_ip = client_ip
    await db.commit()

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "auth_provider": user.auth_provider,
            "is_active": user.is_active,
        }
    }


async def _record_failed_attempt(
    db: AsyncSession,
    user: Optional[User],
    client_ip: str
):
    """Record a failed login attempt and lock account if threshold reached."""
    if user:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        await db.commit()
