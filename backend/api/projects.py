"""
Projects API — CRUD for project-scoped knowledge base and letters.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.database import get_db
from backend.models.project import Project
from backend.models.sharepoint_sync import SharePointSyncLog
from backend.models.user import User

router = APIRouter(prefix="/api/projects", tags=["Projects"])


@router.get("")
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active projects."""
    stmt = select(Project).where(Project.status == "active").order_by(Project.created_at.desc())
    result = await db.execute(stmt)
    projects = result.scalars().all()
    return {"projects": [p.to_dict() for p in projects]}


@router.post("")
async def create_project(
    name: str,
    sharepoint_site_id: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project."""
    project = Project(
        name=name,
        sharepoint_site_id=sharepoint_site_id,
    )
    db.add(project)
    await db.flush()
    return {"status": "success", "project": project.to_dict()}


@router.get("/{project_id}")
async def get_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get project details."""
    project = await db.get(Project, str(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": project.to_dict()}


@router.put("/{project_id}")
async def update_project(
    project_id: uuid.UUID,
    name: str = None,
    sharepoint_site_id: str = None,
    status: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a project."""
    project = await db.get(Project, str(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if name:
        project.name = name
    if sharepoint_site_id is not None:
        project.sharepoint_site_id = sharepoint_site_id
    if status:
        project.status = status
    await db.flush()
    return {"status": "success", "project": project.to_dict()}


@router.delete("/{project_id}")
async def delete_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a project."""
    project = await db.get(Project, str(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.status = "archived"
    await db.flush()
    return {"status": "success", "message": "Project archived"}


@router.get("/{project_id}/sync-logs")
async def get_sync_logs(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get SharePoint sync logs for a project."""
    stmt = (
        select(SharePointSyncLog)
        .where(SharePointSyncLog.project_id == str(project_id))
        .order_by(SharePointSyncLog.last_synced_at.desc())
        .limit(20)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return {
        "logs": [
            {
                "id": str(log.id),
                "project_id": str(log.project_id),
                "sync_status": log.sync_status,
                "files_synced": log.files_synced,
                "files_deleted": log.files_deleted,
                "error_message": log.error_message,
                "last_synced_at": log.last_synced_at.isoformat() if log.last_synced_at else None,
            }
            for log in logs
        ]
    }


@router.get("/{project_id}/stats")
async def project_stats(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get project-level statistics."""
    from backend.models.letter import InboundLetter
    from backend.models.document import KnowledgeDocument, DocumentChunk

    letter_count = await db.execute(
        select(func.count()).select_from(InboundLetter)
        .where(InboundLetter.project_id == str(project_id))
    )
    doc_count = await db.execute(
        select(func.count()).select_from(KnowledgeDocument)
        .where(KnowledgeDocument.project_id == str(project_id))
    )
    chunk_count = await db.execute(
        select(func.count()).select_from(DocumentChunk)
        .join(KnowledgeDocument, DocumentChunk.document_id == KnowledgeDocument.id)
        .where(KnowledgeDocument.project_id == str(project_id))
    )
    latest_sync = await db.execute(
        select(SharePointSyncLog)
        .where(SharePointSyncLog.project_id == str(project_id))
        .order_by(SharePointSyncLog.last_synced_at.desc())
        .limit(1)
    )
    sync_log = latest_sync.scalar_one_or_none()

    return {
        "project_id": str(project_id),
        "total_letters": letter_count.scalar() or 0,
        "total_documents": doc_count.scalar() or 0,
        "total_chunks": chunk_count.scalar() or 0,
        "last_sync": {
            "status": sync_log.sync_status if sync_log else None,
            "last_synced_at": sync_log.last_synced_at.isoformat() if sync_log else None,
            "files_synced": sync_log.files_synced if sync_log else None,
        } if sync_log else None,
    }
