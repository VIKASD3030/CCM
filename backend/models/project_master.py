"""
Project Master — proper table (extracted from EAV master_records).
Kept separate from the core CCM `projects` table which drives knowledge-base/SharePoint.
"""
from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class ProjectMaster(Base):
    __tablename__ = "project_master"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_code: Mapped[str] = mapped_column(String(100), nullable=False)
    project_name: Mapped[str] = mapped_column(String(200), nullable=False)
    client_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    business_unit: Mapped[str | None] = mapped_column(String(200), nullable=True)
    business_line: Mapped[str | None] = mapped_column(String(100), nullable=True)
    project_manager_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    project_director_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pmo_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    project_data_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_project_master_id: Mapped[str] = mapped_column(String(20), default="0")
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="1")
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    locked_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    locked_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    security_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self) -> dict:
        return {
            "ProjectMasterId": self.id,
            "key": self.id,
            "ProjectCode": self.project_code or "",
            "ProjectName": self.project_name or "",
            "ClientName": self.client_name or "",
            "BusinessUnit": self.business_unit or "",
            "BusinessLine": self.business_line or "",
            "ProjectManagerId": self.project_manager_id or "",
            "ProjectDirectorId": self.project_director_id or "",
            "PMOID": self.pmo_id or "",
            "ProjectDataSource": self.project_data_source or "",
            "ParentProjectMasterId": self.parent_project_master_id or "0",
            "Remarks": self.remarks or "",
            "Status": self.status or "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LockedBy": self.locked_by or "",
            "LockedDate": self.locked_date or "",
            "SecurityId": self.security_id or "",
        }
