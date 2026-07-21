"""
/common router — enterprise reference data with full CRUD:
Lookup, Department, Location, Designation, Unit.

All endpoints return PascalCase JSON matching the React frontend contract:
bare arrays; save/delete return the full refreshed list. See _helpers.py.
"""
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import refresh_list, upsert_model, delete_model
from backend.models.user import User
from backend.models.lookup import Lookup
from backend.models.department import Department
from backend.models.location import Location
from backend.models.designation import Designation
from backend.models.unit import Unit

logger = structlog.get_logger()
router = APIRouter(prefix="/common", tags=["master-common"])


# ─── Lookups ────────────────────────────────────────────────────────────

LOOKUP_MAP = {
    "LookupType": "lookup_type", "LookupCode": "lookup_code",
    "LookupName": "lookup_name", "Description": "description", "Status": "status",
}


@router.post("/getLookupDetails")
async def get_lookup_details(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {"lookup_type": body.get("LookupType")} if body.get("LookupType") else None
    return await refresh_list(db, Lookup, filters, Lookup.id)


@router.get("/getLookupDetails")
async def get_lookup_details_query(LookupId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {"id": LookupId} if LookupId else None
    return await refresh_list(db, Lookup, filters, Lookup.id)


@router.post("/saveLookupDetails")
async def save_lookup_details(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await upsert_model(db, Lookup, body, "LookupId", LOOKUP_MAP)
    return await refresh_list(db, Lookup, order_col=Lookup.id)


@router.post("/deleteLookupDetails")
async def delete_lookup_details(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await delete_model(db, Lookup, body.get("LookupId"))
    return await refresh_list(db, Lookup, order_col=Lookup.id)


# ─── Department ─────────────────────────────────────────────────────────

DEPT_MAP = {
    "DepartmentCode": "code", "DepartmentName": "name",
    "ParentDepartmentId": "parent_id", "Level": "level",
    "Remarks": "remarks", "Status": "status",
}


@router.get("/getDepartments")
async def get_departments(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await refresh_list(db, Department, order_col=Department.id)


@router.post("/saveDepartmentDetails")
async def save_department(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await upsert_model(db, Department, body, "DepartmentId", DEPT_MAP)
    return await refresh_list(db, Department, order_col=Department.id)


@router.post("/saveDepartmentBulkDetails")
async def save_department_bulk(body: Any, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = body if isinstance(body, list) else body.get("Departments", body.get("data", []))
    for row in rows:
        await upsert_model(db, Department, row, "DepartmentId", DEPT_MAP)
    return await refresh_list(db, Department, order_col=Department.id)


@router.post("/deleteDepartmentDetails")
async def delete_department(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await delete_model(db, Department, body.get("DepartmentId"))
    return await refresh_list(db, Department, order_col=Department.id)


# ─── Location ───────────────────────────────────────────────────────────

LOC_MAP = {
    "LocationName": "name", "ParentLocationId": "parent_id",
    "Level": "level", "Remarks": "remarks", "Status": "status",
}


@router.get("/getLocations")
async def get_locations(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await refresh_list(db, Location, order_col=Location.id)


@router.post("/saveLocationDetails")
async def save_location(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await upsert_model(db, Location, body, "LocationId", LOC_MAP)
    return await refresh_list(db, Location, order_col=Location.id)


@router.post("/deleteLocationDetails")
async def delete_location(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await delete_model(db, Location, body.get("LocationId"))
    return await refresh_list(db, Location, order_col=Location.id)


# ─── Designation ────────────────────────────────────────────────────────

DESIG_MAP = {
    "DesignationCode": "code", "DesignationName": "name",
    "ParentDesignationId": "parent_id", "Level": "level",
    "Remarks": "remarks", "Status": "status",
}


@router.get("/getDesignations")
async def get_designations(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await refresh_list(db, Designation, order_col=Designation.id)


@router.post("/saveDesignationDetails")
async def save_designation(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await upsert_model(db, Designation, body, "DesignationId", DESIG_MAP)
    return await refresh_list(db, Designation, order_col=Designation.id)


@router.post("/deleteDesignationDetails")
async def delete_designation(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await delete_model(db, Designation, body.get("DesignationId"))
    return await refresh_list(db, Designation, order_col=Designation.id)


# ─── Unit ───────────────────────────────────────────────────────────────

UNIT_MAP = {
    "UnitCode": "code", "UnitName": "name", "ParentUnitId": "parent_id",
    "Level": "level", "Remarks": "remarks", "Status": "status",
}


@router.get("/getUnits")
async def get_units(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await refresh_list(db, Unit, order_col=Unit.id)


@router.post("/saveUnitDetails")
async def save_unit(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await upsert_model(db, Unit, body, "UnitId", UNIT_MAP)
    return await refresh_list(db, Unit, order_col=Unit.id)


@router.post("/SaveUnitBulkDetails")
async def save_unit_bulk(body: Any, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = body if isinstance(body, list) else body.get("Units", body.get("data", []))
    for row in rows:
        await upsert_model(db, Unit, row, "UnitId", UNIT_MAP)
    return await refresh_list(db, Unit, order_col=Unit.id)


@router.post("/deleteUnitDetails")
async def delete_unit(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await delete_model(db, Unit, body.get("UnitId"))
    return await refresh_list(db, Unit, order_col=Unit.id)
