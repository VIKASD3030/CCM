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

        # Safety-net column adds for pre-existing tables (create_all never ALTERs).
        # Idempotent; a matching Alembic migration can carry the same guard.
        for ddl in (
            "ALTER TABLE draft_responses ADD COLUMN IF NOT EXISTS letter_data JSONB",
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(30)",
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS clause_count INTEGER DEFAULT 0",
            "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS clause_no VARCHAR(40)",
            "CREATE INDEX IF NOT EXISTS ix_kd_project_type ON knowledge_documents (project_id, document_type)",
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS page_count INTEGER",
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS ocr_pages INTEGER DEFAULT 0",
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS status_detail TEXT",
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS checksum VARCHAR(64)",
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS ref_no VARCHAR(200)",
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS doc_date DATE",
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS subject TEXT",
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS referenced_refs JSONB",
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS volume_label VARCHAR(120)",
            "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_from INTEGER",
            "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_to INTEGER",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS domain_category VARCHAR(60)",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS posture VARCHAR(40)",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS scope VARCHAR(60)",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS kd_tags JSONB",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS requested_action TEXT",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS ref_no VARCHAR(200)",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS letter_date DATE",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS subject TEXT",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS referenced_refs JSONB",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500)",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS file_type VARCHAR(20)",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS page_count INTEGER",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS ocr_pages INTEGER DEFAULT 0",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS suggested_project_id UUID REFERENCES projects(id) ON DELETE SET NULL",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS routing_confidence DOUBLE PRECISION",
            "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS routing_reason TEXT",
            "CREATE INDEX IF NOT EXISTS ix_kd_project_checksum ON knowledge_documents (project_id, checksum)",
            "CREATE INDEX IF NOT EXISTS ix_kd_project_ref ON knowledge_documents (project_id, ref_no)",
            "CREATE INDEX IF NOT EXISTS ix_dc_fts ON document_chunks USING gin (to_tsvector('simple', chunk_text))",
        ):
            try:
                await conn.exec_driver_sql(ddl)
            except Exception as exc:  # noqa: BLE001 — never block startup on this
                logger.warning("db.safety_alter_failed", ddl=ddl, error=str(exc))

        # Documents still "processing" after 10 minutes were interrupted (for
        # example by a server restart while indexing in-process). Mark them
        # failed so the project folder shows Re-index instead of a spinner forever.
        try:
            await conn.exec_driver_sql(
                "UPDATE knowledge_documents SET status = 'failed', "
                "status_detail = 'Indexing was interrupted (the server restarted). Use Re-index.' "
                "WHERE status = 'processing' AND updated_at < now() - interval '10 minutes'"
            )
        except Exception as exc:  # noqa: BLE001 — never block startup on this
            logger.warning("db.stuck_documents_sweep_failed", error=str(exc))

        from backend.db_seed import seed_rbac
        await seed_rbac(conn)
