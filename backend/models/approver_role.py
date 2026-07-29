from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class ApproverRole(Base):
    __tablename__ = "approver_roles"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.user_directory.id"),
        nullable=True,
    )
    common_role_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.common_roles.id"),
        nullable=True,
    )
    approver_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.user_directory.id"),
        nullable=True,
    )
    remarks: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str | None] = mapped_column(String(10), nullable=True, default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self) -> dict:
        return {
            "RoleId": self.id,
            "key": self.id,
            "UserId": self.user_id or 0,
            "CommonRoleId": self.common_role_id or 0,
            "ApproverId": self.approver_id or 0,
            "Remarks": self.remarks or "",
            "Status": self.status if self.status is not None else "1",
        }
