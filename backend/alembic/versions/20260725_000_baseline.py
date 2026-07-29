"""Baseline: stamp current schema state

Revision ID: 000_baseline
Revises: 
Create Date: 2026-07-25

This is an empty baseline migration. It does NOT create or alter any tables.
It exists solely to establish the initial Alembic version pointer so that all
future migrations are tracked relative to the actual current schema.

The current schema was verified by direct SQL audit on 2026-07-25:
- Master schema: 10 tables (users, roles, modules, role_permissions, departments,
  designations, locations, units, lookups, master_records)
- public schema: 31 tables (27 active CCM/utility + 13 legacy empty + alembic_version)
- 19 FK constraints, 7 non-PK indexes, 2 CHECK constraints
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "000_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op: schema already exists. This is a baseline stamp."""
    pass


def downgrade() -> None:
    """No-op: cannot undo a baseline."""
    pass
