"""add drafting_sessions, drafting_messages, and prompt_templates tables

Revision ID: 3b7f9c2d4e5a
Revises: 2a8e4f7b3c1d
Create Date: 2026-06-30 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '3b7f9c2d4e5a'
down_revision: Union[str, None] = '2a8e4f7b3c1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── drafting_sessions ─────────────────────────────────────────────────────
    op.execute(
        "CREATE TABLE IF NOT EXISTS drafting_sessions ("
        "    id UUID NOT NULL DEFAULT gen_random_uuid(),"
        "    title VARCHAR(500) NOT NULL,"
        "    letter_id UUID REFERENCES inbound_letters(id) ON DELETE SET NULL,"
        "    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,"
        "    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,"
        "    created_by UUID,"
        "    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),"
        "    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),"
        "    PRIMARY KEY (id)"
        ")"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_drafting_sessions_created_by "
        "ON drafting_sessions (created_by)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_drafting_sessions_letter_id "
        "ON drafting_sessions (letter_id)"
    )

    # ── drafting_messages ─────────────────────────────────────────────────────
    op.execute(
        "CREATE TABLE IF NOT EXISTS drafting_messages ("
        "    id UUID NOT NULL DEFAULT gen_random_uuid(),"
        "    session_id UUID NOT NULL REFERENCES drafting_sessions(id) ON DELETE CASCADE,"
        "    role VARCHAR(20) NOT NULL,"
        "    content TEXT NOT NULL,"
        "    draft_response_id UUID,"  # soft FK — draft_responses may be deleted separately
        "    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),"
        "    PRIMARY KEY (id)"
        ")"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_drafting_messages_session_id "
        "ON drafting_messages (session_id)"
    )

    # ── prompt_templates ──────────────────────────────────────────────────────
    op.execute(
        "CREATE TABLE IF NOT EXISTS prompt_templates ("
        "    id UUID NOT NULL DEFAULT gen_random_uuid(),"
        "    label VARCHAR(200) NOT NULL,"
        "    icon VARCHAR(50) NOT NULL DEFAULT 'ti-sparkles',"
        "    prompt_text TEXT NOT NULL,"
        "    display_order INTEGER NOT NULL DEFAULT 0,"
        "    is_active BOOLEAN NOT NULL DEFAULT TRUE,"
        "    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),"
        "    PRIMARY KEY (id)"
        ")"
    )

    # ── Seed default prompt templates ─────────────────────────────────────────
    op.execute(
        "INSERT INTO prompt_templates (label, icon, prompt_text, display_order) VALUES "
        "('Acknowledge Receipt', 'ti-mail', "
        "'Draft a professional response acknowledging receipt of the client letter and confirming that we are reviewing the matter.', 0),"
        "('Request Clarification', 'ti-file-search', "
        "'Draft a response requesting clarification on specific contract terms referenced in the letter.', 1),"
        "('Delay Notification', 'ti-clock', "
        "'Draft a professional notification explaining a delay and providing an updated timeline.', 2),"
        "('Payment Dispute', 'ti-currency-dollar', "
        "'Address the payment discrepancy, reference the relevant invoice details, and propose next steps.', 3),"
        "('Contract Amendment Response', 'ti-refresh', "
        "'Draft a formal response to the proposed contract amendment, acknowledging the changes and outlining our position on each point.', 4) "
        "ON CONFLICT DO NOTHING"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS drafting_messages")
    op.execute("DROP TABLE IF EXISTS drafting_sessions")
    op.execute("DROP TABLE IF EXISTS prompt_templates")
