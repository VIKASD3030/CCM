import asyncio
from logging.config import fileConfig
import sys
import os

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine, async_engine_from_config
from alembic import context

# Add the backend directory to the path so we can import our models
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Alembic Config object
config = context.config

# Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Model metadata
from backend.database import Base
from backend.models import *  # noqa: F401, F403
from backend.config import get_settings
target_metadata = Base.metadata

# Always use the app's actual DB config rather than the static URL in
# alembic.ini, so migrations never drift from whatever .env configures.
config.set_main_option("sqlalchemy.url", str(get_settings().database.url))


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    """Run migrations using an async engine."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    """Run migrations in 'online' mode using async engine."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
