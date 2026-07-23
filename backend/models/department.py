from sqlalchemy import BigInteger, String, Integer
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, default=0)
    level: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    remarks: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str | None] = mapped_column(String(10), nullable=True, default="1")

    def to_dict(self):
        return {
            "DepartmentId": self.id,
            "key": self.id,
            "DepartmentCode": self.code,
            "DepartmentName": self.name,
            "ParentDepartmentId": self.parent_id,
            "ParentDepartmentName": None,
            "Level": self.level,
            "Remarks": self.remarks,
            "Status": self.status if self.status is not None else "1",
        }
