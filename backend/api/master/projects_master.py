"""Project master + project details backed by dedicated tables."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import upsert_model, soft_delete_model
from backend.models.user import User
from backend.models.project_master import ProjectMaster
from backend.models.project_detail import ProjectDetail
from backend.models.contract import Contract

router = APIRouter(prefix="/common", tags=["master-projects"])

PROJECT_DETAIL_MAP = {
    "ProjectId": "project_id",
    "ProjectMasterId": "project_id",
    "ContractId": "contract_id",
    "LOADate": "loa_date",
    "Currency": "currency",
    "StartDate": "start_date",
    "EndDate": "end_date",
    "OriginalContractValue": "original_contract_value",
    "Margin": "margin",
    "ClientName": "client_name",
    "ContractType": "contract_type",
    "ProjectDescription": "project_description",
    "Remarks": "remarks",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}


async def _refresh_list(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(ProjectMaster).order_by(ProjectMaster.id))
    rows = result.scalars().all()
    return [r.to_dict() for r in rows if (r.status or "1") != "9"]


async def _refresh_project_details(db: AsyncSession, project_id: int = 0) -> list[dict]:
    project_result = await db.execute(select(ProjectMaster).where(ProjectMaster.status != "9"))
    project_rows = project_result.scalars().all()
    project_code_map = {row.id: row.project_code or "" for row in project_rows}

    contract_result = await db.execute(select(Contract).where(Contract.status != "9"))
    contract_rows = contract_result.scalars().all()
    contract_name_map = {row.id: row.contract_name or "" for row in contract_rows}

    stmt = select(ProjectDetail).where(ProjectDetail.status != "9").order_by(ProjectDetail.id)
    if project_id:
        stmt = stmt.where(ProjectDetail.project_id == project_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    out = []
    for row in rows:
        payload = row.to_dict()
        payload["ProjectCode"] = project_code_map.get(row.project_id or 0, "")
        payload["ContractName"] = contract_name_map.get(row.contract_id or 0, "")
        out.append(payload)
    return out


@router.post("/getProjects")
async def get_projects(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _refresh_list(db)


@router.get("/getProjects")
async def get_projects_query(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _refresh_list(db)


@router.post("/getProjectDetails")
async def get_project_details(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    project_id = body.get("ProjectMasterId") or body.get("ProjectId") or body.get("projectId") or 0
    try:
        project_id = int(project_id)
    except (TypeError, ValueError):
        project_id = 0
    return await _refresh_project_details(db, project_id)


@router.post("/saveProjectDetails")
async def save_project(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    pk = body.get("ProjectMasterId") or 0
    if isinstance(pk, str):
        pk = int(pk) if pk.strip() else 0

    obj = await db.get(ProjectMaster, pk) if pk else None
    if obj is None:
        obj = ProjectMaster()
        db.add(obj)

    obj.project_code = body.get("ProjectCode", obj.project_code or "")
    obj.project_name = body.get("ProjectName", obj.project_name or "")
    obj.client_name = body.get("ClientName", obj.client_name)
    obj.business_unit = body.get("BusinessUnit", obj.business_unit)
    obj.business_line = body.get("BusinessLine", obj.business_line)
    obj.project_manager_id = str(body.get("ProjectManagerId", "")) if body.get("ProjectManagerId") else obj.project_manager_id
    obj.project_director_id = str(body.get("ProjectDirectorId", "")) if body.get("ProjectDirectorId") else obj.project_director_id
    obj.pmo_id = str(body.get("PMOID", "")) if body.get("PMOID") else obj.pmo_id
    obj.project_data_source = body.get("ProjectDataSource", obj.project_data_source)
    obj.parent_project_master_id = str(body.get("ParentProjectMasterId", "0")) if body.get("ParentProjectMasterId") is not None else obj.parent_project_master_id
    obj.remarks = body.get("Remarks", obj.remarks)
    obj.status = str(body.get("Status", obj.status or "1"))
    obj.created_by = body.get("CreatedBy", obj.created_by)
    obj.created_date = body.get("CreatedDate", obj.created_date)
    obj.locked_by = body.get("LockedBy", obj.locked_by)
    obj.locked_date = body.get("LockedDate", obj.locked_date)
    obj.security_id = body.get("SecurityId", obj.security_id)

    await db.flush()
    return await _refresh_list(db)


@router.post("/saveProjectDetailsData")
async def save_project_detail_data(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    payload = dict(body or {})
    payload["ProjectDetailId"] = payload.get("ProjectDetailId") or payload.get("ProjectDetailsId") or 0
    await upsert_model(db, ProjectDetail, payload, "ProjectDetailId", PROJECT_DETAIL_MAP)
    return await _refresh_project_details(db)


@router.post("/deleteProjectDetails")
async def delete_project(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    pk = body.get("ProjectMasterId") or 0
    if isinstance(pk, str):
        pk = int(pk) if pk.strip() else 0
    if pk:
        obj = await db.get(ProjectMaster, pk)
        if obj is not None:
            obj.status = "9"
            await db.flush()
    return await _refresh_list(db)


@router.post("/deleteProjectDetailsData")
async def delete_project_detail_data(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    project_detail_id = body.get("ProjectDetailId") or body.get("ProjectDetailsId") or 0
    await soft_delete_model(db, ProjectDetail, project_detail_id)
    return await _refresh_project_details(db)
