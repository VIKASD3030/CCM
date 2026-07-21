import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID, primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sharepoint_site_id: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), default="active"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Enterprise-only fields migrated from master schema (nullable, free-form JSONB
    # to avoid cluttering the core schema with sparse enterprise metadata).
    project_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "sharepoint_site_id": self.sharepoint_site_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
