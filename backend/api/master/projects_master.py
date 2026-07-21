"""Project master + project details/attachments — MasterRecord-backed.

Kept separate from the core CCM `projects` table (backend.models.project),
which drives knowledge-base/SharePoint. These are the admin project-master rows.
"""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import mr_list, mr_save, mr_delete
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-projects"])
ENTITY, ID = "project_master", "ProjectMasterId"
DETAIL, DETAIL_ID = "project_detail", "ProjectDetailId"


@router.post("/getProjects")
async def get_projects(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_list(db, ENTITY, ID)


@router.post("/getProjectDetails")
async def get_project_details(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {ID: body.get("ProjectMasterId")} if body.get("ProjectMasterId") else None
    return await mr_list(db, DETAIL, DETAIL_ID, filters)


@router.post("/saveProjectDetails")
async def save_project(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, ENTITY, ID, body)


@router.post("/saveProjectDetailsData")
async def save_project_detail_data(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, DETAIL, DETAIL_ID, body)


@router.post("/deleteProjectDetails")
async def delete_project(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, ENTITY, ID, body)


@router.post("/deleteProjectDetailsData")
async def delete_project_detail_data(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, DETAIL, DETAIL_ID, body)
