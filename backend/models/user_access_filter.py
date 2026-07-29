from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class UserAccessFilter(Base):
    __tablename__ = "user_access_filters"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_role_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.user_roles.id"),
        nullable=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.user_directory.id"),
        nullable=True,
    )
    filter_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    filter_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
            "FilterId": self.id,
            "key": self.id,
            "UserRoleId": self.user_role_id or 0,
            "UserId": self.user_id or 0,
            "FilterType": self.filter_type or "",
            "FilterValue": self.filter_value or "",
            "Status": self.status if self.status is not None else "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
        }
