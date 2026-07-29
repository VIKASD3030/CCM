"""
Contractor master — proper table (extracted from EAV master_records).
"""
from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Contractor(Base):
    __tablename__ = "contractors"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    contractor_code: Mapped[str] = mapped_column(String(100), nullable=False)
    contractor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="1")
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    locked_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    locked_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    security_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    document_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self) -> dict:
        return {
            "ContractorId": self.id,
            "key": self.id,
            "ContractorCode": self.contractor_code or "",
            "ContractorName": self.contractor_name or "",
            "Remarks": self.remarks or "",
            "Status": self.status or "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
            "FileName": self.file_name or "",
            "DocumentPath": self.document_path or "",
        }
