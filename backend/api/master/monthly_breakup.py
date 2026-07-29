"""Monthly Breakup master + estimation months backed by dedicated tables."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import upsert_model, soft_delete_model
from backend.models.user import User
from backend.models.monthly_breakup import MonthlyBreakup
from backend.models.estimation_month import EstimationMonth
from backend.models.project_master import ProjectMaster
from backend.models.contract import Contract

router = APIRouter(prefix="/common", tags=["master-monthly-breakup"])

MONTHLY_BREAKUP_MAP = {
    "ProjectId": "project_id",
    "ContractId": "contract_id",
    "EntryDate": "entry_date",
    "RevisionNo": "revision_no",
    "RevisionDate": "revision_date",
    "YearId": "year_id",
    "Margin": "margin",
    "Remarks": "remarks",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}

ESTIMATION_MONTH_MAP = {
    "MonthlyBreakUpMasterId": "monthly_breakup_id",
    "MonthId": "month_id",
    "Invoice": "invoice",
    "Cost": "cost",
    "RevisedMargin": "revised_margin",
    "Collection": "collection",
    "Deduction": "deduction",
    "Remarks": "remarks",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}


async def _refresh_monthly_breakup_payload(db: AsyncSession, project_id: int = 0, contract_id: int = 0) -> dict:
    project_result = await db.execute(select(ProjectMaster).where(ProjectMaster.status != "9"))
    project_map = {row.id: row.project_code or "" for row in project_result.scalars().all()}
    contract_result = await db.execute(select(Contract).where(Contract.status != "9"))
    contract_map = {row.id: row.contract_name or "" for row in contract_result.scalars().all()}

    parent_stmt = select(MonthlyBreakup).where(MonthlyBreakup.status != "9").order_by(MonthlyBreakup.id)
    if project_id:
        parent_stmt = parent_stmt.where(MonthlyBreakup.project_id == project_id)
    if contract_id:
        parent_stmt = parent_stmt.where(MonthlyBreakup.contract_id == contract_id)
    parent_rows = (await db.execute(parent_stmt)).scalars().all()
    parent_ids = [row.id for row in parent_rows]

    child_stmt = select(EstimationMonth).where(EstimationMonth.status != "9").order_by(EstimationMonth.id)
    if parent_ids:
        child_stmt = child_stmt.where(EstimationMonth.monthly_breakup_id.in_(parent_ids))
    else:
        child_stmt = child_stmt.where(EstimationMonth.id == -1)
    child_rows = (await db.execute(child_stmt)).scalars().all()

    parent_data = []
    for row in parent_rows:
        payload = row.to_dict()
        payload["ProjectCode"] = project_map.get(row.project_id or 0, "")
        payload["ContractName"] = contract_map.get(row.contract_id or 0, "")
        parent_data.append(payload)

    child_data = [row.to_dict() for row in child_rows]
    return {"parentData": parent_data, "childData": child_data}


async def _refresh_estimation_months(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(EstimationMonth).where(EstimationMonth.status != "9").order_by(EstimationMonth.id))
    return [row.to_dict() for row in result.scalars().all()]


@router.post("/getMonthlyBreakUpDetailsData")
async def get_monthly_breakup(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    project_id = body.get("ProjectId") or body.get("projectId") or 0
    contract_id = body.get("ContractId") or body.get("contractId") or 0
    try:
        project_id = int(project_id)
    except (TypeError, ValueError):
        project_id = 0
    try:
        contract_id = int(contract_id)
    except (TypeError, ValueError):
        contract_id = 0
    return await _refresh_monthly_breakup_payload(db, project_id, contract_id)


@router.post("/saveMonthlyBreakUpDetailsData")
async def save_monthly_breakup(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    monthly_breakup_body = body.get("MonthlyBreakUp", body)
    detail_rows = body.get("MonthlyBreakUpDetails", [])

    parent = await upsert_model(db, MonthlyBreakup, monthly_breakup_body, "MonthlyBreakUpMasterId", MONTHLY_BREAKUP_MAP)

    await db.execute(sa_delete(EstimationMonth).where(EstimationMonth.monthly_breakup_id == parent.id))
    await db.flush()

    for row in detail_rows or []:
        payload = dict(row or {})
        payload["MonthlyBreakUpMasterId"] = parent.id
        payload["MonthlyBreakUpMasterDetailsId"] = payload.get("MonthlyBreakUpMasterDetailsId") or 0
        await upsert_model(db, EstimationMonth, payload, "MonthlyBreakUpMasterDetailsId", ESTIMATION_MONTH_MAP)

    return await _refresh_monthly_breakup_payload(db)


@router.post("/deleteMontlyBreakUpDetailsData")
async def delete_monthly_breakup(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    monthly_breakup_id = body.get("MonthlyBreakUpMasterId") or 0
    await soft_delete_model(db, MonthlyBreakup, monthly_breakup_id)
    if monthly_breakup_id:
        result = await db.execute(select(EstimationMonth).where(EstimationMonth.monthly_breakup_id == int(monthly_breakup_id)))
        for row in result.scalars().all():
            row.status = "9"
        await db.flush()
    return await _refresh_monthly_breakup_payload(db)


@router.get("/getEstimationMonths")
async def get_estimation_months(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _refresh_estimation_months(db)
