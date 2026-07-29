from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


def _format_dt(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.strftime("%Y-%m-%d %H:%M:%S")


class ProjectDetail(Base):
    __tablename__ = "project_details"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.project_master.id"),
        nullable=True,
    )
    contract_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.contracts.id"),
        nullable=True,
    )
    loa_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(100), nullable=True)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    original_contract_value: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True, default=0)
    margin: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True, default=0)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contract_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    project_description: Mapped[str | None] = mapped_column(Text, nullable=True)
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
            "ProjectDetailId": self.id,
            "ProjectDetailsId": self.id,
            "key": self.id,
            "ProjectId": self.project_id or 0,
            "ContractId": self.contract_id or 0,
            "LOADate": _format_dt(self.loa_date),
            "Currency": self.currency or "",
            "StartDate": _format_dt(self.start_date),
            "EndDate": _format_dt(self.end_date),
            "OriginalContractValue": float(self.original_contract_value) if self.original_contract_value is not None else 0,
            "Margin": float(self.margin) if self.margin is not None else 0,
            "ClientName": self.client_name or "",
            "ContractType": self.contract_type or "",
            "ProjectDescription": self.project_description or "",
            "Remarks": self.remarks or "",
            "Status": self.status if self.status is not None else "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
            "ProjectCode": "",
            "ContractName": "",
        }
