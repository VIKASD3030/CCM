from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class UiModule(Base):
    __tablename__ = "ui_modules"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_shown_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    module_group_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.module_groups.id"),
        nullable=True,
    )
    parent_module_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.ui_modules.id"),
        nullable=True,
    )
    level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    module_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    module_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_exact: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    icon_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    icon_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
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
            "ModuleId": self.id,
            "key": self.id,
            "ModuleName": self.name or "",
            "UserShownName": self.user_shown_name or "",
            "ModuleGroupId": self.module_group_id or 0,
            "ModuleGroupName": "",
            "ParentModuleId": self.parent_module_id or 0,
            "ParentModuleName": None,
            "Level": self.level if self.level is not None else "",
            "ModuleType": self.module_type or "",
            "ModulePath": self.module_path or "",
            "IsExact": bool(self.is_exact),
            "IconType": self.icon_type or "",
            "IconPath": self.icon_path or "",
            "Remarks": self.remarks or "",
            "Status": self.status if self.status is not None else "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
        }
