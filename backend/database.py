"""
Database engine, session factory, and dependency injection for FastAPI.
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
    """Initialize database and create all tables."""
    import backend.models  # Ensure models are registered with Base.metadata
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("db.tables_created")

        from backend.db_seed import seed_rbac
        await seed_rbac(conn)

        result = await conn.execute(
            text("SELECT column_name FROM information_schema.columns "
                 "WHERE table_name='knowledge_documents' AND column_name='storage_path'")
        )
        if not result.fetchone():
            logger.info("db.adding_column", table="knowledge_documents", column="storage_path")
            await conn.execute(text(
                "ALTER TABLE knowledge_documents ADD COLUMN storage_path VARCHAR(500)"
            ))

        # Add master-data status columns idempotently (create_all does not ALTER)
        for tbl in ("departments", "locations", "designations", "units", "lookups"):
            await conn.execute(text(
                f'ALTER TABLE "Master".{tbl} ADD COLUMN IF NOT EXISTS status VARCHAR(10) DEFAULT \'1\''
            ))

        # Run master schema consolidation migration if master tables exist
        master_tables_exist = await conn.execute(
            text("SELECT EXISTS (SELECT FROM information_schema.tables "
                 "WHERE table_name = 'master_project')")
        )
        if master_tables_exist.scalar():
            from backend.migrations import _001_consolidate_master_data as migration_001
            logger.info("db.running_migration_001")
            await migration_001.run(conn)
            logger.info("db.migration_001_complete")
