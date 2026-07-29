from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


def _format_dt(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.strftime("%Y-%m-%d %H:%M:%S")


class Contract(Base):
    __tablename__ = "contracts"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    contract_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contract_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    project_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.project_master.id"),
        nullable=True,
    )
    contractor_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.contractors.id"),
        nullable=True,
    )
    contract_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contract_start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    contract_end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    contract_value: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True, default=0)
    section_value: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True, default=0)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    consultant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    short_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    document_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
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
            "ContractId": self.id,
            "key": self.id,
            "ContractNo": self.contract_no or "",
            "ContractName": self.contract_name or "",
            "ProjectId": self.project_id or 0,
            "ContractorId": self.contractor_id or 0,
            "ContractType": self.contract_type or "",
            "ContractStartDate": _format_dt(self.contract_start_date),
            "ContractEndDate": _format_dt(self.contract_end_date),
            "ContractValue": float(self.contract_value) if self.contract_value is not None else 0,
            "SectionValue": float(self.section_value) if self.section_value is not None else 0,
            "ClientName": self.client_name or "",
            "ConsultantName": self.consultant_name or "",
            "ShortDescription": self.short_description or "",
            "Remarks": self.remarks or "",
            "FileName": self.file_name or "",
            "DocumentPath": self.document_path or "",
            "Status": self.status if self.status is not None else "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
            "ProjectName": "",
            "ContractorName": "",
        }
