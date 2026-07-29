"""
Database engine, session factory, and dependency injection for FastAPI.

Schema management is handled by Alembic migrations (backend/alembic/).
init_db() retains data-seeding responsibilities only.
"""

import structlog
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from backend.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

engine_kwargs = {
    "echo": settings.debug,
    "pool_size": settings.database.pool_size,
    "max_overflow": settings.database.max_overflow,
    "pool_timeout": settings.database.pool_timeout,
    "pool_recycle": settings.database.pool_recycle,
    "pool_pre_ping": settings.database.pool_pre_ping,
}

engine = create_async_engine(
    str(settings.database.url),
    **engine_kwargs,
)


@event.listens_for(engine.sync_engine, "connect")
def _set_search_path(dbapi_conn, _rec):
    cursor = dbapi_conn.cursor()
    cursor.execute("SET search_path TO Master, public")
    cursor.close()

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db():
    """FastAPI dependency — yields an async DB session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Ensure tables exist and seed RBAC data.

    Schema changes are managed by Alembic migrations. This function:
    1. Creates tables that don't yet exist (safe — does not alter existing tables).
    2. Seeds roles, modules, and permissions if they don't exist.

    NOTE: After Phase 2 of the restructure, `create_all` can be removed entirely
    since Alembic will own all DDL. For now it remains as a safety net for
    fresh database bootstrap.
    """
    import backend.models  # Ensure models are registered with Base.metadata
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("db.tables_created_or_verified")

        from backend.db_seed import seed_rbac
        await seed_rbac(conn)
