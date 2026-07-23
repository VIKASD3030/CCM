"""
Shared master-data table for construction-PM reference entities.

These entities (contractors, contracts, activities, variation orders, module
groups, etc.) are scaffolding for the MASTER sub-app and are intentionally
decoupled from the core CCM schema. Each logical entity is one row-set inside a
single `master_records` table, discriminated by `entity`. The full PascalCase
record the frontend sends is stored verbatim in a JSONB `data` column, so any
field the React views add round-trips without a schema change. Dropping the
whole PM subsystem later is a single `DELETE FROM master_records`.
"""
from datetime import datetime, timezone

from sqlalchemy import BigInteger, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class MasterRecord(Base):
    __tablename__ = "master_records"
    __table_args__ = {"schema": "Master"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    entity: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str | None] = mapped_column(String(10), nullable=True, default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self, id_key: str):
        d = dict(self.data or {})
        d[id_key] = self.id
        d["key"] = self.id
        d["Status"] = self.status if self.status is not None else "1"
        return d
