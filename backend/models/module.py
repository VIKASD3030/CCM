"""
Module model — static reference list of feature areas that role
permissions can be granted against (e.g. "letters", "knowledge").
"""

from datetime import datetime, timezone

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Module(Base):
    """A feature area of the app that RolePermission grants access to."""

    __tablename__ = "modules"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {"key": self.key, "label": self.label}
