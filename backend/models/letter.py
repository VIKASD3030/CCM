"""
Inbound client letter model.
Stores the original letter text plus AI-extracted classification metadata.
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import String, Text, Float, Integer, Date, DateTime, ForeignKey
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

    # Richer classification
    domain_category: Mapped[str | None] = mapped_column(String(60), nullable=True)
    posture: Mapped[str | None] = mapped_column(String(40), nullable=True)
    scope: Mapped[str | None] = mapped_column(String(60), nullable=True)
    kd_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    requested_action: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Correspondence metadata
    ref_no: Mapped[str | None] = mapped_column(String(200), nullable=True)
    letter_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    referenced_refs: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # The original upload (scan, stamps, signature) and how it was read.
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ocr_pages: Mapped[int] = mapped_column(Integer, default=0)

    # Project routing: a suggestion with its reason when CCM isn't sure enough
    # to assign the project itself.
    suggested_project_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    routing_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    routing_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

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
            "domain_category": self.domain_category,
            "posture": self.posture,
            "scope": self.scope,
            "kd_tags": self.kd_tags or [],
            "requested_action": self.requested_action,
            "ref_no": self.ref_no,
            "letter_date": self.letter_date.isoformat() if self.letter_date else None,
            "subject": self.subject,
            "referenced_refs": self.referenced_refs or [],
            "has_file": bool(self.storage_path),
            "file_type": self.file_type,
            "page_count": self.page_count,
            "ocr_pages": self.ocr_pages or 0,
            "suggested_project_id": str(self.suggested_project_id) if self.suggested_project_id else None,
            "routing_confidence": self.routing_confidence,
            "routing_reason": self.routing_reason,
            "status": self.status,
            "project_id": str(self.project_id) if self.project_id else None,
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "created_by": str(self.created_by) if self.created_by else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
