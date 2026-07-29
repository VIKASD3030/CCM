"""Contractor master — proper table CRUD (extracted from EAV).

API contract unchanged: same endpoints, same PascalCase JSON.
"""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.models.user import User
from backend.models.contractor import Contractor

router = APIRouter(prefix="/common", tags=["master-contractors"])


async def _refresh_list(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Contractor).order_by(Contractor.id))
    rows = result.scalars().all()
    return [r.to_dict() for r in rows if (r.status or "1") != "9"]


@router.get("/getContractors")
async def get_contractors(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _refresh_list(db)


@router.post("/saveContractorDetails")
async def save_contractor(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    pk = body.get("ContractorId") or 0
    if isinstance(pk, str):
        pk = int(pk) if pk.strip() else 0

    obj = await db.get(Contractor, pk) if pk else None
    if obj is None:
        obj = Contractor()
        db.add(obj)

    obj.contractor_code = body.get("ContractorCode", obj.contractor_code or "")
    obj.contractor_name = body.get("ContractorName", obj.contractor_name or "")
    obj.remarks = body.get("Remarks", obj.remarks or "")
    obj.status = str(body.get("Status", obj.status or "1"))
    obj.created_by = body.get("CreatedBy", obj.created_by)
    obj.created_date = body.get("CreatedDate", obj.created_date)
    obj.locked_by = body.get("LockedBy", obj.locked_by)
    obj.locked_date = body.get("LockedDate", obj.locked_date)
    obj.security_id = body.get("SecurityId", obj.security_id)
    obj.file_name = body.get("FileName", obj.file_name)
    obj.document_path = body.get("DocumentPath", obj.document_path)

    await db.flush()
    return await _refresh_list(db)


@router.post("/deleteContractorDetails")
async def delete_contractor(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    pk = body.get("ContractorId") or 0
    if isinstance(pk, str):
        pk = int(pk) if pk.strip() else 0
    if pk:
        obj = await db.get(Contractor, pk)
        if obj is not None:
            obj.status = "9"
            await db.flush()
    return await _refresh_list(db)
