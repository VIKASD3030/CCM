"""Phase 4e: extract module groups and ui modules from EAV

Revision ID: 9c1e2f3a4b50
Revises: 7b8c1d2e3f40
Create Date: 2026-07-29
"""
from typing import Sequence, Union

from alembic import op


revision: str = "9c1e2f3a4b50"
down_revision: Union[str, None] = "7b8c1d2e3f40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".module_groups (
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
            CONSTRAINT fk_module_groups_parent FOREIGN KEY (parent_id) REFERENCES "Master".module_groups(id)
        )
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_module_groups_status ON "Master".module_groups (status)')

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".ui_modules (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(255),
            user_shown_name VARCHAR(255),
            module_group_id BIGINT,
            parent_module_id BIGINT,
            level INTEGER,
            module_type VARCHAR(100),
            module_path VARCHAR(500),
            is_exact BOOLEAN DEFAULT FALSE,
            icon_type VARCHAR(100),
            icon_path VARCHAR(500),
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_ui_modules_group FOREIGN KEY (module_group_id) REFERENCES "Master".module_groups(id),
            CONSTRAINT fk_ui_modules_parent FOREIGN KEY (parent_module_id) REFERENCES "Master".ui_modules(id)
        )
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_ui_modules_group_id ON "Master".ui_modules (module_group_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_ui_modules_status ON "Master".ui_modules (status)')

    op.execute(
        """
        INSERT INTO "Master".module_groups (
            id, code, name, parent_id, level, remarks, status,
            created_by, created_date, locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            data->>'ModuleGroupCode',
            data->>'ModuleGroupName',
            NULLIF(COALESCE(data->>'ParentModuleGroupId', '0'), '0')::BIGINT,
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
        WHERE entity = 'module_group'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".ui_modules (
            id, name, user_shown_name, module_group_id, parent_module_id, level,
            module_type, module_path, is_exact, icon_type, icon_path, remarks,
            status, created_by, created_date, locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            data->>'ModuleName',
            data->>'UserShownName',
            NULLIF(COALESCE(data->>'ModuleGroupId', '0'), '0')::BIGINT,
            NULLIF(COALESCE(data->>'ParentModuleId', '0'), '0')::BIGINT,
            NULLIF(data->>'Level', '')::INTEGER,
            data->>'ModuleType',
            data->>'ModulePath',
            COALESCE(NULLIF(data->>'IsExact', ''), 'false')::BOOLEAN,
            data->>'IconType',
            data->>'IconPath',
            data->>'Remarks',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'ui_module'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '9'
        WHERE entity IN ('module_group', 'ui_module')
        """
    )

    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('"Master".module_groups', 'id'),
            COALESCE((SELECT MAX(id) FROM "Master".module_groups), 1)
        )
        """
    )
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('"Master".ui_modules', 'id'),
            COALESCE((SELECT MAX(id) FROM "Master".ui_modules), 1)
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'module_group',
            jsonb_build_object(
                'ModuleGroupCode', code,
                'ModuleGroupName', name,
                'ParentModuleGroupId', COALESCE(parent_id, 0),
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
        FROM "Master".module_groups
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'ui_module',
            jsonb_build_object(
                'ModuleName', name,
                'UserShownName', user_shown_name,
                'ModuleGroupId', COALESCE(module_group_id, 0),
                'ParentModuleId', COALESCE(parent_module_id, 0),
                'Level', level,
                'ModuleType', module_type,
                'ModulePath', module_path,
                'IsExact', COALESCE(is_exact, FALSE),
                'IconType', icon_type,
                'IconPath', icon_path,
                'Remarks', remarks,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".ui_modules
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '1'
        WHERE entity IN ('module_group', 'ui_module')
        """
    )

    op.execute('DROP TABLE IF EXISTS "Master".ui_modules')
    op.execute('DROP TABLE IF EXISTS "Master".module_groups')
