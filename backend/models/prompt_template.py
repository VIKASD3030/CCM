"""
PromptTemplate model.
Stores configurable prompt chips shown in the AI Drafting empty state.
These can be edited/added/removed via the DB without code changes.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class PromptTemplate(Base):
    """A reusable prompt chip for the AI Drafting panel."""

    __tablename__ = "prompt_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID, primary_key=True, default=uuid.uuid4
    )
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), default="ti-sparkles")
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "label": self.label,
            "icon": self.icon,
            "prompt_text": self.prompt_text,
            "display_order": self.display_order,
            "is_active": self.is_active,
        }
