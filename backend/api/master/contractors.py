"""Contractor master — generic MasterRecord-backed CRUD."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import mr_list, mr_save, mr_delete
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-contractors"])
ENTITY, ID = "contractor", "ContractorId"


@router.get("/getContractors")
async def get_contractors(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_list(db, ENTITY, ID)


@router.post("/saveContractorDetails")
async def save_contractor(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, ENTITY, ID, body)


@router.post("/deleteContractorDetails")
async def delete_contractor(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, ENTITY, ID, body)
