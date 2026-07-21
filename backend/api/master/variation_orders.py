"""Variation Order master — MasterRecord-backed."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import mr_list, mr_save, mr_delete
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-variation-orders"])
ENTITY, ID = "variation_order", "VariationOrderId"


@router.get("/getVariationOrderDetails")
async def get_variation_orders(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_list(db, ENTITY, ID)


@router.post("/saveVariationOrderData")
async def save_variation_order(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, ENTITY, ID, body)


@router.post("/deleteVariationOrderData")
async def delete_variation_order(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, ENTITY, ID, body)
