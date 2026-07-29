from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class AutoNotification(Base):
    __tablename__ = "auto_notifications"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    notification_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notification_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    activity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    days: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
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
            "AutoNotificationId": self.id,
            "key": self.id,
            "NotificationName": self.notification_name or "",
            "NotificaionName": self.notification_name or "",
            "NotificationType": self.notification_type or "",
            "ActivityType": self.activity_type or "",
            "Days": self.days or 0,
            "Remarks": self.remarks or "",
            "Status": self.status if self.status is not None else "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
        }
