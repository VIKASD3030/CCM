"""
RolePermission model — per-(role, module) grant matrix backing
require_permission() checks.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class RolePermission(Base):
    """Grants for one role on one module."""

    __tablename__ = "role_permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID, primary_key=True, default=uuid.uuid4
    )
    role_name: Mapped[str] = mapped_column(
        String(50), ForeignKey("Master.roles.name", ondelete="CASCADE"), nullable=False
    )
    module_key: Mapped[str] = mapped_column(
        String(50), ForeignKey("Master.modules.key", ondelete="CASCADE"), nullable=False
    )
    can_view: Mapped[bool] = mapped_column(Boolean, default=False)
    can_create: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint("role_name", "module_key", name="uq_role_permissions_role_module"),
        {"schema": "Master"},
    )

    def to_dict(self):
        return {
            "module_key": self.module_key,
            "can_view": self.can_view,
            "can_create": self.can_create,
            "can_edit": self.can_edit,
            "can_delete": self.can_delete,
        }
