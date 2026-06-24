"""
Authentication API endpoints.
"""
import uuid as uuid_lib
import hashlib
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status, Request, Body, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_role
from backend.services.email_service import email_service
from backend.api.limiter import limiter
from backend.config import get_settings
from backend.database import get_db
from backend.models.user import User
from backend.models.password_reset import PasswordResetToken

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)
settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = settings.auth.secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.auth.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = settings.auth.refresh_token_expire_days


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


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
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    OAuth2 compatible token login — accepts form-encoded (username/password)
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
    """
    Alternative login endpoint accepting JSON body: { email, password }.
    Useful for frontend SPA that prefers JSON over form-encoded.
    """
    email = body.get("email", "")
    password = body.get("password", "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    # Forward to the same OAuth2PasswordRequestForm logic
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
            "is_active": current_user.is_active,
        }
    }


@router.post("/refresh")
@limiter.limit("10/minute")
async def refresh_token(
    request: Request,
    refresh_token: str,
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
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
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
async def logout():
    """Logout — client-side token removal is sufficient."""
    return {"message": "Successfully logged out"}


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Request a password reset email.
    Always returns 200 to prevent email enumeration.
    """
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
            logger.info("Password reset email sent", extra={"email": email})
        else:
            logger.info("Password reset email skipped (SMTP not configured)", extra={"email": email, "link": reset_link})

    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
@limiter.limit("3/minute")
async def reset_password(
    request: Request,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Reset password using a valid reset token.
    """
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
    reset.used = True
    await db.commit()

    logger.info("Password reset successful", extra={"user_id": str(user.id)})
    return {"message": "Password has been reset successfully."}


@router.post("/register")
async def register(
    email: str = Body(...),
    password: str = Body(...),
    name: str = Body(None),
    role: str = Body("drafter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Admin-only: create a new user."""
    if role not in ("admin", "drafter", "reviewer"):
        raise HTTPException(status_code=400, detail=f"Invalid role '{role}'. Must be admin, drafter, or reviewer.")

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A user with this email already exists.")

    user = User(
        id=uuid_lib.uuid4(),
        email=email,
        name=name,
        hashed_password=get_password_hash(password),
        role=role,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.commit()

    logger.info("auth.user.created", extra={"email": email, "role": role, "created_by": str(current_user.id)})
    return {"status": "created", "user": user.to_dict()}


@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Admin-only: list all users."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return {"users": [u.to_dict() for u in users]}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Admin-only: delete a user. Cannot delete yourself."""
    if user_id == str(current_user.id):
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    await db.delete(user)
    await db.commit()
    logger.info("auth.user.deleted", extra={"user_id": user_id, "deleted_by": str(current_user.id)})
    return {"status": "deleted"}


# ─── Google OAuth ──────────────────────────────────────────────
# These endpoints require the `authlib` or `httpx` + manual OAuth flow.
# For now, they serve as stubs that redirect to the frontend with an error.
# To enable: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env,
# uncomment the authlib imports, and implement the callback handler.


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

    # Exchange code for tokens
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

        # Fetch user info
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

    # Domain restriction
    allowed_domains = settings.auth.google_allowed_domains
    if allowed_domains:
        domain = email.split("@")[-1] if "@" in email else ""
        if domain not in allowed_domains:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Sign-in restricted to {', '.join(allowed_domains)} domains.",
            )

    # Find or create user
    result = await db.execute(
        select(User).where((User.google_id == google_id) | (User.email == email))
    )
    user = result.scalar_one_or_none()

    if user:
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
            hashed_password="",  # password-less account
            role="drafter",
            is_active=True,
        )
        db.add(user)

    await db.commit()

    # Generate tokens
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Redirect back to frontend with tokens (fragment for security)
    redirect_url = f"{settings.app_base_url}/login?token={access_token}&refresh={refresh_token}"
    return RedirectResponse(url=redirect_url)


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
