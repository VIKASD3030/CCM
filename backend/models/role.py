"""
Role model — dynamic, admin-manageable roles (replaces the hardcoded
role enum on User).
"""

from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Role(Base):
    """A named role that users can be assigned, with per-module rights
    stored in RolePermission."""

    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(50), primary_key=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "name": self.name,
            "description": self.description,
            "is_system": self.is_system,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
