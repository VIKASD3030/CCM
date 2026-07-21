"""Contract master — generic MasterRecord-backed CRUD."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import mr_list, mr_save, mr_delete
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-contracts"])
ENTITY, ID = "contract", "ContractId"


@router.post("/getContracts")
async def get_contracts(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {"ProjectMasterId": body.get("ProjectMasterId")} if body.get("ProjectMasterId") else None
    return await mr_list(db, ENTITY, ID, filters)


@router.post("/saveContractDetails")
async def save_contract(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, ENTITY, ID, body)


@router.post("/deleteContractDetails")
async def delete_contract(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, ENTITY, ID, body)
