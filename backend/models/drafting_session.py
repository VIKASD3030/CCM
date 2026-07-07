"""
DraftingSession model.
Represents a persistent conversation thread in the AI Drafting panel,
linked to a specific letter and project.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class DraftingSession(Base):
    """A ChatGPT-style conversation thread for drafting a letter response."""

    __tablename__ = "drafting_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID, primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    letter_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID,
        ForeignKey("inbound_letters.id", ondelete="SET NULL"),
        nullable=True,
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID,
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    messages: Mapped[list["DraftingMessage"]] = relationship(
        "DraftingMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="DraftingMessage.created_at",
    )

    def to_dict(self, include_messages: bool = False) -> dict:
        data = {
            "id": str(self.id),
            "title": self.title,
            "letter_id": str(self.letter_id) if self.letter_id else None,
            "project_id": str(self.project_id) if self.project_id else None,
            "is_pinned": self.is_pinned,
            "created_by": str(self.created_by) if self.created_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_messages:
            data["messages"] = [m.to_dict() for m in self.messages]
        return data
