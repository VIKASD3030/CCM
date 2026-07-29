"""Phase 4b: extract activities from EAV

Revision ID: 61d0a1d5f3e2
Revises: 510deff1ada4
Create Date: 2026-07-29

Creates dedicated tables for:
- activity_group -> Master.activity_groups
- activity -> Master.activities
- work_package -> Master.work_packages

Migrates any matching rows from Master.master_records while preserving ids, then
soft-deletes the migrated EAV rows.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "61d0a1d5f3e2"
down_revision: Union[str, None] = "510deff1ada4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".activity_groups (
            id BIGSERIAL PRIMARY KEY,
            code VARCHAR(100),
            name VARCHAR(255),
            parent_id BIGINT,
            project_id BIGINT,
            contract_id BIGINT,
            location_id BIGINT,
            module_group_id BIGINT,
            quantity NUMERIC(18, 4) DEFAULT 0,
            weightage NUMERIC(18, 4) DEFAULT 0,
            start_date TIMESTAMPTZ,
            end_date TIMESTAMPTZ,
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_activity_groups_parent FOREIGN KEY (parent_id) REFERENCES "Master".activity_groups(id),
            CONSTRAINT fk_activity_groups_project FOREIGN KEY (project_id) REFERENCES "Master".project_master(id)
        )
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_activity_groups_project_id ON "Master".activity_groups (project_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_activity_groups_contract_id ON "Master".activity_groups (contract_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_activity_groups_status ON "Master".activity_groups (status)')

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".activities (
            id BIGSERIAL PRIMARY KEY,
            code VARCHAR(100),
            name VARCHAR(4000),
            activity_group_id BIGINT,
            project_id BIGINT,
            contract_id BIGINT,
            parent_id BIGINT,
            duration INTEGER DEFAULT 0,
            is_critical BOOLEAN DEFAULT FALSE,
            is_sub_activity BOOLEAN DEFAULT FALSE,
            quantity NUMERIC(18, 4) DEFAULT 0,
            weightage NUMERIC(18, 4) DEFAULT 0,
            start_date TIMESTAMPTZ,
            end_date TIMESTAMPTZ,
            remarks TEXT,
            unit_id BIGINT,
            reference_code VARCHAR(100),
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_activities_group FOREIGN KEY (activity_group_id) REFERENCES "Master".activity_groups(id),
            CONSTRAINT fk_activities_project FOREIGN KEY (project_id) REFERENCES "Master".project_master(id),
            CONSTRAINT fk_activities_parent FOREIGN KEY (parent_id) REFERENCES "Master".activities(id),
            CONSTRAINT fk_activities_unit FOREIGN KEY (unit_id) REFERENCES "Master".units(id)
        )
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_activities_group_id ON "Master".activities (activity_group_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_activities_project_id ON "Master".activities (project_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_activities_contract_id ON "Master".activities (contract_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_activities_status ON "Master".activities (status)')

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".work_packages (
            id BIGSERIAL PRIMARY KEY,
            code VARCHAR(100),
            name VARCHAR(255),
            parent_id BIGINT,
            project_id BIGINT,
            contract_id BIGINT,
            level INTEGER DEFAULT 0,
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_work_packages_parent FOREIGN KEY (parent_id) REFERENCES "Master".work_packages(id),
            CONSTRAINT fk_work_packages_project FOREIGN KEY (project_id) REFERENCES "Master".project_master(id)
        )
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_work_packages_project_id ON "Master".work_packages (project_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_work_packages_contract_id ON "Master".work_packages (contract_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_work_packages_status ON "Master".work_packages (status)')

    op.execute(
        """
        INSERT INTO "Master".activity_groups (
            id, code, name, parent_id, project_id, contract_id, location_id,
            module_group_id, quantity, weightage, start_date, end_date, remarks,
            status, created_by, created_date, locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            data->>'ActivityGroupCode',
            data->>'ActivityGroupName',
            COALESCE(NULLIF(data->>'ActivityGroupParentId', ''), '0')::BIGINT,
            COALESCE(NULLIF(COALESCE(data->>'ProjectId', data->>'ProjectMasterId'), ''), '0')::BIGINT,
            COALESCE(NULLIF(data->>'ContractId', ''), '0')::BIGINT,
            COALESCE(NULLIF(data->>'LocationId', ''), '0')::BIGINT,
            COALESCE(NULLIF(data->>'ModuleGroupId', ''), '0')::BIGINT,
            COALESCE(NULLIF(data->>'Quantity', ''), '0')::NUMERIC(18, 4),
            COALESCE(NULLIF(data->>'Weightage', ''), '0')::NUMERIC(18, 4),
            NULLIF(data->>'StartDate', '')::TIMESTAMPTZ,
            NULLIF(data->>'EndDate', '')::TIMESTAMPTZ,
            data->>'Remarks',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'activity_group'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".activities (
            id, code, name, activity_group_id, project_id, contract_id, parent_id,
            duration, is_critical, is_sub_activity, quantity, weightage, start_date,
            end_date, remarks, unit_id, reference_code, status, created_by,
            created_date, locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            data->>'ActivityCode',
            data->>'ActivityName',
            COALESCE(NULLIF(data->>'ActivityGroupId', ''), '0')::BIGINT,
            COALESCE(NULLIF(COALESCE(data->>'ProjectId', data->>'ProjectMasterId'), ''), '0')::BIGINT,
            COALESCE(NULLIF(data->>'ContractId', ''), '0')::BIGINT,
            COALESCE(NULLIF(data->>'ActivityParentId', ''), '0')::BIGINT,
            COALESCE(NULLIF(data->>'Duration', ''), '0')::INTEGER,
            COALESCE(NULLIF(data->>'IsCritical', ''), 'false')::BOOLEAN,
            COALESCE(NULLIF(data->>'IsSubActivity', ''), 'false')::BOOLEAN,
            COALESCE(NULLIF(data->>'Quantity', ''), '0')::NUMERIC(18, 4),
            COALESCE(NULLIF(data->>'Weightage', ''), '0')::NUMERIC(18, 4),
            NULLIF(data->>'StartDate', '')::TIMESTAMPTZ,
            NULLIF(data->>'EndDate', '')::TIMESTAMPTZ,
            data->>'Remarks',
            COALESCE(NULLIF(data->>'UnitId', ''), '0')::BIGINT,
            data->>'ReferenceCode',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'activity'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".work_packages (
            id, code, name, parent_id, project_id, contract_id, level, remarks,
            status, created_by, created_date, locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            data->>'WorkPackageCode',
            data->>'WorkPackageName',
            COALESCE(NULLIF(data->>'ParentWorkPackageId', ''), '0')::BIGINT,
            COALESCE(NULLIF(COALESCE(data->>'ProjectId', data->>'ProjectMasterId'), ''), '0')::BIGINT,
            COALESCE(NULLIF(data->>'ContractId', ''), '0')::BIGINT,
            COALESCE(NULLIF(data->>'Level', ''), '0')::INTEGER,
            data->>'Remarks',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'work_package'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '9'
        WHERE entity IN ('activity_group', 'activity', 'work_package')
        """
    )

    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('"Master".activity_groups', 'id'),
            COALESCE((SELECT MAX(id) FROM "Master".activity_groups), 1)
        )
        """
    )
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('"Master".activities', 'id'),
            COALESCE((SELECT MAX(id) FROM "Master".activities), 1)
        )
        """
    )
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('"Master".work_packages', 'id'),
            COALESCE((SELECT MAX(id) FROM "Master".work_packages), 1)
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'activity_group',
            jsonb_build_object(
                'ActivityGroupCode', code,
                'ActivityGroupName', name,
                'ActivityGroupParentId', COALESCE(parent_id, 0),
                'ProjectId', COALESCE(project_id, 0),
                'ContractId', COALESCE(contract_id, 0),
                'LocationId', COALESCE(location_id, 0),
                'ModuleGroupId', COALESCE(module_group_id, 0),
                'Quantity', COALESCE(quantity, 0),
                'Weightage', COALESCE(weightage, 0),
                'StartDate', to_char(start_date, 'YYYY-MM-DD HH24:MI:SS'),
                'EndDate', to_char(end_date, 'YYYY-MM-DD HH24:MI:SS'),
                'Remarks', remarks,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".activity_groups
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'activity',
            jsonb_build_object(
                'ActivityCode', code,
                'ActivityName', name,
                'ActivityGroupId', COALESCE(activity_group_id, 0),
                'ProjectId', COALESCE(project_id, 0),
                'ContractId', COALESCE(contract_id, 0),
                'ActivityParentId', COALESCE(parent_id, 0),
                'Duration', COALESCE(duration, 0),
                'IsCritical', COALESCE(is_critical, FALSE),
                'IsSubActivity', COALESCE(is_sub_activity, FALSE),
                'Quantity', COALESCE(quantity, 0),
                'Weightage', COALESCE(weightage, 0),
                'StartDate', to_char(start_date, 'YYYY-MM-DD HH24:MI:SS'),
                'EndDate', to_char(end_date, 'YYYY-MM-DD HH24:MI:SS'),
                'Remarks', remarks,
                'UnitId', COALESCE(unit_id, 0),
                'ReferenceCode', reference_code,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".activities
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'work_package',
            jsonb_build_object(
                'WorkPackageCode', code,
                'WorkPackageName', name,
                'ParentWorkPackageId', COALESCE(parent_id, 0),
                'ProjectId', COALESCE(project_id, 0),
                'ContractId', COALESCE(contract_id, 0),
                'Level', COALESCE(level, 0),
                'Remarks', remarks,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".work_packages
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '1'
        WHERE entity IN ('activity_group', 'activity', 'work_package')
        """
    )

    op.execute('DROP TABLE IF EXISTS "Master".activities')
    op.execute('DROP TABLE IF EXISTS "Master".activity_groups')
    op.execute('DROP TABLE IF EXISTS "Master".work_packages')
