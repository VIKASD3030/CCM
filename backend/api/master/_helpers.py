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

from sqlalchemy import select, delete as sa_delete, String as SaString
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Integer, Numeric, Float

from backend.models.master_record import MasterRecord


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

    id_name_map = {r.id: r.name for r in rows}
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
        if body_key in body:
            value = body[body_key]
            col_type = mapper.columns[col].type
            if isinstance(col_type, Integer) and not isinstance(value, (int, float)):
                try:
                    value = int(value)
                except (TypeError, ValueError):
                    value = 0
            elif isinstance(col_type, (Numeric, Float)) and not isinstance(value, (int, float)):
                try:
                    value = float(value)
                except (TypeError, ValueError):
                    value = 0.0
            elif isinstance(col_type, SaString) and isinstance(value, (int, float)):
                value = str(value)
            setattr(obj, col, value)
    await db.flush()
    return obj


async def delete_model(db: AsyncSession, model, pk):
    if pk:
        await db.execute(sa_delete(model).where(model.id == pk))
        await db.flush()


# ─── Generic MasterRecord helpers (contractors, contracts, activities, ...) ─

async def mr_list(db: AsyncSession, entity: str, id_key: str, filters: dict | None = None):
    stmt = select(MasterRecord).where(MasterRecord.entity == entity)
    result = await db.execute(stmt.order_by(MasterRecord.id))
    rows = [r for r in result.scalars().all() if (r.status or "1") != "9"]
    out = [r.to_dict(id_key) for r in rows]
    if filters:
        for k, v in filters.items():
            if v not in (None, "", 0):
                out = [d for d in out if str(d.get(k)) == str(v)]
    return out


async def mr_save(db: AsyncSession, entity: str, id_key: str, body: dict):
    """Upsert a generic master record. PK comes from body[id_key]."""
    rid = body.get(id_key) or 0
    if isinstance(rid, str):
        rid = int(rid) if rid.strip() else 0
    payload = {k: v for k, v in body.items() if k not in (id_key, "key")}
    status = str(body.get("Status", "1")) or "1"
    obj = await db.get(MasterRecord, rid) if rid else None
    if obj is None or obj.entity != entity:
        obj = MasterRecord(entity=entity, data=payload, status=status)
        db.add(obj)
    else:
        obj.data = payload
        obj.status = status
    await db.flush()
    return await mr_list(db, entity, id_key)


async def mr_save_bulk(db: AsyncSession, entity: str, id_key: str, rows: list[dict]):
    for row in rows or []:
        payload = {k: v for k, v in row.items() if k not in (id_key, "key")}
        db.add(MasterRecord(entity=entity, data=payload, status=str(row.get("Status", "1")) or "1"))
    await db.flush()
    return await mr_list(db, entity, id_key)


async def mr_delete(db: AsyncSession, entity: str, id_key: str, body: dict):
    """Soft-delete (Status=9) a generic master record by id."""
    rid = body.get(id_key) or 0
    if isinstance(rid, str):
        rid = int(rid) if rid.strip() else 0
    if rid:
        obj = await db.get(MasterRecord, rid)
        if obj is not None and obj.entity == entity:
            obj.status = "9"
            await db.flush()
    return await mr_list(db, entity, id_key)


async def mr_exists(db: AsyncSession, entity: str, match: dict) -> dict:
    """Return {"status": 1} if a non-deleted record matches all `match` fields."""
    rows = await mr_list(db, entity, "Id")
    for d in rows:
        if all(str(d.get(k)) == str(v) for k, v in match.items()):
            return {"status": 1}
    return {"status": 0}
