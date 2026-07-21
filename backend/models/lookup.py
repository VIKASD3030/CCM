from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Lookup(Base):
    __tablename__ = "lookups"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lookup_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lookup_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lookup_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str | None] = mapped_column(String(10), nullable=True, default="1")

    def to_dict(self):
        return {
            "LookupId": self.id,
            "key": self.id,
            "LookupType": self.lookup_type,
            "LookupCode": self.lookup_code,
            "LookupName": self.lookup_name,
            "Description": self.description,
            "Status": self.status if self.status is not None else "1",
        }
