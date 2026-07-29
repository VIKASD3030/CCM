"""Contract master backed by a dedicated table."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import upsert_model, soft_delete_model
from backend.models.user import User
from backend.models.contract import Contract
from backend.models.project_master import ProjectMaster
from backend.models.contractor import Contractor

router = APIRouter(prefix="/common", tags=["master-contracts"])

CONTRACT_MAP = {
    "ContractNo": "contract_no",
    "ContractName": "contract_name",
    "ProjectId": "project_id",
    "ProjectMasterId": "project_id",
    "ContractorId": "contractor_id",
    "ContractType": "contract_type",
    "ContractStartDate": "contract_start_date",
    "ContractEndDate": "contract_end_date",
    "ContractValue": "contract_value",
    "SectionValue": "section_value",
    "ClientName": "client_name",
    "ConsultantName": "consultant_name",
    "ShortDescription": "short_description",
    "Remarks": "remarks",
    "FileName": "file_name",
    "DocumentPath": "document_path",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}


async def _refresh_contracts(db: AsyncSession, project_id: int = 0) -> list[dict]:
    project_result = await db.execute(select(ProjectMaster).where(ProjectMaster.status != "9"))
    project_map = {row.id: row.project_name or row.project_code or "" for row in project_result.scalars().all()}

    contractor_result = await db.execute(select(Contractor).where(Contractor.status != "9"))
    contractor_map = {row.id: row.contractor_name or "" for row in contractor_result.scalars().all()}

    stmt = select(Contract).where(Contract.status != "9").order_by(Contract.id)
    if project_id:
        stmt = stmt.where(Contract.project_id == project_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    out = []
    for row in rows:
        payload = row.to_dict()
        payload["ProjectName"] = project_map.get(row.project_id or 0, "")
        payload["ContractorName"] = contractor_map.get(row.contractor_id or 0, "")
        out.append(payload)
    return out


@router.post("/getContracts")
async def get_contracts(
    body: dict[str, Any] = {},
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project_id = body.get("ProjectMasterId") or body.get("ProjectId") or body.get("projectId") or 0
    try:
        project_id = int(project_id)
    except (TypeError, ValueError):
        project_id = 0
    return await _refresh_contracts(db, project_id)


@router.post("/saveContractDetails")
async def save_contract(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await upsert_model(db, Contract, body, "ContractId", CONTRACT_MAP)
    return await _refresh_contracts(db)


@router.post("/deleteContractDetails")
async def delete_contract(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await soft_delete_model(db, Contract, body.get("ContractId"))
    return await _refresh_contracts(db)
