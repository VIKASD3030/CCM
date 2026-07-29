from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


def _format_dt(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.strftime("%Y-%m-%d %H:%M:%S")


class ErrorLog(Base):
    __tablename__ = "error_logs"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_log_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str | None] = mapped_column(String(10), nullable=True, default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self) -> dict:
        return {
            "ErrorId": self.id,
            "ErrorLogId": self.id,
            "UserId": self.user_id or "",
            "UserName": self.user_name or "",
            "ErrorMessage": self.error_message or "",
            "ErrorLogDate": _format_dt(self.error_log_date),
            "Status": self.status if self.status is not None else "1",
            "key": self.id,
        }
