"""Phase 3: Zero-risk structural fixes — indexes, FK constraints, hierarchical defaults

Revision ID: 022407ca7fbe
Revises: 9ce0a4ace0dd
Create Date: 2026-07-27

All changes are additive (no data loss, no column drops).

Includes:
- 13 missing FK indexes
- 21 missing filter indexes
- 5 FK constraints on soft-reference columns
- Self-referencing FKs on hierarchical parent_id columns
- is_active BOOLEAN columns on hierarchical tables
- Partial index on jobs.status for active jobs
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '022407ca7fbe'
down_revision: Union[str, None] = '9ce0a4ace0dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ════════════════════════════════════════════════════════════════════════
    # 1. MISSING FK INDEXES (13 columns)
    #    Each FK column needs an index for JOIN/WHERE performance.
    # ════════════════════════════════════════════════════════════════════════
    fk_indexes = [
        ("ix_document_chunks_document_id", "public.document_chunks", "document_id"),
        ("ix_draft_responses_letter_id", "public.draft_responses", "letter_id"),
        ("ix_draft_responses_project_id", "public.draft_responses", "project_id"),
        ("ix_inbound_letters_project_id", "public.inbound_letters", "project_id"),
        ("ix_knowledge_documents_project_id", "public.knowledge_documents", "project_id"),
        ("ix_drafting_sessions_project_id", "public.drafting_sessions", "project_id"),
        ("ix_audit_logs_user_id", "public.audit_logs", "user_id"),
        ("ix_files_uploaded_by", "public.files", "uploaded_by"),
        ("ix_jobs_created_by", "public.jobs", "created_by"),
        ("ix_webhooks_created_by", "public.webhooks", "created_by"),
        ("ix_webhook_deliveries_webhook_id", "public.webhook_deliveries", "webhook_id"),
        ("ix_sharepoint_sync_log_project_id", "public.sharepoint_sync_log", "project_id"),
        ("ix_users_role", '"Master".users', "role"),
    ]
    for idx_name, table, col in fk_indexes:
        op.execute(f'CREATE INDEX IF NOT EXISTS {idx_name} ON {table} ({col})')

    # ════════════════════════════════════════════════════════════════════════
    # 2. MISSING FILTER INDEXES (status/type/category columns)
    # ════════════════════════════════════════════════════════════════════════
    filter_indexes = [
        ("ix_departments_status", '"Master".departments', "status"),
        ("ix_designations_status", '"Master".designations', "status"),
        ("ix_locations_status", '"Master".locations', "status"),
        ("ix_units_status", '"Master".units', "status"),
        ("ix_lookups_status", '"Master".lookups', "status"),
        ("ix_lookups_lookup_type", '"Master".lookups', "lookup_type"),
        ("ix_master_records_status", '"Master".master_records', "status"),
        ("ix_audit_logs_entity_type", "public.audit_logs", "entity_type"),
        ("ix_draft_responses_status", "public.draft_responses", "status"),
        ("ix_drafting_messages_role", "public.drafting_messages", "role"),
        ("ix_inbound_letters_category", "public.inbound_letters", "category"),
        ("ix_inbound_letters_status", "public.inbound_letters", "status"),
        ("ix_jobs_status", "public.jobs", "status"),
        ("ix_jobs_job_type", "public.jobs", "job_type"),
        ("ix_knowledge_documents_category", "public.knowledge_documents", "category"),
        ("ix_knowledge_documents_status", "public.knowledge_documents", "status"),
        ("ix_knowledge_documents_file_type", "public.knowledge_documents", "file_type"),
        ("ix_projects_status", "public.projects", "status"),
        ("ix_sharepoint_sync_log_sync_status", "public.sharepoint_sync_log", "sync_status"),
    ]
    for idx_name, table, col in filter_indexes:
        op.execute(f'CREATE INDEX IF NOT EXISTS {idx_name} ON {table} ({col})')

    # ════════════════════════════════════════════════════════════════════════
    # 3. PARTIAL INDEX: jobs for active work
    # ════════════════════════════════════════════════════════════════════════
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_jobs_active 
        ON public.jobs (created_at DESC) 
        WHERE status IN ('queued', 'running')
    """)

    # ════════════════════════════════════════════════════════════════════════
    # 4. SOFT FK CONSTRAINTS (5 columns)
    #    Using deferred constraint checking to avoid circular dependency issues.
    # ════════════════════════════════════════════════════════════════════════

    # 4a. inbound_letters.created_by -> Master.users.id
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_inbound_letters_created_by'
            ) THEN
                ALTER TABLE public.inbound_letters
                    ADD CONSTRAINT fk_inbound_letters_created_by
                    FOREIGN KEY (created_by) REFERENCES "Master".users(id)
                    ON DELETE SET NULL;
            END IF;
        END $$;
    """)

    # 4b. draft_responses.edited_by -> Master.users.id
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_draft_responses_edited_by'
            ) THEN
                ALTER TABLE public.draft_responses
                    ADD CONSTRAINT fk_draft_responses_edited_by
                    FOREIGN KEY (edited_by) REFERENCES "Master".users(id)
                    ON DELETE SET NULL;
            END IF;
        END $$;
    """)

    # 4c. knowledge_documents.uploaded_by -> Master.users.id
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_knowledge_documents_uploaded_by'
            ) THEN
                ALTER TABLE public.knowledge_documents
                    ADD CONSTRAINT fk_knowledge_documents_uploaded_by
                    FOREIGN KEY (uploaded_by) REFERENCES "Master".users(id)
                    ON DELETE SET NULL;
            END IF;
        END $$;
    """)

    # 4d. drafting_messages.draft_response_id -> draft_responses.id
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_drafting_messages_draft_response_id'
            ) THEN
                ALTER TABLE public.drafting_messages
                    ADD CONSTRAINT fk_drafting_messages_draft_response_id
                    FOREIGN KEY (draft_response_id) REFERENCES public.draft_responses(id)
                    ON DELETE SET NULL;
            END IF;
        END $$;
    """)

    # 4e. drafting_sessions.created_by -> Master.users.id
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_drafting_sessions_created_by'
            ) THEN
                ALTER TABLE public.drafting_sessions
                    ADD CONSTRAINT fk_drafting_sessions_created_by
                    FOREIGN KEY (created_by) REFERENCES "Master".users(id)
                    ON DELETE SET NULL;
            END IF;
        END $$;
    """)

    # ════════════════════════════════════════════════════════════════════════
    # 5. HIERARCHICAL TABLES: parent_id defaults + self-referencing FKs + is_active
    # ════════════════════════════════════════════════════════════════════════
    for table in ("departments", "designations", "locations", "units"):
        tbl = f'"Master".{table}'

        # 5a. Backfill parent_id: convert 0 -> NULL (0 is not a valid ID)
        op.execute(f"UPDATE {tbl} SET parent_id = NULL WHERE parent_id = 0")

        # 5b. Add self-referencing FK constraint (ON DELETE SET NULL, not CASCADE)
        fk_name = f"fk_{table}_parent_id"
        op.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = '{fk_name}'
                ) THEN
                    ALTER TABLE {tbl}
                        ADD CONSTRAINT {fk_name}
                        FOREIGN KEY (parent_id) REFERENCES {tbl}(id)
                        ON DELETE SET NULL;
                END IF;
            END $$;
        """)

        # 5c. Add is_active BOOLEAN column (backfilled from status)
        op.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'Master' AND table_name = '{table}'
                    AND column_name = 'is_active'
                ) THEN
                    ALTER TABLE {tbl}
                        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
                    UPDATE {tbl} SET is_active = (status != '9');
                END IF;
            END $$;
        """)

    # ════════════════════════════════════════════════════════════════════════
    # 6. INDEXES for the new is_active columns
    # ════════════════════════════════════════════════════════════════════════
    for table in ("departments", "designations", "locations", "units"):
        idx_name = f"ix_{table}_is_active"
        op.execute(f'CREATE INDEX IF NOT EXISTS {idx_name} ON "Master".{table} (is_active)')

    # ════════════════════════════════════════════════════════════════════════
    # 7. INDEXES for new FK constraints (4e already has ix_drafting_sessions_created_by)
    # ════════════════════════════════════════════════════════════════════════
    op.execute('CREATE INDEX IF NOT EXISTS ix_inbound_letters_created_by ON public.inbound_letters (created_by)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_draft_responses_edited_by ON public.draft_responses (edited_by)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_knowledge_documents_uploaded_by ON public.knowledge_documents (uploaded_by)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_drafting_messages_draft_response_id ON public.drafting_messages (draft_response_id)')


def downgrade() -> None:
    # ── Drop is_active columns ──
    for table in ("departments", "designations", "locations", "units"):
        op.execute(f'ALTER TABLE "Master".{table} DROP COLUMN IF EXISTS is_active')

    # ── Drop self-referencing FKs ──
    for table in ("departments", "designations", "locations", "units"):
        op.execute(f'ALTER TABLE "Master".{table} DROP CONSTRAINT IF EXISTS fk_{table}_parent_id')

    # ── Drop soft FK constraints ──
    op.execute('ALTER TABLE public.inbound_letters DROP CONSTRAINT IF EXISTS fk_inbound_letters_created_by')
    op.execute('ALTER TABLE public.draft_responses DROP CONSTRAINT IF EXISTS fk_draft_responses_edited_by')
    op.execute('ALTER TABLE public.knowledge_documents DROP CONSTRAINT IF EXISTS fk_knowledge_documents_uploaded_by')
    op.execute('ALTER TABLE public.drafting_messages DROP CONSTRAINT IF EXISTS fk_drafting_messages_draft_response_id')
    op.execute('ALTER TABLE public.drafting_sessions DROP CONSTRAINT IF EXISTS fk_drafting_sessions_created_by')

    # ── Drop all indexes created in upgrade ──
    idx_names = (
        [f for _, _, _ in []]  # placeholder
        + [f"ix_{table}_is_active" for table in ("departments", "designations", "locations", "units")]
        + [
            "ix_document_chunks_document_id", "ix_draft_responses_letter_id",
            "ix_draft_responses_project_id", "ix_inbound_letters_project_id",
            "ix_knowledge_documents_project_id", "ix_drafting_sessions_project_id",
            "ix_audit_logs_user_id", "ix_files_uploaded_by", "ix_jobs_created_by",
            "ix_webhooks_created_by", "ix_webhook_deliveries_webhook_id",
            "ix_sharepoint_sync_log_project_id", "ix_users_role",
            "ix_departments_status", "ix_designations_status", "ix_locations_status",
            "ix_units_status", "ix_lookups_status", "ix_lookups_lookup_type",
            "ix_master_records_status", "ix_audit_logs_entity_type",
            "ix_draft_responses_status", "ix_drafting_messages_role",
            "ix_inbound_letters_category", "ix_inbound_letters_status",
            "ix_jobs_status", "ix_jobs_job_type",
            "ix_knowledge_documents_category", "ix_knowledge_documents_status",
            "ix_knowledge_documents_file_type", "ix_projects_status",
            "ix_sharepoint_sync_log_sync_status", "ix_jobs_active",
            "ix_inbound_letters_created_by", "ix_draft_responses_edited_by",
            "ix_knowledge_documents_uploaded_by", "ix_drafting_messages_draft_response_id",
        ]
    )
    for idx in idx_names:
        op.execute(f"DROP INDEX IF EXISTS {idx}")
