"""
Inbound client letter model.
Stores the original letter text plus AI-extracted classification metadata.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.project import Project

from backend.database import Base


class InboundLetter(Base):
    """A client letter that has been uploaded for processing."""

    __tablename__ = "inbound_letters"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID, primary_key=True, default=uuid.uuid4
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)

    # AI-extracted classification
    intent: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    urgency: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    key_entities: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Status tracking
    status: Mapped[str] = mapped_column(
        String(50), default="new"
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Project scoping
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )

    # For RLS and audit trail
    created_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    drafts: Mapped[list["DraftResponse"]] = relationship(
        "DraftResponse", back_populates="letter", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "filename": self.filename,
            "raw_text": self.raw_text,
            "intent": self.intent,
            "category": self.category,
            "urgency": self.urgency,
            "confidence_score": self.confidence_score,
            "key_entities": self.key_entities,
            "status": self.status,
            "project_id": str(self.project_id) if self.project_id else None,
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "created_by": str(self.created_by) if self.created_by else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
