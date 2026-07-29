from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class RoleRight(Base):
    __tablename__ = "role_rights"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    role_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.common_roles.id"),
        nullable=True,
    )
    module_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, default=0)
    module_group_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, default=0)
    parent_module_group_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, default=0)
    user_shown_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    module_group_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_module_group_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    right_status: Mapped[int | None] = mapped_column(Integer, nullable=True, default=1)
    status: Mapped[str | None] = mapped_column(String(10), nullable=True, default="1")
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    locked_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    locked_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    security_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self) -> dict:
        return {
            "RoleRightId": self.id,
            "key": self.id,
            "RoleId": self.role_id or 0,
            "ModuleId": self.module_id or 0,
            "ModuleGroupId": self.module_group_id or 0,
            "ParentModuleGroupId": self.parent_module_group_id or 0,
            "UserShownName": self.user_shown_name or "",
            "ModuleGroupName": self.module_group_name or "",
            "ParentModuleGroupName": self.parent_module_group_name or "",
            "RightStatus": self.right_status if self.right_status is not None else 1,
            "Status": self.status if self.status is not None else "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
        }
