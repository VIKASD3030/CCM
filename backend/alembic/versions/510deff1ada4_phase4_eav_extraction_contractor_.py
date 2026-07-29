"""Phase 4: EAV extraction — contractor and project_master to proper tables

Revision ID: 510deff1ada4
Revises: c3d4e5f6a7b8
Create Date: 2026-07-27

Extracts contractor and project_master from the EAV master_records table
into proper relational tables. Preserves IDs for data continuity.

Steps:
  1. Create Master.contractors table
  2. Create Master.project_master table
  3. Migrate existing EAV data into the new tables
  4. Mark migrated EAV rows as status='9' (soft-deleted)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '510deff1ada4'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ════════════════════════════════════════════════════════════════════════
    # 1. Create Master.contractors table
    # ════════════════════════════════════════════════════════════════════════
    op.execute("""
        CREATE TABLE IF NOT EXISTS "Master".contractors (
            id BIGSERIAL PRIMARY KEY,
            contractor_code VARCHAR(100) NOT NULL,
            contractor_name VARCHAR(200) NOT NULL,
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            file_name VARCHAR(500),
            document_path VARCHAR(500),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute('CREATE INDEX IF NOT EXISTS ix_contractors_code ON "Master".contractors (contractor_code)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_contractors_status ON "Master".contractors (status)')

    # ════════════════════════════════════════════════════════════════════════
    # 2. Create Master.project_master table
    # ════════════════════════════════════════════════════════════════════════
    op.execute("""
        CREATE TABLE IF NOT EXISTS "Master".project_master (
            id BIGSERIAL PRIMARY KEY,
            project_code VARCHAR(100) NOT NULL,
            project_name VARCHAR(200) NOT NULL,
            client_name VARCHAR(200),
            business_unit VARCHAR(200),
            business_line VARCHAR(100),
            project_manager_id VARCHAR(100),
            project_director_id VARCHAR(100),
            pmo_id VARCHAR(100),
            parent_project_master_id VARCHAR(20) DEFAULT '0',
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute('CREATE INDEX IF NOT EXISTS ix_project_master_code ON "Master".project_master (project_code)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_project_master_status ON "Master".project_master (status)')

    # ════════════════════════════════════════════════════════════════════════
    # 3. Migrate EAV data — contractor
    #    EAV data is stored as JSONB with PascalCase keys.
    # ════════════════════════════════════════════════════════════════════════
    op.execute("""
        INSERT INTO "Master".contractors 
            (id, contractor_code, contractor_name, remarks, status, 
             created_by, created_date, locked_by, locked_date, security_id,
             file_name, document_path, created_at)
        SELECT 
            id,
            COALESCE(data->>'ContractorCode', ''),
            COALESCE(data->>'ContractorName', ''),
            data->>'Remarks',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            data->>'FileName',
            data->>'DocumentPath',
            created_at
        FROM "Master".master_records
        WHERE entity = 'contractor'
        ON CONFLICT DO NOTHING
    """)

    # ════════════════════════════════════════════════════════════════════════
    # 4. Migrate EAV data — project_master
    # ════════════════════════════════════════════════════════════════════════
    op.execute("""
        INSERT INTO "Master".project_master
            (id, project_code, project_name, client_name, business_unit,
             business_line, project_manager_id, project_director_id, pmo_id,
             parent_project_master_id, remarks, status,
             created_by, created_date, locked_by, locked_date, security_id,
             created_at)
        SELECT 
            id,
            COALESCE(data->>'ProjectCode', ''),
            COALESCE(data->>'ProjectName', ''),
            data->>'ClientName',
            data->>'BusinessUnit',
            data->>'BusinessLine',
            data->>'ProjectManagerId',
            data->>'ProjectDirectorId',
            data->>'PMOID',
            COALESCE(data->>'ParentProjectMasterId', '0'),
            data->>'Remarks',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'project_master'
        ON CONFLICT DO NOTHING
    """)

    # ════════════════════════════════════════════════════════════════════════
    # 5. Soft-delete migrated EAV rows
    # ════════════════════════════════════════════════════════════════════════
    op.execute("""
        UPDATE "Master".master_records 
        SET status = '9' 
        WHERE entity IN ('contractor', 'project_master')
    """)

    # Reset sequences to max id + 1
    op.execute("""
        SELECT setval(pg_get_serial_sequence('"Master".contractors', 'id'), 
                       COALESCE((SELECT MAX(id) FROM "Master".contractors), 1))
    """)
    op.execute("""
        SELECT setval(pg_get_serial_sequence('"Master".project_master', 'id'), 
                       COALESCE((SELECT MAX(id) FROM "Master".project_master), 1))
    """)


def downgrade() -> None:
    # Restore EAV rows from proper tables
    op.execute("""
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT id, 'contractor', 
               jsonb_build_object(
                   'ContractorCode', contractor_code,
                   'ContractorName', contractor_name,
                   'Remarks', remarks,
                   'CreatedBy', created_by,
                   'CreatedDate', created_date,
                   'LockedBy', locked_by,
                   'LockedDate', locked_date,
                   'SecurityId', security_id,
                   'FileName', file_name,
                   'DocumentPath', document_path
               ),
               status, created_at
        FROM "Master".contractors
    """)

    op.execute("""
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT id, 'project_master',
               jsonb_build_object(
                   'ProjectCode', project_code,
                   'ProjectName', project_name,
                   'ClientName', client_name,
                   'BusinessUnit', business_unit,
                   'BusinessLine', business_line,
                   'ProjectManagerId', project_manager_id,
                   'ProjectDirectorId', project_director_id,
                   'PMOID', pmo_id,
                   'ParentProjectMasterId', parent_project_master_id,
                   'Remarks', remarks,
                   'CreatedBy', created_by,
                   'CreatedDate', created_date,
                   'LockedBy', locked_by,
                   'LockedDate', locked_date,
                   'SecurityId', security_id
               ),
               status, created_at
        FROM "Master".project_master
    """)

    # Drop proper tables
    op.execute('DROP TABLE IF EXISTS "Master".contractors')
    op.execute('DROP TABLE IF EXISTS "Master".project_master')

    # Restore EAV status
    op.execute("""
        UPDATE "Master".master_records 
        SET status = '1' 
        WHERE entity IN ('contractor', 'project_master')
    """)
