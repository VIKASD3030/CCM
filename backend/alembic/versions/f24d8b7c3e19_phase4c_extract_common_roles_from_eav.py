"""Phase 4c: extract common roles from EAV

Revision ID: f24d8b7c3e19
Revises: 61d0a1d5f3e2
Create Date: 2026-07-29

Creates dedicated tables for:
- role -> Master.common_roles
- role_right -> Master.role_rights

Migrates any matching rows from Master.master_records while preserving ids, then
soft-deletes the migrated EAV rows.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "f24d8b7c3e19"
down_revision: Union[str, None] = "61d0a1d5f3e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".common_roles (
            id BIGSERIAL PRIMARY KEY,
            code VARCHAR(100),
            name VARCHAR(255),
            parent_id BIGINT,
            level INTEGER,
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_common_roles_parent FOREIGN KEY (parent_id) REFERENCES "Master".common_roles(id)
        )
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_common_roles_code ON "Master".common_roles (code)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_common_roles_status ON "Master".common_roles (status)')

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".role_rights (
            id BIGSERIAL PRIMARY KEY,
            role_id BIGINT,
            module_id BIGINT,
            module_group_id BIGINT,
            parent_module_group_id BIGINT,
            user_shown_name VARCHAR(255),
            module_group_name VARCHAR(255),
            parent_module_group_name VARCHAR(255),
            right_status INTEGER DEFAULT 1,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_role_rights_role FOREIGN KEY (role_id) REFERENCES "Master".common_roles(id)
        )
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_role_rights_role_id ON "Master".role_rights (role_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_role_rights_module_id ON "Master".role_rights (module_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_role_rights_status ON "Master".role_rights (status)')

    op.execute(
        """
        INSERT INTO "Master".common_roles (
            id, code, name, parent_id, level, remarks, status,
            created_by, created_date, locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            data->>'RoleCode',
            data->>'RoleName',
            NULLIF(COALESCE(data->>'ParentRoleId', '0'), '0')::BIGINT,
            NULLIF(data->>'Level', '')::INTEGER,
            data->>'Remarks',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'role'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".role_rights (
            id, role_id, module_id, module_group_id, parent_module_group_id,
            user_shown_name, module_group_name, parent_module_group_name,
            right_status, status, created_by, created_date, locked_by,
            locked_date, security_id, created_at
        )
        SELECT
            id,
            NULLIF(COALESCE(data->>'RoleId', '0'), '0')::BIGINT,
            COALESCE(NULLIF(data->>'ModuleId', ''), '0')::BIGINT,
            COALESCE(NULLIF(data->>'ModuleGroupId', ''), '0')::BIGINT,
            COALESCE(NULLIF(data->>'ParentModuleGroupId', ''), '0')::BIGINT,
            data->>'UserShownName',
            data->>'ModuleGroupName',
            data->>'ParentModuleGroupName',
            COALESCE(NULLIF(data->>'RightStatus', ''), '1')::INTEGER,
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'role_right'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '9'
        WHERE entity IN ('role', 'role_right')
        """
    )

    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('"Master".common_roles', 'id'),
            COALESCE((SELECT MAX(id) FROM "Master".common_roles), 1)
        )
        """
    )
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('"Master".role_rights', 'id'),
            COALESCE((SELECT MAX(id) FROM "Master".role_rights), 1)
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'role',
            jsonb_build_object(
                'RoleCode', code,
                'RoleName', name,
                'ParentRoleId', COALESCE(parent_id, 0),
                'Level', level,
                'Remarks', remarks,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".common_roles
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'role_right',
            jsonb_build_object(
                'RoleId', COALESCE(role_id, 0),
                'ModuleId', COALESCE(module_id, 0),
                'ModuleGroupId', COALESCE(module_group_id, 0),
                'ParentModuleGroupId', COALESCE(parent_module_group_id, 0),
                'UserShownName', user_shown_name,
                'ModuleGroupName', module_group_name,
                'ParentModuleGroupName', parent_module_group_name,
                'RightStatus', COALESCE(right_status, 1),
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".role_rights
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '1'
        WHERE entity IN ('role', 'role_right')
        """
    )

    op.execute('DROP TABLE IF EXISTS "Master".role_rights')
    op.execute('DROP TABLE IF EXISTS "Master".common_roles')
