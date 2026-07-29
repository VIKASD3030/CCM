from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class CommonRole(Base):
    __tablename__ = "common_roles"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.common_roles.id"),
        nullable=True,
    )
    level: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
            "RoleId": self.id,
            "key": self.id,
            "RoleCode": self.code or "",
            "RoleName": self.name or "",
            "ParentRoleId": self.parent_id or 0,
            "ParentRoleName": None,
            "Level": self.level if self.level is not None else "",
            "Remarks": self.remarks or "",
            "Status": self.status if self.status is not None else "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
        }
