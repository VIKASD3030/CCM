"""
Alembic environment for async SQLAlchemy (asyncpg).

Configured to work with the CCM backend's async engine and both schemas
(Master + public).
"""
import asyncio
import os
import sys
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection

# ── Path setup ──
# alembic.ini lives in backend/, env.py lives in backend/alembic/
# The project root (where .env lives) is one level up from backend/
backend_dir = str(Path(__file__).resolve().parent.parent)      # backend/
project_root = str(Path(backend_dir).parent)                    # CCM/
sys.path.insert(0, project_root)

# ── Load .env from project root BEFORE importing backend modules ──
# backend.config.Settings requires pydantic settings from .env
env_file = os.path.join(project_root, ".env")
if os.path.isfile(env_file):
    from dotenv import load_dotenv
    load_dotenv(env_file, override=False)
else:
    # Fallback: manually parse key=value lines
    if os.path.isfile(env_file):
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    os.environ.setdefault(key.strip(), val.strip())

# ── Import ORM metadata (triggers Base + all model registrations) ──
from backend.database import Base
import backend.models  # noqa: F401 — register all ORM models

# Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# MetaData for autogenerate support
target_metadata = Base.metadata

# Override sqlalchemy.url with the sync URL from env if available
DATABASE_DIRECT_URL = os.environ.get("DATABASE_DIRECT_URL")
if DATABASE_DIRECT_URL:
    config.set_main_option("sqlalchemy.url", DATABASE_DIRECT_URL)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        version_table_schema="public",
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with a connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
        version_table_schema="public",
        include_name=lambda name, type_, parent_names: name in (None, "public", "Master"),
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in async mode."""
    from sqlalchemy.ext.asyncio import create_async_engine

    async_url = os.environ.get(
        "DATABASE__URL",
        "postgresql+asyncpg://ccm:ccm_password@localhost:5432/ccm_db",
    )

    connectable = create_async_engine(
        async_url,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.execution_options(isolation_level="AUTOCOMMIT")
        from sqlalchemy import text
        await connection.execute(text("SET search_path TO Master, public"))
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
