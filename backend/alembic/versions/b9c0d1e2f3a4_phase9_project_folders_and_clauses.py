"""Phase 9: project folders and clause metadata for the knowledge base

- knowledge_documents.document_type  (contract_volume / outgoing_letter / incoming_letter)
- knowledge_documents.clause_count
- document_chunks.clause_no
- index on knowledge_documents (project_id, document_type)

Same idempotent DDL as the startup safety net in backend/database.py.

Revision ID: b9c0d1e2f3a4
Revises: 8744280b2d28
Create Date: 2026-10-08
"""
from typing import Union

from alembic import op

revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, None] = "8744280b2d28"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(30)")
    op.execute("ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS clause_count INTEGER DEFAULT 0")
    op.execute("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS clause_no VARCHAR(40)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_kd_project_type ON knowledge_documents (project_id, document_type)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_kd_project_type")
    op.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS clause_no")
    op.execute("ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS clause_count")
    op.execute("ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS document_type")
