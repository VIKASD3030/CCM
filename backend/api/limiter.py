"""
Rate limiting configuration for CCM API.
Provides a shared Limiter instance and key functions.
"""
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from jose import JWTError, jwt as jose_jwt

from backend.config import get_settings

settings = get_settings()


def get_user_key(request: Request) -> str:
    """Extract user ID from JWT for rate limiting, falling back to IP."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = jose_jwt.decode(
                token, settings.auth.secret_key, algorithms=["HS256"],
                options={"verify_exp": False}
            )
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except JWTError:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=get_user_key, default_limits=["100/minute"])
