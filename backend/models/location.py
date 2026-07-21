from sqlalchemy import BigInteger, String, Integer
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, default=0)
    level: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    remarks: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str | None] = mapped_column(String(10), nullable=True, default="1")

    def to_dict(self):
        return {
            "LocationId": self.id,
            "key": self.id,
            "LocationName": self.name,
            "ParentLocationId": self.parent_id,
            "ParentLocationName": None,
            "Level": self.level,
            "Remarks": self.remarks,
            "Status": self.status if self.status is not None else "1",
        }
