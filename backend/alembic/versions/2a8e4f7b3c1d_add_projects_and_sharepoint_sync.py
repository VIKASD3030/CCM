"""add projects table, project_id FKs, and sharepoint_sync_log

Revision ID: 2a8e4f7b3c1d
Revises: 157ef3ffa5c0
Create Date: 2026-06-30 12:00:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = '2a8e4f7b3c1d'
down_revision: Union[str, None] = '157ef3ffa5c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Create projects table (idempotent) ---
    op.execute(
        "CREATE TABLE IF NOT EXISTS projects ("
        "    id UUID NOT NULL,"
        "    name VARCHAR(255) NOT NULL,"
        "    sharepoint_site_id VARCHAR(500),"
        "    status VARCHAR(50) NOT NULL DEFAULT 'active',"
        "    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() at time zone 'utc'),"
        "    PRIMARY KEY (id)"
        ")"
    )

    # --- Create sharepoint_sync_log table (idempotent) ---
    op.execute(
        "CREATE TABLE IF NOT EXISTS sharepoint_sync_log ("
        "    id UUID NOT NULL,"
        "    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,"
        "    sync_status VARCHAR(50) NOT NULL DEFAULT 'running',"
        "    files_synced INTEGER,"
        "    files_deleted INTEGER,"
        "    error_message TEXT,"
        "    last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() at time zone 'utc'),"
        "    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() at time zone 'utc'),"
        "    PRIMARY KEY (id)"
        ")"
    )

    # --- Add project_id columns (idempotent) ---
    op.execute(
        "ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS project_id UUID "
        "REFERENCES projects(id) ON DELETE SET NULL"
    )
    op.execute(
        "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS project_id UUID "
        "REFERENCES projects(id) ON DELETE SET NULL"
    )
    op.execute(
        "ALTER TABLE draft_responses ADD COLUMN IF NOT EXISTS project_id UUID "
        "REFERENCES projects(id) ON DELETE SET NULL"
    )

    # --- Backfill: create Legacy project if not exists, then assign existing rows ---
    op.execute(
        "INSERT INTO projects (id, name, status, created_at) "
        "SELECT gen_random_uuid(), 'Legacy', 'active', (now() at time zone 'utc') "
        "WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Legacy')"
    )
    op.execute(
        "UPDATE inbound_letters SET project_id = (SELECT id FROM projects WHERE name = 'Legacy' LIMIT 1) "
        "WHERE project_id IS NULL"
    )
    op.execute(
        "UPDATE knowledge_documents SET project_id = (SELECT id FROM projects WHERE name = 'Legacy' LIMIT 1) "
        "WHERE project_id IS NULL"
    )
    op.execute(
        "UPDATE draft_responses SET project_id = (SELECT id FROM projects WHERE name = 'Legacy' LIMIT 1) "
        "WHERE project_id IS NULL"
    )


def downgrade() -> None:
    # Remove FKs and columns
    op.drop_constraint('fk_draft_responses_project', 'draft_responses', type_='foreignkey')
    op.drop_column('draft_responses', 'project_id')

    op.drop_constraint('fk_knowledge_documents_project', 'knowledge_documents', type_='foreignkey')
    op.drop_column('knowledge_documents', 'project_id')

    op.drop_constraint('fk_inbound_letters_project', 'inbound_letters', type_='foreignkey')
    op.drop_column('inbound_letters', 'project_id')

    op.drop_table('sharepoint_sync_log')
    op.drop_table('projects')
