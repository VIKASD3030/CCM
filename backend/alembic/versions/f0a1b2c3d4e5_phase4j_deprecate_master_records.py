"""Phase 4j: deprecate legacy master_records table

Revision ID: f0a1b2c3d4e5
Revises: ef5a6b7c8d90
Create Date: 2026-07-29
"""
from typing import Sequence, Union

from alembic import op


revision: str = "f0a1b2c3d4e5"
down_revision: Union[str, None] = "ef5a6b7c8d90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('DROP INDEX IF EXISTS "Master".ix_master_records_entity')
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'Master' AND table_name = 'master_records'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'Master' AND table_name = '_deprecated_master_records'
            ) THEN
                ALTER TABLE "Master".master_records RENAME TO _deprecated_master_records;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'Master' AND table_name = '_deprecated_master_records'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'Master' AND table_name = 'master_records'
            ) THEN
                ALTER TABLE "Master"._deprecated_master_records RENAME TO master_records;
            END IF;
        END $$;
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_master_records_entity ON "Master".master_records (entity)')
