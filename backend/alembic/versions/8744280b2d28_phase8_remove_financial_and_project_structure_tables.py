"""Phase 8: remove financial/commercial and project structure tables

Drop tables:
- estimation_months
- monthly_breakups
- variation_orders
- activities
- activity_groups
- work_packages
- reference_documents

Revision ID: 8744280b2d28
Revises: f0a1b2c3d4e5
Create Date: 2026-07-30
"""
from typing import Union

from alembic import op

revision: str = "8744280b2d28"
down_revision: Union[str, None] = "f0a1b2c3d4e5"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    # Drop in reverse FK dependency order
    op.execute('DROP TABLE IF EXISTS "Master".estimation_months')
    op.execute('DROP TABLE IF EXISTS "Master".monthly_breakups')
    op.execute('DROP TABLE IF EXISTS "Master".variation_orders')
    op.execute('DROP TABLE IF EXISTS "Master".activities')
    op.execute('DROP TABLE IF EXISTS "Master".activity_groups')
    op.execute('DROP TABLE IF EXISTS "Master".work_packages')
    op.execute('DROP TABLE IF EXISTS "Master".reference_documents')


def downgrade() -> None:
    # Tables will be recreated by running prior phase migrations.
    # This is a structural removal that cannot be meaningfully reversed
    # without re-running the extraction migrations.
    pass
