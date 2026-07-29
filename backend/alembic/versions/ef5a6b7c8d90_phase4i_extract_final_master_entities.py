"""Phase 4i: extract final remaining master entities from EAV

Revision ID: ef5a6b7c8d90
Revises: de4f5a6b7c80
Create Date: 2026-07-29
"""
from typing import Sequence, Union

from alembic import op


revision: str = "ef5a6b7c8d90"
down_revision: Union[str, None] = "de4f5a6b7c80"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".variation_orders (
            id BIGSERIAL PRIMARY KEY,
            project_id BIGINT,
            contract_id BIGINT,
            variation_no VARCHAR(100),
            variation_date TIMESTAMPTZ,
            extention_date TIMESTAMPTZ,
            order_value NUMERIC(18, 4) DEFAULT 0,
            variation_order_description TEXT,
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_variation_orders_project FOREIGN KEY (project_id) REFERENCES "Master".project_master(id),
            CONSTRAINT fk_variation_orders_contract FOREIGN KEY (contract_id) REFERENCES "Master".contracts(id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".auto_notifications (
            id BIGSERIAL PRIMARY KEY,
            notification_name VARCHAR(255),
            notification_type VARCHAR(100),
            activity_type VARCHAR(100),
            days INTEGER DEFAULT 0,
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".monthly_breakups (
            id BIGSERIAL PRIMARY KEY,
            project_id BIGINT,
            contract_id BIGINT,
            entry_date TIMESTAMPTZ,
            revision_no VARCHAR(100),
            revision_date TIMESTAMPTZ,
            year_id INTEGER,
            margin NUMERIC(18, 4) DEFAULT 0,
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_monthly_breakups_project FOREIGN KEY (project_id) REFERENCES "Master".project_master(id),
            CONSTRAINT fk_monthly_breakups_contract FOREIGN KEY (contract_id) REFERENCES "Master".contracts(id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Master".estimation_months (
            id BIGSERIAL PRIMARY KEY,
            monthly_breakup_id BIGINT,
            month_id VARCHAR(20),
            invoice NUMERIC(18, 4) DEFAULT 0,
            cost NUMERIC(18, 4) DEFAULT 0,
            revised_margin NUMERIC(18, 4) DEFAULT 0,
            collection NUMERIC(18, 4) DEFAULT 0,
            deduction NUMERIC(18, 4) DEFAULT 0,
            remarks TEXT,
            status VARCHAR(10) DEFAULT '1',
            created_by VARCHAR(100),
            created_date VARCHAR(50),
            locked_by VARCHAR(100),
            locked_date VARCHAR(50),
            security_id VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_estimation_months_monthly_breakup FOREIGN KEY (monthly_breakup_id) REFERENCES "Master".monthly_breakups(id)
        )
        """
    )

    op.execute('CREATE INDEX IF NOT EXISTS ix_variation_orders_status ON "Master".variation_orders (status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_auto_notifications_status ON "Master".auto_notifications (status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_monthly_breakups_status ON "Master".monthly_breakups (status)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_estimation_months_status ON "Master".estimation_months (status)')

    op.execute(
        """
        INSERT INTO "Master".variation_orders (
            id, project_id, contract_id, variation_no, variation_date, extention_date,
            order_value, variation_order_description, remarks, status, created_by,
            created_date, locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            NULLIF(COALESCE(data->>'ProjectId', '0'), '0')::BIGINT,
            NULLIF(COALESCE(data->>'ContractId', '0'), '0')::BIGINT,
            data->>'VariationNo',
            NULLIF(data->>'VariationDate', '')::TIMESTAMPTZ,
            NULLIF(data->>'ExtentionDate', '')::TIMESTAMPTZ,
            COALESCE(NULLIF(data->>'OrderValue', ''), '0')::NUMERIC(18, 4),
            data->>'VariationOrderDescription',
            data->>'Remarks',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'variation_order'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".auto_notifications (
            id, notification_name, notification_type, activity_type, days, remarks,
            status, created_by, created_date, locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            COALESCE(data->>'NotificaionName', data->>'NotificationName'),
            data->>'NotificationType',
            data->>'ActivityType',
            COALESCE(NULLIF(data->>'Days', ''), '0')::INTEGER,
            data->>'Remarks',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'auto_notification'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".monthly_breakups (
            id, project_id, contract_id, entry_date, revision_no, revision_date,
            year_id, margin, remarks, status, created_by, created_date,
            locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            NULLIF(COALESCE(data->>'ProjectId', '0'), '0')::BIGINT,
            NULLIF(COALESCE(data->>'ContractId', '0'), '0')::BIGINT,
            NULLIF(data->>'EntryDate', '')::TIMESTAMPTZ,
            data->>'RevisionNo',
            NULLIF(data->>'RevisionDate', '')::TIMESTAMPTZ,
            NULLIF(data->>'YearId', '')::INTEGER,
            COALESCE(NULLIF(data->>'Margin', ''), '0')::NUMERIC(18, 4),
            data->>'Remarks',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'monthly_breakup'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".estimation_months (
            id, monthly_breakup_id, month_id, invoice, cost, revised_margin,
            collection, deduction, remarks, status, created_by, created_date,
            locked_by, locked_date, security_id, created_at
        )
        SELECT
            id,
            NULLIF(COALESCE(data->>'MonthlyBreakUpMasterId', '0'), '0')::BIGINT,
            data->>'MonthId',
            COALESCE(NULLIF(data->>'Invoice', ''), '0')::NUMERIC(18, 4),
            COALESCE(NULLIF(data->>'Cost', ''), '0')::NUMERIC(18, 4),
            COALESCE(NULLIF(data->>'RevisedMargin', ''), '0')::NUMERIC(18, 4),
            COALESCE(NULLIF(data->>'Collection', ''), '0')::NUMERIC(18, 4),
            COALESCE(NULLIF(data->>'Deduction', ''), '0')::NUMERIC(18, 4),
            data->>'Remarks',
            COALESCE(status, '1'),
            data->>'CreatedBy',
            data->>'CreatedDate',
            data->>'LockedBy',
            data->>'LockedDate',
            data->>'SecurityId',
            created_at
        FROM "Master".master_records
        WHERE entity = 'estimation_month'
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '9'
        WHERE entity IN ('variation_order', 'auto_notification', 'monthly_breakup', 'estimation_month')
        """
    )

    for table_name in ('variation_orders', 'auto_notifications', 'monthly_breakups', 'estimation_months'):
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
            'variation_order',
            jsonb_build_object(
                'ProjectId', COALESCE(project_id, 0),
                'ContractId', COALESCE(contract_id, 0),
                'VariationNo', variation_no,
                'VariationDate', to_char(variation_date, 'YYYY-MM-DD HH24:MI:SS'),
                'ExtentionDate', to_char(extention_date, 'YYYY-MM-DD HH24:MI:SS'),
                'OrderValue', COALESCE(order_value, 0),
                'VariationOrderDescription', variation_order_description,
                'Remarks', remarks,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".variation_orders
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'auto_notification',
            jsonb_build_object(
                'NotificationName', notification_name,
                'NotificaionName', notification_name,
                'NotificationType', notification_type,
                'ActivityType', activity_type,
                'Days', COALESCE(days, 0),
                'Remarks', remarks,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".auto_notifications
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'monthly_breakup',
            jsonb_build_object(
                'ProjectId', COALESCE(project_id, 0),
                'ContractId', COALESCE(contract_id, 0),
                'EntryDate', to_char(entry_date, 'YYYY-MM-DD HH24:MI:SS'),
                'RevisionNo', revision_no,
                'RevisionDate', to_char(revision_date, 'YYYY-MM-DD HH24:MI:SS'),
                'YearId', year_id,
                'Margin', COALESCE(margin, 0),
                'Remarks', remarks,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".monthly_breakups
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO "Master".master_records (id, entity, data, status, created_at)
        SELECT
            id,
            'estimation_month',
            jsonb_build_object(
                'MonthlyBreakUpMasterId', COALESCE(monthly_breakup_id, 0),
                'MonthId', month_id,
                'Invoice', COALESCE(invoice, 0),
                'Cost', COALESCE(cost, 0),
                'RevisedMargin', COALESCE(revised_margin, 0),
                'Collection', COALESCE(collection, 0),
                'Deduction', COALESCE(deduction, 0),
                'Remarks', remarks,
                'CreatedBy', created_by,
                'CreatedDate', created_date,
                'LockedBy', locked_by,
                'LockedDate', locked_date,
                'SecurityId', security_id
            ),
            status,
            created_at
        FROM "Master".estimation_months
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE "Master".master_records
        SET status = '1'
        WHERE entity IN ('variation_order', 'auto_notification', 'monthly_breakup', 'estimation_month')
        """
    )

    op.execute('DROP TABLE IF EXISTS "Master".estimation_months')
    op.execute('DROP TABLE IF EXISTS "Master".monthly_breakups')
    op.execute('DROP TABLE IF EXISTS "Master".auto_notifications')
    op.execute('DROP TABLE IF EXISTS "Master".variation_orders')
