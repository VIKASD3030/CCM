"""Misc master endpoints: getTestApi, isRecordExists, reference documents."""
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import list_exists, upsert_model, soft_delete_model
from backend.api.master.activities import _refresh_activity_groups, _refresh_activities
from backend.api.master.common_roles import _refresh_roles
from backend.api.master.contracts import _refresh_contracts
from backend.api.master.modules import _refresh_module_groups
from backend.api.master.users import _refresh_users
from backend.models.reference_document import ReferenceDocument
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-misc"])
DOC_MAP = {
    "DocumentCode": "code",
    "DocumentName": "name",
    "ParentDocumentId": "parent_id",
    "ModuleGroupId": "module_group_id",
    "FileName": "file_name",
    "DocumentPath": "document_path",
    "Level": "level",
    "Remarks": "remarks",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}


async def _refresh_documents(db: AsyncSession, document_id: int = 0) -> list[dict]:
    name_result = await db.execute(select(ReferenceDocument).where(ReferenceDocument.status != "9"))
    name_map = {row.id: row.name or "" for row in name_result.scalars().all()}

    stmt = select(ReferenceDocument).where(ReferenceDocument.status != "9").order_by(ReferenceDocument.id)
    if document_id:
        stmt = stmt.where(ReferenceDocument.id == document_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    out = []
    for row in rows:
        payload = row.to_dict()
        payload["ParentDocumentName"] = name_map.get(row.parent_id or 0)
        out.append(payload)
    return out


@router.post("/getTestApi")
async def get_test_api(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return {"status": "ok", "message": "API reachable", "echo": body}


@router.post("/isRecordExists")
async def is_record_exists(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    # Frontend sends { Record, TableName }. Duplicate-check only the known
    # relational master entities that still expose this helper.
    table = body.get("TableName") or body.get("Entity") or "reference_document"
    record = body.get("Record")
    table_name = str(table or "").strip().lower()
    if isinstance(record, dict):
        if table_name == "activitygroup":
            rows = await _refresh_activity_groups(db)
            match = {
                "ActivityGroupId": record.get("ActivityGroupId"),
                "ActivityGroupCode": record.get("ActivityGroupCode"),
                "ActivityGroupName": record.get("ActivityGroupName"),
                "ProjectId": record.get("ProjectId"),
                "ContractId": record.get("ContractId"),
            }
            return await list_exists(rows, match, "ActivityGroupId")
        if table_name == "activitymaster":
            rows = await _refresh_activities(db, int(record.get("ActivityGroupId") or 0))
            match = {
                "ActivityId": record.get("ActivityId"),
                "ActivityCode": record.get("ActivityCode"),
                "ActivityName": record.get("ActivityName"),
                "ActivityGroupId": record.get("ActivityGroupId"),
                "ProjectId": record.get("ProjectId"),
                "ContractId": record.get("ContractId"),
            }
            return await list_exists(rows, match, "ActivityId")
        if table_name == "role":
            rows = await _refresh_roles(db)
            match = {
                "RoleId": record.get("RoleId"),
                "RoleCode": record.get("RoleCode"),
                "RoleName": record.get("RoleName"),
                "ParentRoleId": record.get("ParentRoleId"),
            }
            return await list_exists(rows, match, "RoleId")
        if table_name == "contractmaster":
            rows = await _refresh_contracts(db)
            match = {
                "ContractId": record.get("ContractId"),
                "ContractNo": record.get("ContractNo"),
                "ContractName": record.get("ContractName"),
                "ProjectId": record.get("ProjectId"),
                "ContractorId": record.get("ContractorId"),
                "ContractType": record.get("ContractType"),
            }
            return await list_exists(rows, match, "ContractId")
        if table_name == "modulegroup":
            rows = await _refresh_module_groups(db)
            match = {
                "ModuleGroupId": record.get("ModuleGroupId"),
                "ModuleGroupCode": record.get("ModuleGroupCode"),
                "ModuleGroupName": record.get("ModuleGroupName"),
                "ParentModuleGroupId": record.get("ParentModuleGroupId"),
            }
            return await list_exists(rows, match, "ModuleGroupId")
        if table_name == "document":
            rows = await _refresh_documents(db)
            match = {
                "DocumentId": record.get("DocumentId"),
                "DocumentCode": record.get("DocumentCode"),
                "DocumentName": record.get("DocumentName"),
                "ParentDocumentId": record.get("ParentDocumentId"),
            }
            return await list_exists(rows, match, "DocumentId")
        if table_name == "users":
            rows = await _refresh_users(db)
            match = {
                "UserId": record.get("UserId"),
                "AdUserName": record.get("AdUserName"),
                "EmployeeNo": record.get("EmployeeNo"),
                "EmailId": record.get("EmailId"),
            }
            return await list_exists(rows, match, "UserId")
    if record is None:
        return {"status": 0}
    return {"status": 0}


# ─── Reference Documents ────────────────────────────────────────────────

@router.get("/getDocuments")
async def get_documents(documentId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _refresh_documents(db, documentId)


@router.post("/saveDocuments")
async def save_documents(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await upsert_model(db, ReferenceDocument, body, "DocumentId", DOC_MAP)
    return await _refresh_documents(db)


@router.post("/deleteDocuments")
async def delete_documents(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await soft_delete_model(db, ReferenceDocument, body.get("DocumentId"))
    return await _refresh_documents(db)
