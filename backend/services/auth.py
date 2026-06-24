"""
Authentication service for handling JWT tokens, refresh tokens, and user management.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models.user import User
from backend.models.revoked_token import RevokedToken

logger = logging.getLogger(__name__)
settings = get_settings()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
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
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    """Authenticate a user by email and password."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def login_user(
    db: AsyncSession, 
    email: str, 
    password: str, 
    ip_address: str
) -> Tuple[Optional[User], Optional[str], Optional[str]]:
    """
    Authenticate user and create tokens.
    Returns (user, access_token, refresh_token) or (None, None, None) on failure.
    """
    # Authenticate user
    user = await authenticate_user(db, email, password)
    if not user:
        return None, None, None
    
    # Check if account is locked
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        return None, None, None
    
    # Check failed attempts
    if user.failed_login_attempts >= 5:
        return None, None, None
    
    # Reset failed attempts and update login info
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = ip_address
    
    # Create tokens
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    await db.commit()
    return user, access_token, refresh_token


async def refresh_access_token(
    db: AsyncSession, 
    refresh_token: str
) -> Tuple[Optional[str], Optional[User]]:
    """
    Refresh access token using refresh token.
    Returns (new_access_token, user) or (None, None) on failure.
    """
    credentials_exception = JWTError("Could not validate credentials")
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        jti: str = payload.get("jti")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Check if token is revoked
    result = await db.execute(
        select(RevokedToken).where(RevokedToken.jti == user_id)  # Using user_id as JTI for simplicity
    )
    revoked_token = result.scalar_one_or_none()
    if revoked_token:
        return None, None
    
    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return None, None
    
    # Create new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return access_token, user


async def logout_user(
    db: AsyncSession, 
    refresh_token: str
) -> bool:
    """
    Logout user by revoking refresh token.
    Returns True if successful.
    """
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return False
            
        # Check if already revoked
        result = await db.execute(
            select(RevokedToken).where(RevokedToken.jti == user_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return True  # Already revoked
            
        # Add to revoked tokens
        revoked_token = RevokedToken(
            jti=user_id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        )
        db.add(revoked_token)
        await db.commit()
        return True
    except JWTError:
        return False


async def record_failed_attempt(
    db: AsyncSession, 
    email: str, 
    ip_address: str
) -> None:
    """Record a failed login attempt and lock account if threshold reached."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            # Lock account for 15 minutes
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        await db.commit()
    # For non-existent users, we don't record anything to prevent user enumeration
    # In a more sophisticated system, we might track failed attempts by IP


async def cleanup_expired_revoked_tokens(db: AsyncSession) -> int:
    """Clean up expired revoked tokens. Returns number of tokens deleted."""
    result = await db.execute(
        delete(RevokedToken).where(RevokedToken.expires_at < datetime.now(timezone.utc))
    )
    await db.commit()
    return result.rowcount