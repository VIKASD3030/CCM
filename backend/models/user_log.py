from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


def _format_dt(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.strftime("%Y-%m-%d %H:%M:%S")


class UserLog(Base):
    __tablename__ = "user_logs"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mac_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    log_in_status: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    login_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    log_out_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    token_value: Mapped[str | None] = mapped_column(Text, nullable=True)
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
            "LogId": self.id,
            "UserId": self.user_id or "",
            "UserName": "",
            "IPAddress": self.ip_address,
            "MACAddress": self.mac_address,
            "LogInStatus": self.log_in_status or 0,
            "LoginDate": _format_dt(self.login_date),
            "LogOutDate": _format_dt(self.log_out_date),
            "TokenValue": self.token_value or "",
            "Status": self.status if self.status is not None else "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
            "key": self.id,
        }
