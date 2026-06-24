"""
Audit trail model.
Records every significant action for compliance and traceability.
Table is partitioned by RANGE on created_at (monthly).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB, INET
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class AuditEntry(Base):
    """An audit log entry tracking actions on letters, drafts, and documents."""
    
    # Note: This model assumes the table will be partitioned.
    # The actual partitioning will be done via Alembic migrations.
    
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True  # BIGSERIAL equivalent
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        nullable=False, 
        default=lambda: datetime.now(timezone.utc)
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID, nullable=False)
    before_state: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_state: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    
    # Composite primary key (id, created_at) for partitioning
    # Note: SQLAlchemy doesn't directly support composite primary keys with autoincrement
    # We'll handle this in the migration or rely on the DB constraint
    
    def to_dict(self):
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": str(self.entity_id),
            "before_state": self.before_state,
            "after_state": self.after_state,
            "ip_address": str(self.ip_address) if self.ip_address else None,
            "user_agent": self.user_agent,
            "request_id": str(self.request_id) if self.request_id else None,
            "details": self.details,
        }
