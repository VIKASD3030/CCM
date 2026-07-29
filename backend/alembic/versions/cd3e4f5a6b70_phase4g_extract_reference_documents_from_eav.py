"""Phase 4g: extract reference documents from EAV

Revision ID: cd3e4f5a6b70
Revises: ab2d3e4f5a60
Create Date: 2026-07-29
"""
from typing import Sequence, Union

from alembic import op


revision: str = "cd3e4f5a6b70"
down_revision: Union[str, None] = "ab2d3e4f5a60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".reference_documents (
            id BIGSERIAL PRIMARY KEY,
            code VARCHAR(100),
            name VARCHAR(255),
            parent_id BIGINT,
            module_group_id BIGINT,
            file_name VARCHAR(500),
            document_path VARCHAR(1000),
            level INTEGER,
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_reference_documents_parent FOREIGN KEY (parent_id) REFERENCES "Master".reference_documents(id),
            CONSTRAINT fk_reference_documents_module_group FOREIGN KEY (module_group_id) REFERENCES "Master".module_groups(id)
        )
        """
    )
    op.execute('CREATE INDEX IF NOT EXISTS ix_reference_documents_status ON "Master".reference_documents (status)')

    op.execute(
        """
        INSERT INTO "Master".reference_documents (
            id, code, name, parent_id, module_group_id, file_name, document_path,
            level, remarks, status, created_by, created_date, locked_by,
            locked_date, security_id, created_at
        )
        SELECT
            id,
            data->>'DocumentCode',
            data->>'DocumentName',
            NULLIF(COALESCE(data->>'ParentDocumentId', '0'), '0')::BIGINT,
            NULLIF(COALESCE(data->>'ModuleGroupId', '0'), '0')::BIGINT,
            data->>'FileName',
            data->>'DocumentPath',
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
        WHERE entity = 'reference_document'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '9'
        WHERE entity = 'reference_document'
        """
    )

    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('"Master".reference_documents', 'id'),
            COALESCE((SELECT MAX(id) FROM "Master".reference_documents), 1)
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'reference_document',
            jsonb_build_object(
                'DocumentCode', code,
                'DocumentName', name,
                'ParentDocumentId', COALESCE(parent_id, 0),
                'ModuleGroupId', COALESCE(module_group_id, 0),
                'FileName', file_name,
                'DocumentPath', document_path,
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
        FROM "Master".reference_documents
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '1'
        WHERE entity = 'reference_document'
        """
    )

    op.execute('DROP TABLE IF EXISTS "Master".reference_documents')
