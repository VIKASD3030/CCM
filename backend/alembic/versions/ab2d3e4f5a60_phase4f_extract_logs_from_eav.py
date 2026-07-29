"""Phase 4f: extract user logs and error logs from EAV

Revision ID: ab2d3e4f5a60
Revises: 9c1e2f3a4b50
Create Date: 2026-07-29
"""
from typing import Sequence, Union

from alembic import op


revision: str = "ab2d3e4f5a60"
down_revision: Union[str, None] = "9c1e2f3a4b50"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".user_logs (
            id BIGSERIAL PRIMARY KEY,
            user_id VARCHAR(100),
            ip_address VARCHAR(100),
            mac_address VARCHAR(100),
            log_in_status INTEGER DEFAULT 0,
            login_date TIMESTAMPTZ,
            log_out_date TIMESTAMPTZ,
            token_value TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_logs_status ON "Master".user_logs (status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_logs_user_id ON "Master".user_logs (user_id)')

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".error_logs (
            id BIGSERIAL PRIMARY KEY,
            user_id VARCHAR(100),
            user_name VARCHAR(255),
            error_message TEXT,
            error_log_date TIMESTAMPTZ,
            status VARCHAR(10) DEFAULT '1',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_error_logs_status ON "Master".error_logs (status)')

    op.execute(
        """
        INSERT INTO "Master".user_logs (
            id, user_id, ip_address, mac_address, log_in_status, login_date,
            log_out_date, token_value, status, created_by, created_date,
            locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            data->>'UserId',
            data->>'IPAddress',
            data->>'MACAddress',
            COALESCE(NULLIF(data->>'LogInStatus', ''), '0')::INTEGER,
            NULLIF(data->>'LoginDate', '')::TIMESTAMPTZ,
            NULLIF(data->>'LogOutDate', '')::TIMESTAMPTZ,
            data->>'TokenValue',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'user_log'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".error_logs (
            id, user_id, user_name, error_message, error_log_date, status, created_at
        )
        SELECT
            id,
            data->>'UserId',
            data->>'UserName',
            data->>'ErrorMessage',
            NULLIF(COALESCE(data->>'ErrorLogDate', data->>'LogDate'), '')::TIMESTAMPTZ,
            COALESCE(status, '1'),
            created_at
        FROM "Master".master_records
        WHERE entity = 'error_log'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '9'
        WHERE entity IN ('user_log', 'error_log')
        """
    )

    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('"Master".user_logs', 'id'),
            COALESCE((SELECT MAX(id) FROM "Master".user_logs), 1)
        )
        """
    )
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('"Master".error_logs', 'id'),
            COALESCE((SELECT MAX(id) FROM "Master".error_logs), 1)
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'user_log',
            jsonb_build_object(
                'UserId', user_id,
                'IPAddress', ip_address,
                'MACAddress', mac_address,
                'LogInStatus', COALESCE(log_in_status, 0),
                'LoginDate', to_char(login_date, 'YYYY-MM-DD HH24:MI:SS'),
                'LogOutDate', to_char(log_out_date, 'YYYY-MM-DD HH24:MI:SS'),
                'TokenValue', token_value,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".user_logs
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'error_log',
            jsonb_build_object(
                'UserId', user_id,
                'UserName', user_name,
                'ErrorMessage', error_message,
                'ErrorLogDate', to_char(error_log_date, 'YYYY-MM-DD HH24:MI:SS')
            ),
            status,
            created_at
        FROM "Master".error_logs
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '1'
        WHERE entity IN ('user_log', 'error_log')
        """
    )

    op.execute('DROP TABLE IF EXISTS "Master".error_logs')
    op.execute('DROP TABLE IF EXISTS "Master".user_logs')
