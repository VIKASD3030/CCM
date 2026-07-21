"""
Migration 002: Drop master schema tables after data has been verified.

⚠️ Only run this AFTER migration 001 has completed successfully and you
have verified the data in the core tables.

Drops (in order, respecting FK dependencies):
- master_user_role, master_role_right, master_user, master_role
- master_project_details, master_project
- master_module, master_module_group
- master_lookup, master_designation, master_department, master_location, master_unit
"""

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = structlog.get_logger()

TABLES_TO_DROP = [
    "master_user_role",
    "master_role_right",
    "master_user",
    "master_role",
    "master_project_details",
    "master_project",
    "master_module",
    "master_module_group",
    "master_lookup",
    "master_designation",
    "master_department",
    "master_location",
    "master_unit",
]


async def run(conn: AsyncConnection) -> None:
    logger.info("migration.002.starting")

    for table in TABLES_TO_DROP:
        count = await _count_rows(conn, table)
        logger.info("migration.002.table", table=table, remaining_rows=count)

        await conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
        logger.info("migration.002.table_dropped", table=table)

    logger.info("migration.002.complete")


async def _count_rows(conn: AsyncConnection, table: str) -> int:
    try:
        result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
        return result.scalar() or 0
    except Exception:
        return -1
