"""Variation Order master backed by a dedicated table."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import upsert_model, soft_delete_model
from backend.models.user import User
from backend.models.variation_order import VariationOrder
from backend.models.project_master import ProjectMaster
from backend.models.contract import Contract

router = APIRouter(prefix="/common", tags=["master-variation-orders"])

VARIATION_ORDER_MAP = {
    "ProjectId": "project_id",
    "ContractId": "contract_id",
    "VariationNo": "variation_no",
    "VariationDate": "variation_date",
    "ExtentionDate": "extention_date",
    "OrderValue": "order_value",
    "VariationOrderDescription": "variation_order_description",
    "Remarks": "remarks",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}


async def _refresh_variation_orders(db: AsyncSession) -> list[dict]:
    project_result = await db.execute(select(ProjectMaster).where(ProjectMaster.status != "9"))
    project_map = {row.id: row.project_code or "" for row in project_result.scalars().all()}
    contract_result = await db.execute(select(Contract).where(Contract.status != "9"))
    contract_map = {row.id: row.contract_name or "" for row in contract_result.scalars().all()}

    result = await db.execute(select(VariationOrder).where(VariationOrder.status != "9").order_by(VariationOrder.id))
    rows = result.scalars().all()
    out = []
    for row in rows:
        payload = row.to_dict()
        payload["ProjectCode"] = project_map.get(row.project_id or 0, "")
        payload["ContractName"] = contract_map.get(row.contract_id or 0, "")
        out.append(payload)
    return out


@router.get("/getVariationOrderDetails")
async def get_variation_orders(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _refresh_variation_orders(db)


@router.post("/saveVariationOrderData")
async def save_variation_order(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await upsert_model(db, VariationOrder, body, "VariationOrderId", VARIATION_ORDER_MAP)
    return await _refresh_variation_orders(db)


@router.post("/deleteVariationOrderData")
async def delete_variation_order(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await soft_delete_model(db, VariationOrder, body.get("VariationOrderId"))
    return await _refresh_variation_orders(db)
