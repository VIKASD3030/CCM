"""Misc master endpoints: getTestApi, isRecordExists."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import list_exists
from backend.api.master.common_roles import _refresh_roles
from backend.api.master.contracts import _refresh_contracts
from backend.api.master.modules import _refresh_module_groups
from backend.api.master.users import _refresh_users
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-misc"])


@router.post("/getTestApi")
async def get_test_api(body: dict[str, Any] = {}, _: User = Depends(get_current_user)):
    return {"status": "ok", "message": "API reachable", "echo": body}


@router.post("/isRecordExists")
async def is_record_exists(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    table = body.get("TableName") or body.get("Entity") or ""
    record = body.get("Record")
    table_name = str(table or "").strip().lower()
    if isinstance(record, dict):
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
