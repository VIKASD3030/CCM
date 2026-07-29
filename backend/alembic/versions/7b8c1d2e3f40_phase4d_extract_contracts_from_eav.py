"""Phase 4d: extract contracts from EAV

Revision ID: 7b8c1d2e3f40
Revises: f24d8b7c3e19
Create Date: 2026-07-29

Creates Master.contracts and migrates any contract rows from Master.master_records.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "7b8c1d2e3f40"
down_revision: Union[str, None] = "f24d8b7c3e19"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".contracts (
            id BIGSERIAL PRIMARY KEY,
            contract_no VARCHAR(100),
            contract_name VARCHAR(255),
            project_id BIGINT,
            contractor_id BIGINT,
            contract_type VARCHAR(255),
            contract_start_date TIMESTAMPTZ,
            contract_end_date TIMESTAMPTZ,
            contract_value NUMERIC(18, 4) DEFAULT 0,
            section_value NUMERIC(18, 4) DEFAULT 0,
            client_name VARCHAR(255),
            consultant_name VARCHAR(255),
            short_description TEXT,
            remarks TEXT,
            file_name VARCHAR(500),
            document_path VARCHAR(1000),
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_contracts_project FOREIGN KEY (project_id) REFERENCES "Master".project_master(id),
            CONSTRAINT fk_contracts_contractor FOREIGN KEY (contractor_id) REFERENCES "Master".contractors(id)
        )
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_contracts_project_id ON "Master".contracts (project_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_contracts_contractor_id ON "Master".contracts (contractor_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_contracts_status ON "Master".contracts (status)')

    op.execute(
        """
        INSERT INTO "Master".contracts (
            id, contract_no, contract_name, project_id, contractor_id, contract_type,
            contract_start_date, contract_end_date, contract_value, section_value,
            client_name, consultant_name, short_description, remarks, file_name,
            document_path, status, created_by, created_date, locked_by, locked_date,
            security_id, created_at
        )
        SELECT
            id,
            data->>'ContractNo',
            data->>'ContractName',
            NULLIF(COALESCE(data->>'ProjectId', data->>'ProjectMasterId', '0'), '0')::BIGINT,
            NULLIF(COALESCE(data->>'ContractorId', '0'), '0')::BIGINT,
            data->>'ContractType',
            NULLIF(data->>'ContractStartDate', '')::TIMESTAMPTZ,
            NULLIF(data->>'ContractEndDate', '')::TIMESTAMPTZ,
            COALESCE(NULLIF(data->>'ContractValue', ''), '0')::NUMERIC(18, 4),
            COALESCE(NULLIF(data->>'SectionValue', ''), '0')::NUMERIC(18, 4),
            data->>'ClientName',
            data->>'ConsultantName',
            data->>'ShortDescription',
            data->>'Remarks',
            data->>'FileName',
            data->>'DocumentPath',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'contract'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '9'
        WHERE entity = 'contract'
        """
    )

    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('"Master".contracts', 'id'),
            COALESCE((SELECT MAX(id) FROM "Master".contracts), 1)
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'contract',
            jsonb_build_object(
                'ContractNo', contract_no,
                'ContractName', contract_name,
                'ProjectId', COALESCE(project_id, 0),
                'ContractorId', COALESCE(contractor_id, 0),
                'ContractType', contract_type,
                'ContractStartDate', to_char(contract_start_date, 'YYYY-MM-DD HH24:MI:SS'),
                'ContractEndDate', to_char(contract_end_date, 'YYYY-MM-DD HH24:MI:SS'),
                'ContractValue', COALESCE(contract_value, 0),
                'SectionValue', COALESCE(section_value, 0),
                'ClientName', client_name,
                'ConsultantName', consultant_name,
                'ShortDescription', short_description,
                'Remarks', remarks,
                'FileName', file_name,
                'DocumentPath', document_path,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".contracts
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '1'
        WHERE entity = 'contract'
        """
    )

    op.execute('DROP TABLE IF EXISTS "Master".contracts')
