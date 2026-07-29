"""Phase 2: Drop legacy empty tables + remove duplicate unique constraint

Revision ID: 9ce0a4ace0dd
Revises: 000_baseline
Create Date: 2026-07-27

Verified: All 13 legacy tables are EMPTY (0 rows) as of Phase 1 audit.
The duplicate unique constraint on role_permissions is redundant.
No data merge is needed — EAV has no overlapping data with canonical tables.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9ce0a4ace0dd'
down_revision: Union[str, None] = '000_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 13 legacy PascalCase tables — all confirmed empty (0 rows)
LEGACY_TABLES = [
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


def upgrade() -> None:
    # ── 1. Drop 13 legacy tables ──
    for table in LEGACY_TABLES:
        op.execute(f"DROP TABLE IF EXISTS public.{table} CASCADE")

    # ── 2. Drop orphaned sequences for legacy tables ──
    for table in LEGACY_TABLES:
        # Legacy sequences follow patterns like: master_user_UserId_seq
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_id_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_UserId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_RoleId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_ProjectMasterId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_ModuleGroupId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_ModuleId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_LookupId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_DesignationId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_DepartmentId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_LocationId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_UnitId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_RoleRightId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_UserRoleId_seq CASCADE")
        op.execute(f"DROP SEQUENCE IF EXISTS public.{table}_ProjectDetailsId_seq CASCADE")

    # ── 3. Drop duplicate unique constraint on role_permissions ──
    # Both (role_name, module_key) and (module_key, role_name) exist.
    # The ORM UniqueConstraint is named uq_role_permissions_role_module.
    # Drop whichever one exists:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_module_key_role_name_key') THEN
                ALTER TABLE "Master".role_permissions DROP CONSTRAINT role_permissions_module_key_role_name_key;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # NOTE: This downgrade recreates tables with EMPTY data.
    # The original data was migrated in _001_consolidate_master_data.py.
    # If you need the data back, run migration 001 against a backup.

    # ── 1. Recreate legacy tables (empty shells) ──
    for table in LEGACY_TABLES:
        op.execute(f"""
            CREATE TABLE IF NOT EXISTS public.{table} (
                id SERIAL PRIMARY KEY,
                data JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                status VARCHAR(10) DEFAULT '1',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

    # ── 2. Recreate the dropped unique constraint ──
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_module_key_role_name_key') THEN
                ALTER TABLE "Master".role_permissions
                    ADD CONSTRAINT role_permissions_module_key_role_name_key
                    UNIQUE (module_key, role_name);
            END IF;
        END $$;
    """)
