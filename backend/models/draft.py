"""
Draft response model.
Stores AI-generated draft responses linked to inbound letters, with versioning.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class DraftResponse(Base):
    """An AI-generated draft response to a client letter."""

    __tablename__ = "draft_responses"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID, primary_key=True, default=uuid.uuid4
    )
    letter_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID,
        ForeignKey("inbound_letters.id", ondelete="CASCADE"),
        nullable=False,
    )
    draft_text: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(
        String(50), default="pending_review"
    )
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    context_documents: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    edited_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # For RLS and audit trail
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationship back to letter
    letter: Mapped["InboundLetter"] = relationship(
        "InboundLetter", back_populates="drafts"
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "letter_id": str(self.letter_id),
            "draft_text": self.draft_text,
            "version": self.version,
            "status": self.status,
            "reviewer_notes": self.reviewer_notes,
            "feedback": self.feedback,
            "context_documents": self.context_documents,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
