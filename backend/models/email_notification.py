"""
Email notification settings model.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class EmailNotificationSetting(Base):
    """User email notification preferences."""

    __tablename__ = "email_notification_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID, ForeignKey("Master.users.id", ondelete="CASCADE"), primary_key=True
    )
    on_review_needed: Mapped[bool] = mapped_column(Boolean, default=True)
    on_draft_approved: Mapped[bool] = mapped_column(Boolean, default=True)
    on_draft_rejected: Mapped[bool] = mapped_column(Boolean, default=True)
    on_letter_assigned: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "user_id": str(self.user_id),
            "on_review_needed": self.on_review_needed,
            "on_draft_approved": self.on_draft_approved,
            "on_draft_rejected": self.on_draft_rejected,
            "on_letter_assigned": self.on_letter_assigned,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }