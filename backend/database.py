"""
Database engine, session factory, and dependency injection for FastAPI.
"""

import logging
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from backend.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Engine configuration for PostgreSQL + asyncpg
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
    """Initialize database and create all tables."""
    import backend.models  # Ensure models are registered with Base.metadata
    from sqlalchemy import text
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created")

        # Add storage_path column if missing (added in v1.1)
        result = await conn.execute(
            text("SELECT column_name FROM information_schema.columns "
                 "WHERE table_name='knowledge_documents' AND column_name='storage_path'")
        )
        if not result.fetchone():
            logger.info("Adding storage_path column to knowledge_documents...")
            await conn.execute(text(
                "ALTER TABLE knowledge_documents ADD COLUMN storage_path VARCHAR(500)"
            ))
