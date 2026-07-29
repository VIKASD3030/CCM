"""Phase 4h: extract project detail and user-directory entities from EAV

Revision ID: de4f5a6b7c80
Revises: cd3e4f5a6b70
Create Date: 2026-07-29
"""
from typing import Sequence, Union

from alembic import op


revision: str = "de4f5a6b7c80"
down_revision: Union[str, None] = "cd3e4f5a6b70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".project_details (
            id BIGSERIAL PRIMARY KEY,
            project_id BIGINT,
            contract_id BIGINT,
            loa_date TIMESTAMPTZ,
            currency VARCHAR(100),
            start_date TIMESTAMPTZ,
            end_date TIMESTAMPTZ,
            original_contract_value NUMERIC(18, 4) DEFAULT 0,
            margin NUMERIC(18, 4) DEFAULT 0,
            client_name VARCHAR(255),
            contract_type VARCHAR(255),
            project_description TEXT,
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_project_details_project FOREIGN KEY (project_id) REFERENCES "Master".project_master(id),
            CONSTRAINT fk_project_details_contract FOREIGN KEY (contract_id) REFERENCES "Master".contracts(id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".user_directory (
            id BIGSERIAL PRIMARY KEY,
            legacy_id BIGINT DEFAULT 0,
            user_name VARCHAR(255),
            ad_user_name VARCHAR(255),
            employee_no VARCHAR(255),
            employee_name VARCHAR(255),
            designation_id BIGINT,
            department_id BIGINT,
            user_type VARCHAR(100),
            email_id VARCHAR(255),
            mobile_no VARCHAR(100),
            module_group_id BIGINT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            last_updated_by VARCHAR(100),
            last_updated_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_user_directory_designation FOREIGN KEY (designation_id) REFERENCES "Master".designations(id),
            CONSTRAINT fk_user_directory_department FOREIGN KEY (department_id) REFERENCES "Master".departments(id),
            CONSTRAINT fk_user_directory_module_group FOREIGN KEY (module_group_id) REFERENCES "Master".module_groups(id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".user_roles (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT,
            role_id BIGINT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES "Master".user_directory(id),
            CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES "Master".common_roles(id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".user_access_filters (
            id BIGSERIAL PRIMARY KEY,
            user_role_id BIGINT,
            user_id BIGINT,
            filter_type VARCHAR(50),
            filter_value VARCHAR(255),
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_user_access_filters_user_role FOREIGN KEY (user_role_id) REFERENCES "Master".user_roles(id),
            CONSTRAINT fk_user_access_filters_user FOREIGN KEY (user_id) REFERENCES "Master".user_directory(id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".approver_roles (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT,
            common_role_id BIGINT,
            approver_id BIGINT,
            remarks VARCHAR(1000),
            status VARCHAR(10) DEFAULT '1',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_approver_roles_user FOREIGN KEY (user_id) REFERENCES "Master".user_directory(id),
            CONSTRAINT fk_approver_roles_common_role FOREIGN KEY (common_role_id) REFERENCES "Master".common_roles(id),
            CONSTRAINT fk_approver_roles_approver FOREIGN KEY (approver_id) REFERENCES "Master".user_directory(id)
        )
        """
    )

    op.execute('CREATE INDEX IF NOT EXISTS ix_project_details_status ON "Master".project_details (status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_directory_status ON "Master".user_directory (status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_roles_status ON "Master".user_roles (status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_user_access_filters_status ON "Master".user_access_filters (status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_approver_roles_status ON "Master".approver_roles (status)')

    op.execute(
        """
        INSERT INTO "Master".project_details (
            id, project_id, contract_id, loa_date, currency, start_date, end_date,
            original_contract_value, margin, client_name, contract_type,
            project_description, remarks, status, created_by, created_date,
            locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            NULLIF(COALESCE(data->>'ProjectId', data->>'ProjectMasterId', '0'), '0')::BIGINT,
            NULLIF(COALESCE(data->>'ContractId', '0'), '0')::BIGINT,
            NULLIF(data->>'LOADate', '')::TIMESTAMPTZ,
            data->>'Currency',
            NULLIF(data->>'StartDate', '')::TIMESTAMPTZ,
            NULLIF(data->>'EndDate', '')::TIMESTAMPTZ,
            COALESCE(NULLIF(data->>'OriginalContractValue', ''), '0')::NUMERIC(18, 4),
            COALESCE(NULLIF(data->>'Margin', ''), '0')::NUMERIC(18, 4),
            data->>'ClientName',
            data->>'ContractType',
            data->>'ProjectDescription',
            data->>'Remarks',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'project_detail'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".user_directory (
            id, legacy_id, user_name, ad_user_name, employee_no, employee_name,
            designation_id, department_id, user_type, email_id, mobile_no,
            module_group_id, status, created_by, created_date, last_updated_by,
            last_updated_date, security_id, created_at
        )
        SELECT
            id,
            COALESCE(NULLIF(data->>'Id', ''), '0')::BIGINT,
            data->>'UserName',
            data->>'AdUserName',
            data->>'EmployeeNo',
            data->>'EmployeeName',
            NULLIF(COALESCE(data->>'DesignationId', '0'), '0')::BIGINT,
            NULLIF(COALESCE(data->>'DepartmentId', '0'), '0')::BIGINT,
            data->>'UserType',
            data->>'EmailId',
            data->>'MobileNo',
            NULLIF(COALESCE(data->>'ModuleGroupId', '0'), '0')::BIGINT,
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LastUpdatedBy',
            data->>'LastUpdatedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'user'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".user_roles (
            id, user_id, role_id, status, created_by, created_date,
            locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            NULLIF(COALESCE(data->>'UserId', '0'), '0')::BIGINT,
            NULLIF(COALESCE(data->>'RoleId', '0'), '0')::BIGINT,
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'user_role'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".user_access_filters (
            user_role_id, user_id, filter_type, filter_value, status,
            created_by, created_date, locked_by, locked_date, security_id, created_at
        )
        SELECT
            mr.id,
            NULLIF(COALESCE(mr.data->>'UserId', '0'), '0')::BIGINT,
            'BusinessUnit',
            value,
            COALESCE(mr.status, '1'),
            mr.data->>'CreatedBy',
            mr.data->>'CreatedDate',
            mr.data->>'LockedBy',
            mr.data->>'LockedDate',
            mr.data->>'SecurityId',
            mr.created_at
        FROM "Master".master_records mr
        CROSS JOIN LATERAL jsonb_array_elements_text(
            CASE
                WHEN jsonb_typeof(mr.data->'BusinessUnitIds') = 'array' THEN mr.data->'BusinessUnitIds'
                WHEN mr.data ? 'BusinessUnitIds' AND mr.data->'BusinessUnitIds' IS NOT NULL THEN jsonb_build_array(mr.data->'BusinessUnitIds')
                ELSE '[]'::jsonb
            END
        ) AS value
        WHERE mr.entity = 'user_role'
        """
    )

    op.execute(
        """
        INSERT INTO "Master".user_access_filters (
            user_role_id, user_id, filter_type, filter_value, status,
            created_by, created_date, locked_by, locked_date, security_id, created_at
        )
        SELECT
            mr.id,
            NULLIF(COALESCE(mr.data->>'UserId', '0'), '0')::BIGINT,
            'BusinessLine',
            value,
            COALESCE(mr.status, '1'),
            mr.data->>'CreatedBy',
            mr.data->>'CreatedDate',
            mr.data->>'LockedBy',
            mr.data->>'LockedDate',
            mr.data->>'SecurityId',
            mr.created_at
        FROM "Master".master_records mr
        CROSS JOIN LATERAL jsonb_array_elements_text(
            CASE
                WHEN jsonb_typeof(mr.data->'BusinessLineIds') = 'array' THEN mr.data->'BusinessLineIds'
                WHEN mr.data ? 'BusinessLineIds' AND mr.data->'BusinessLineIds' IS NOT NULL THEN jsonb_build_array(mr.data->'BusinessLineIds')
                ELSE '[]'::jsonb
            END
        ) AS value
        WHERE mr.entity = 'user_role'
        """
    )

    op.execute(
        """
        INSERT INTO "Master".user_access_filters (
            user_role_id, user_id, filter_type, filter_value, status,
            created_by, created_date, locked_by, locked_date, security_id, created_at
        )
        SELECT
            mr.id,
            NULLIF(COALESCE(mr.data->>'UserId', '0'), '0')::BIGINT,
            'Project',
            value,
            COALESCE(mr.status, '1'),
            mr.data->>'CreatedBy',
            mr.data->>'CreatedDate',
            mr.data->>'LockedBy',
            mr.data->>'LockedDate',
            mr.data->>'SecurityId',
            mr.created_at
        FROM "Master".master_records mr
        CROSS JOIN LATERAL jsonb_array_elements_text(
            CASE
                WHEN jsonb_typeof(mr.data->'ProjectIds') = 'array' THEN mr.data->'ProjectIds'
                WHEN mr.data ? 'ProjectIds' AND mr.data->'ProjectIds' IS NOT NULL THEN jsonb_build_array(mr.data->'ProjectIds')
                ELSE '[]'::jsonb
            END
        ) AS value
        WHERE mr.entity = 'user_role'
        """
    )

    op.execute(
        """
        INSERT INTO "Master".approver_roles (
            id, user_id, common_role_id, approver_id, remarks, status, created_at
        )
        SELECT
            id,
            NULLIF(COALESCE(data->>'UserId', '0'), '0')::BIGINT,
            NULLIF(COALESCE(data->>'CommonRoleId', data->>'AssignedRoleId', '0'), '0')::BIGINT,
            NULLIF(COALESCE(data->>'ApproverId', '0'), '0')::BIGINT,
            data->>'Remarks',
            COALESCE(status, '1'),
            created_at
        FROM "Master".master_records
        WHERE entity = 'approver_role'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '9'
        WHERE entity IN ('project_detail', 'user', 'user_role', 'user_access_filter', 'approver_role')
        """
    )

    for table_name in ('project_details', 'user_directory', 'user_roles', 'user_access_filters', 'approver_roles'):
        op.execute(
            f"""
            SELECT setval(
                pg_get_serial_sequence('"Master".{table_name}', 'id'),
                COALESCE((SELECT MAX(id) FROM "Master".{table_name}), 1)
            )
            """
        )


def downgrade() -> None:
    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'project_detail',
            jsonb_build_object(
                'ProjectId', COALESCE(project_id, 0),
                'ContractId', COALESCE(contract_id, 0),
                'LOADate', to_char(loa_date, 'YYYY-MM-DD HH24:MI:SS'),
                'Currency', currency,
                'StartDate', to_char(start_date, 'YYYY-MM-DD HH24:MI:SS'),
                'EndDate', to_char(end_date, 'YYYY-MM-DD HH24:MI:SS'),
                'OriginalContractValue', COALESCE(original_contract_value, 0),
                'Margin', COALESCE(margin, 0),
                'ClientName', client_name,
                'ContractType', contract_type,
                'ProjectDescription', project_description,
                'Remarks', remarks,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id,
                'ProjectDetailsId', id
            ),
            status,
            created_at
        FROM "Master".project_details
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'user',
            jsonb_build_object(
                'Id', COALESCE(legacy_id, 0),
                'UserName', user_name,
                'AdUserName', ad_user_name,
                'EmployeeNo', employee_no,
                'EmployeeName', employee_name,
                'DesignationId', COALESCE(designation_id, 0),
                'DepartmentId', COALESCE(department_id, 0),
                'UserType', user_type,
                'EmailId', email_id,
                'MobileNo', mobile_no,
                'ModuleGroupId', COALESCE(module_group_id, 0),
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LastUpdatedBy', last_updated_by,
                'LastUpdatedDate', last_updated_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".user_directory
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            ur.id,
            'user_role',
            jsonb_build_object(
                'UserId', COALESCE(ur.user_id, 0),
                'RoleId', COALESCE(ur.role_id, 0),
                'BusinessUnitIds', COALESCE((SELECT jsonb_agg(filter_value) FROM "Master".user_access_filters uaf WHERE uaf.user_role_id = ur.id AND uaf.filter_type = 'BusinessUnit' AND uaf.status != '9'), '[]'::jsonb),
                'BusinessLineIds', COALESCE((SELECT jsonb_agg(filter_value) FROM "Master".user_access_filters uaf WHERE uaf.user_role_id = ur.id AND uaf.filter_type = 'BusinessLine' AND uaf.status != '9'), '[]'::jsonb),
                'ProjectIds', COALESCE((SELECT jsonb_agg(filter_value) FROM "Master".user_access_filters uaf WHERE uaf.user_role_id = ur.id AND uaf.filter_type = 'Project' AND uaf.status != '9'), '[]'::jsonb),
                'CreatedBy', ur.created_by,
                'CreatedDate', ur.created_date,
                'LockedBy', ur.locked_by,
                'LockedDate', ur.locked_date,
                'SecurityId', ur.security_id
            ),
            ur.status,
            ur.created_at
        FROM "Master".user_roles ur
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'approver_role',
            jsonb_build_object(
                'UserId', COALESCE(user_id, 0),
                'CommonRoleId', COALESCE(common_role_id, 0),
                'ApproverId', COALESCE(approver_id, 0),
                'Remarks', remarks
            ),
            status,
            created_at
        FROM "Master".approver_roles
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '1'
        WHERE entity IN ('project_detail', 'user', 'user_role', 'user_access_filter', 'approver_role')
        """
    )

    op.execute('DROP TABLE IF EXISTS "Master".approver_roles')
    op.execute('DROP TABLE IF EXISTS "Master".user_access_filters')
    op.execute('DROP TABLE IF EXISTS "Master".user_roles')
    op.execute('DROP TABLE IF EXISTS "Master".user_directory')
    op.execute('DROP TABLE IF EXISTS "Master".project_details')
