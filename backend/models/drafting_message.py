"""
DraftingMessage model.
A single message in a DraftingSession conversation thread.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from backend.database import Base


class DraftingMessage(Base):
    """One turn in a drafting conversation (user prompt or AI response)."""

    __tablename__ = "drafting_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID, primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID,
        ForeignKey("drafting_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 'user' or 'assistant'
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Soft FK to draft_responses — nullable because user messages have no draft
    draft_response_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationship back to session
    session: Mapped["DraftingSession"] = relationship(
        "DraftingSession", back_populates="messages"
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "session_id": str(self.session_id),
            "role": self.role,
            "content": self.content,
            "draft_response_id": str(self.draft_response_id) if self.draft_response_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
