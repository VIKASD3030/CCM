"""
Knowledge Base document and chunk models.
Documents are uploaded files; chunks are embedded segments for vector search.
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import String, Text, Integer, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.project import Project

from backend.database import Base


class KnowledgeDocument(Base):
    """A document uploaded to the knowledge base (contract, letter, template)."""

    __tablename__ = "knowledge_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID, primary_key=True, default=uuid.uuid4
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(
        String(100), nullable=False, default="general"
    )
    # Project folder: contract_volume / outgoing_letter / incoming_letter
    # (None for legacy uploads made before folders existed).
    document_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    clause_count: Mapped[int] = mapped_column(Integer, default=0)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Pages that had no text layer and were read with OCR; 0 for digital files.
    ocr_pages: Mapped[int] = mapped_column(Integer, default=0)
    # Why a document is in its current status (failure reason, OCR notes).
    status_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    # SHA-256 of the file: the same file is not stored twice in a project.
    checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Correspondence metadata (letters): its own reference, date, subject and
    # the references it quotes, used to link a letter to its reply.
    ref_no: Mapped[str | None] = mapped_column(String(200), nullable=True)
    doc_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    referenced_refs: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Contract volume label, e.g. "Volume I", read from the file name.
    volume_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="processing"
    )
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID, nullable=True
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Project scoping
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    # For RLS and audit trail
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationship to chunks
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "filename": self.filename,
            "file_type": self.file_type,
            "category": self.category,
            "document_type": self.document_type,
            "chunk_count": self.chunk_count,
            "clause_count": self.clause_count or 0,
            "page_count": self.page_count,
            "ocr_pages": self.ocr_pages or 0,
            "status_detail": self.status_detail,
            "ref_no": self.ref_no,
            "doc_date": self.doc_date.isoformat() if self.doc_date else None,
            "subject": self.subject,
            "referenced_refs": self.referenced_refs or [],
            "volume_label": self.volume_label,
            "status": self.status,
            "project_id": str(self.project_id) if self.project_id else None,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class DocumentChunk(Base):
    """A text chunk from a knowledge document, with its vector embedding."""

    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID, primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID,
        ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Contract clause this chunk belongs to (e.g. "20.1"), when detectable.
    clause_no: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # Source pages (PDFs only).
    page_from: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_to: Mapped[int | None] = mapped_column(Integer, nullable=True)
    embedding = mapped_column(Vector(1536), nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, default=dict)

    # Relationship back to document
    document: Mapped["KnowledgeDocument"] = relationship(back_populates="chunks")

    def to_dict(self):
        return {
            "id": str(self.id),
            "document_id": str(self.document_id),
            "chunk_index": self.chunk_index,
            "clause_no": self.clause_no,
            "page_from": self.page_from,
            "page_to": self.page_to,
            "chunk_text": self.chunk_text[:200] + "..." if len(self.chunk_text) > 200 else self.chunk_text,
        }
