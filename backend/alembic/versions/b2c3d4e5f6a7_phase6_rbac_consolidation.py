"""Phase 6: RBAC consolidation — drop duplicate unique constraint on role_permissions

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-27

Removes the redundant duplicate unique constraint on role_permissions(role_name, module_key).
Only one UNIQUE constraint is needed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the duplicate unique constraint.
    # Two exist: role_permissions_role_name_module_key_key (auto-generated)
    #            uq_role_permissions_role_module (explicitly created)
    # We keep the explicitly named one.
    op.execute("""
        ALTER TABLE "Master".role_permissions 
        DROP CONSTRAINT IF EXISTS role_permissions_role_name_module_key_key
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE "Master".role_permissions 
        ADD CONSTRAINT role_permissions_role_name_module_key_key 
        UNIQUE (role_name, module_key)
    """)
