from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class DirectoryUser(Base):
    __tablename__ = "user_directory"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    legacy_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, default=0)
    user_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ad_user_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    employee_no: Mapped[str | None] = mapped_column(String(255), nullable=True)
    employee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    designation_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.designations.id"),
        nullable=True,
    )
    department_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.departments.id"),
        nullable=True,
    )
    user_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    module_group_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("Master.module_groups.id"),
        nullable=True,
    )
    status: Mapped[str | None] = mapped_column(String(10), nullable=True, default="1")
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_updated_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_updated_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    security_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self) -> dict:
        return {
            "Id": self.legacy_id or 0,
            "UserId": self.id,
            "key": self.id,
            "UserName": self.user_name or "",
            "AdUserName": self.ad_user_name or "",
            "EmployeeNo": self.employee_no or "",
            "EmployeeName": self.employee_name or "",
            "DesignationId": self.designation_id or 0,
            "DesignationName": "",
            "DepartmentId": self.department_id or 0,
            "DepartmentName": "",
            "UserType": self.user_type or "",
            "EmailId": self.email_id or "",
            "MobileNo": self.mobile_no,
            "ModuleGroupId": self.module_group_id or 0,
            "Status": self.status if self.status is not None else "1",
            "CreatedBy": self.created_by or "",
            "CreatedDate": self.created_date or "",
            "LastUpdatedBy": self.last_updated_by or "",
            "LastUpdatedDate": self.last_updated_date or "",
            "SecurityId": self.security_id or "",
        }
