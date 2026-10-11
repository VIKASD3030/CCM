"""Phase 10: OCR, reference linking, page numbers, richer classification, routing

Adds the columns behind: scanned-document OCR and original-file viewing,
correspondence metadata (ref no, date, subject, quoted references), clause page
numbers, file checksums, richer letter classification and project-routing
suggestions. Same idempotent DDL as the startup safety net in backend/database.py.

Revision ID: c1d2e3f4a5b6
Revises: b9c0d1e2f3a4
Create Date: 2026-10-12
"""
from typing import Union

from alembic import op

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b9c0d1e2f3a4"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None

DDL = [
    'ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS page_count INTEGER',
    'ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS ocr_pages INTEGER DEFAULT 0',
    'ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS status_detail TEXT',
    'ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS checksum VARCHAR(64)',
    'ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS ref_no VARCHAR(200)',
    'ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS doc_date DATE',
    'ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS subject TEXT',
    'ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS referenced_refs JSONB',
    'ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS volume_label VARCHAR(120)',
    'ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_from INTEGER',
    'ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_to INTEGER',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS domain_category VARCHAR(60)',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS posture VARCHAR(40)',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS scope VARCHAR(60)',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS kd_tags JSONB',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS requested_action TEXT',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS ref_no VARCHAR(200)',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS letter_date DATE',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS subject TEXT',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS referenced_refs JSONB',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500)',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS file_type VARCHAR(20)',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS page_count INTEGER',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS ocr_pages INTEGER DEFAULT 0',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS suggested_project_id UUID REFERENCES projects(id) ON DELETE SET NULL',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS routing_confidence DOUBLE PRECISION',
    'ALTER TABLE inbound_letters ADD COLUMN IF NOT EXISTS routing_reason TEXT',
    'CREATE INDEX IF NOT EXISTS ix_kd_project_checksum ON knowledge_documents (project_id, checksum)',
    'CREATE INDEX IF NOT EXISTS ix_kd_project_ref ON knowledge_documents (project_id, ref_no)',
    "CREATE INDEX IF NOT EXISTS ix_dc_fts ON document_chunks USING gin (to_tsvector('simple', chunk_text))",
]


def upgrade() -> None:
    for stmt in DDL:
        op.execute(stmt)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_dc_fts")
    op.execute("DROP INDEX IF EXISTS ix_kd_project_ref")
    op.execute("DROP INDEX IF EXISTS ix_kd_project_checksum")
    for table, cols in (
        ("inbound_letters", ["domain_category", "posture", "scope", "kd_tags", "requested_action", "ref_no",
                             "letter_date", "subject", "referenced_refs", "storage_path", "file_type", "page_count",
                             "ocr_pages", "suggested_project_id", "routing_confidence", "routing_reason"]),
        ("document_chunks", ["page_from", "page_to"]),
        ("knowledge_documents", ["page_count", "ocr_pages", "status_detail", "checksum", "ref_no", "doc_date",
                                 "subject", "referenced_refs", "volume_label"]),
    ):
        for c in cols:
            op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS {c}")
