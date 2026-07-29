"""
Shared serialization + CRUD helpers for the MASTER sub-app routers.

Contract (verified against the React frontend base-controller + views):
  * success is HTTP 200; auth expiry is 401 (handled by get_current_user)
  * list/get/save/delete all return a BARE JSON array of flat PascalCase objects
  * save/delete return the FULL refreshed list
  * row-selection grids need a per-row "key" field
  * isRecordExists returns {"status": 1|0} (object, not array)
"""
from typing import Any
from datetime import datetime

from sqlalchemy import select, delete as sa_delete, String as SaString, Boolean as SaBoolean, DateTime as SaDateTime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Integer, Numeric, Float


# ─── Real-model helpers (departments, locations, lookups, ...) ──────────────

async def refresh_list(db: AsyncSession, model, filters: dict | None = None, order_col=None):
    stmt = select(model)
    if filters:
        for col_name, value in filters.items():
            if value not in (None, "", 0):
                col = getattr(model, col_name, None)
                if col is not None:
                    stmt = stmt.where(col == value)
    if order_col is not None:
        stmt = stmt.order_by(order_col)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    id_name_map = {r.id: getattr(r, 'name', getattr(r, 'lookup_name', None)) for r in rows}
    parent_id_key = f"Parent{model.__name__}Id"
    parent_name_key = f"Parent{model.__name__}Name"

    output = []
    for r in rows:
        d = r.to_dict()
        if d.get(parent_id_key):
            d[parent_name_key] = id_name_map.get(d[parent_id_key])
        output.append(d)
    return output


async def upsert_model(db: AsyncSession, model, body: dict, pk_field: str, field_map: dict[str, str]):
    """Create or update a real model row by PascalCase PK. field_map maps
    PascalCase body keys -> snake_case column names."""
    pk = body.get(pk_field) or 0
    if isinstance(pk, str):
        pk = int(pk) if pk.strip() else 0
    obj = await db.get(model, pk) if pk else None
    if obj is None:
        obj = model()
        db.add(obj)
    mapper = model.__mapper__
    for body_key, col in field_map.items():
        if body_key not in body:
            continue
        value = body[body_key]
        column = mapper.columns[col]
        col_type = column.type
        if column.foreign_keys and value in (None, "", 0, "0"):
            value = None
        if value == "":
            if isinstance(col_type, (Integer, Numeric, Float)):
                value = 0
            elif isinstance(col_type, SaDateTime):
                value = None
        if value is not None and isinstance(col_type, Integer) and not isinstance(value, (int, float)):
            try:
                value = int(value)
            except (TypeError, ValueError):
                value = 0
        elif value is not None and isinstance(col_type, (Numeric, Float)) and not isinstance(value, (int, float)):
            try:
                value = float(value)
            except (TypeError, ValueError):
                value = 0.0
        elif value is not None and isinstance(col_type, SaBoolean) and not isinstance(value, bool):
            if isinstance(value, str):
                value = value.strip().lower() in ("1", "true", "yes", "y", "on")
            else:
                value = bool(value)
        elif value is not None and isinstance(col_type, SaDateTime) and isinstance(value, str):
            value = _parse_datetime(value)
        elif value is not None and isinstance(col_type, SaString) and isinstance(value, (int, float)):
            value = str(value)
        setattr(obj, col, value)
    await db.flush()
    return obj


async def delete_model(db: AsyncSession, model, pk):
    if pk:
        await db.execute(sa_delete(model).where(model.id == pk))
        await db.flush()


async def soft_delete_model(db: AsyncSession, model, pk):
    if isinstance(pk, str):
        pk = int(pk) if pk.strip() else 0
    if not pk:
        return
    obj = await db.get(model, pk)
    if obj is not None and hasattr(obj, "status"):
        obj.status = "9"
        await db.flush()
async def list_exists(rows: list[dict], record: dict, id_key: str, ignore_keys: set[str] | None = None) -> dict:
    ignore = {
        id_key,
        "key",
        "Status",
        "CreatedBy",
        "CreatedDate",
        "LockedBy",
        "LockedDate",
        "SecurityId",
        "LastUpdatedBy",
        "LastUpdatedDate",
    }
    if ignore_keys:
        ignore.update(ignore_keys)

    current_id = _normalize_scalar(record.get(id_key))
    match = {
        key: value
        for key, value in (record or {}).items()
        if key not in ignore and value not in (None, "", [], {})
    }
    if not match:
        return {"status": 0}

    for row in rows:
        if current_id and _normalize_scalar(row.get(id_key)) == current_id:
            continue
        if all(_normalize_scalar(row.get(key)) == _normalize_scalar(value) for key, value in match.items()):
            return {"status": 1}
    return {"status": 0}


def _parse_datetime(value: str | None):
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _normalize_scalar(value: Any) -> str:
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return "" if value is None else str(value).strip()
