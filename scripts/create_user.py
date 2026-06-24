"""
Create or update a CCM user.
Usage: python scripts/create_user.py <email> <password> [role]
"""
import asyncio
import sys

from passlib.context import CryptContext
from sqlalchemy import text

from backend.config import get_settings
from backend.database import engine, Base, async_session_factory
from backend.models.user import User


async def create_user(email: str, password: str, role: str = "admin"):
    pwd = CryptContext(schemes=["bcrypt"])
    hashed = pwd.hash(password)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        result = await session.execute(
            text("SELECT id FROM users WHERE email = :em"),
            {"em": email},
        )
        existing = result.fetchone()
        if existing:
            await session.execute(
                text("UPDATE users SET hashed_password = :pw, role = :role WHERE email = :em"),
                {"pw": hashed, "role": role, "em": email},
            )
            action = "updated"
        else:
            user = User(
                email=email,
                name=email.split("@")[0],
                hashed_password=hashed,
                role=role,
                is_active=True,
            )
            session.add(user)
            action = "created"
        await session.commit()
        print(f"User {email} ({role}) {action} successfully")


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "vikas.ksv.dwivedi@gmail.com"
    password = sys.argv[2] if len(sys.argv) > 2 else "Vikas@3030"
    role = sys.argv[3] if len(sys.argv) > 3 else "admin"
    asyncio.run(create_user(email, password, role))
