from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime, Numeric, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class EstimationMonth(Base):
    __tablename__ = "estimation_months"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    monthly_breakup_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.monthly_breakups.id"),
        nullable=True,
    )
    month_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    invoice: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True, default=0)
    cost: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True, default=0)
    revised_margin: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True, default=0)
    collection: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True, default=0)
    deduction: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True, default=0)
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
            "MonthlyBreakUpMasterDetailsId": self.id,
            "MonthId": self.month_id or "",
            "key": self.id,
            "MonthlyBreakUpMasterId": self.monthly_breakup_id or 0,
            "Invoice": float(self.invoice) if self.invoice is not None else 0,
            "Cost": float(self.cost) if self.cost is not None else 0,
            "RevisedMargin": float(self.revised_margin) if self.revised_margin is not None else 0,
            "Collection": float(self.collection) if self.collection is not None else 0,
            "Deduction": float(self.deduction) if self.deduction is not None else 0,
            "Remarks": self.remarks or "",
            "Status": self.status if self.status is not None else "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
        }
