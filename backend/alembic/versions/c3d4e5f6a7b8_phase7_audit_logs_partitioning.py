"""Phase 7: audit_logs partitioning — RANGE by created_at (monthly)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-27

Converts audit_logs to a RANGE-partitioned table by month on created_at.
Creates initial partitions for current month + next 11 months + DEFAULT.

PostgreSQL requires the partition key column(s) to be part of the primary key.
Since audit_logs has 0 rows, this is a clean conversion (drop + recreate).

A helper function create_audit_partition() is created for ongoing use:
  SELECT create_audit_partition('2026-09');
"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Drop existing non-partitioned audit_logs table (0 rows)
    op.execute("DROP TABLE IF EXISTS public.audit_logs CASCADE")

    # Step 2: Create partitioned audit_logs table
    # Composite PK (id, created_at) required for partitioning
    op.execute("""
        CREATE TABLE public.audit_logs (
            id BIGSERIAL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            user_id UUID REFERENCES "Master".users(id) ON DELETE SET NULL,
            action TEXT NOT NULL,
            entity_type VARCHAR(100) NOT NULL,
            entity_id UUID NOT NULL,
            before_state JSONB,
            after_state JSONB,
            ip_address INET,
            user_agent TEXT,
            request_id UUID,
            details JSONB,
            PRIMARY KEY (id, created_at)
        ) PARTITION BY RANGE (created_at)
    """)

    # Step 3: Create monthly partitions for current year (Jul 2026 - Dec 2026)
    months = [
        "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
        "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06",
        "2027-07",
    ]
    for month in months:
        year, mon = month.split("-")
        next_mon = int(mon) + 1
        next_year = int(year)
        if next_mon > 12:
            next_mon = 1
            next_year += 1
        start = f"{year}-{mon}-01"
        end = f"{next_year}-{next_mon:02d}-01"
        part_name = f"audit_logs_{year}_{mon}"
        op.execute(f"""
            CREATE TABLE IF NOT EXISTS public.{part_name}
            PARTITION OF public.audit_logs
            FOR VALUES FROM ('{start}') TO ('{end}')
        """)

    # Step 4: DEFAULT partition for any data outside defined ranges
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.audit_logs_default
        PARTITION OF public.audit_logs DEFAULT
    """)

    # Step 5: Recreate indexes on the partitioned table
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id 
        ON public.audit_logs (user_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_audit_logs_entity_type 
        ON public.audit_logs (entity_type)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at 
        ON public.audit_logs (created_at DESC)
    """)

    # Step 6: Create helper function for adding future partitions
    op.execute("""
        CREATE OR REPLACE FUNCTION public.create_audit_partition(month_text TEXT)
        RETURNS void AS $$
        DECLARE
            year_part TEXT;
            mon_part TEXT;
            next_mon INT;
            next_year INT;
            start_date TEXT;
            end_date TEXT;
            part_name TEXT;
        BEGIN
            year_part := split_part(month_text, '-', 1);
            mon_part := split_part(month_text, '-', 2);
            next_mon := mon_part::int + 1;
            next_year := year_part::int;
            IF next_mon > 12 THEN
                next_mon := 1;
                next_year := next_year + 1;
            END IF;
            start_date := year_part || '-' || mon_part || '-01';
            end_date := next_year || '-' || lpad(next_mon::text, 2, '0') || '-01';
            part_name := 'audit_logs_' || year_part || '_' || mon_part;
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.audit_logs FOR VALUES FROM (%L) TO (%L)',
                part_name, start_date, end_date
            );
        END;
        $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    # Drop helper function
    op.execute("DROP FUNCTION IF EXISTS public.create_audit_partition(text)")

    # Drop all partitions
    op.execute("DROP TABLE IF EXISTS public.audit_logs CASCADE")

    # Recreate original non-partitioned table
    op.execute("""
        CREATE TABLE public.audit_logs (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            user_id UUID REFERENCES "Master".users(id) ON DELETE SET NULL,
            action TEXT NOT NULL,
            entity_type VARCHAR(100) NOT NULL,
            entity_id UUID NOT NULL,
            before_state JSONB,
            after_state JSONB,
            ip_address INET,
            user_agent TEXT,
            request_id UUID,
            details JSONB
        )
    """)
    op.execute("CREATE INDEX ix_audit_logs_user_id ON public.audit_logs (user_id)")
    op.execute("CREATE INDEX ix_audit_logs_entity_type ON public.audit_logs (entity_type)")
