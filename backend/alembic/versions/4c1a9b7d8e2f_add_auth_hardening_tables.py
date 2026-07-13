"""add auth hardening tables and user audit columns

Revision ID: 4c1a9b7d8e2f
Revises: 3b7f9c2d4e5a
Create Date: 2026-07-10 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "4c1a9b7d8e2f"
down_revision: Union[str, None] = "3b7f9c2d4e5a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip INET")

    op.execute(
        "CREATE TABLE IF NOT EXISTS password_reset_tokens ("
        "    id UUID NOT NULL DEFAULT gen_random_uuid(),"
        "    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,"
        "    token_hash VARCHAR(255) NOT NULL,"
        "    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,"
        "    used BOOLEAN NOT NULL DEFAULT FALSE,"
        "    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),"
        "    PRIMARY KEY (id)"
        ")"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_token_hash "
        "ON password_reset_tokens (token_hash)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id "
        "ON password_reset_tokens (user_id)"
    )

    op.execute(
        "CREATE TABLE IF NOT EXISTS revoked_tokens ("
        "    id UUID NOT NULL DEFAULT gen_random_uuid(),"
        "    jti UUID NOT NULL,"
        "    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,"
        "    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),"
        "    PRIMARY KEY (id),"
        "    UNIQUE (jti)"
        ")"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_revoked_tokens_expires_at "
        "ON revoked_tokens (expires_at)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS revoked_tokens")
    op.execute("DROP TABLE IF EXISTS password_reset_tokens")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_login_ip")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_login_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS locked_until")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS failed_login_attempts")
