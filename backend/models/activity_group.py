from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


def _format_dt(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.strftime("%Y-%m-%d %H:%M:%S")


class ActivityGroup(Base):
    __tablename__ = "activity_groups"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.activity_groups.id"),
        nullable=True,
    )
    project_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.project_master.id"),
        nullable=True,
    )
    contract_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, default=0)
    location_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, default=0)
    module_group_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, default=0)
    quantity: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True, default=0)
    weightage: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True, default=0)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
            "ActivityGroupId": self.id,
            "key": self.id,
            "ActivityGroupCode": self.code or "",
            "ActivityGroupName": self.name or "",
            "ActivityGroupParentId": self.parent_id or 0,
            "ParentActivityGroupName": None,
            "ProjectId": self.project_id or 0,
            "ContractId": self.contract_id or 0,
            "LocationId": self.location_id or 0,
            "ModuleGroupId": self.module_group_id or 0,
            "Quantity": float(self.quantity) if self.quantity is not None else 0,
            "Weightage": float(self.weightage) if self.weightage is not None else 0,
            "StartDate": _format_dt(self.start_date),
            "EndDate": _format_dt(self.end_date),
            "Remarks": self.remarks or "",
            "Status": self.status if self.status is not None else "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
            "ProjectName": "",
            "ContractName": "",
        }
