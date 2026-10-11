"""
Projects API — CRUD for project-scoped knowledge base and letters.
"""
import uuid

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.database import get_db
from backend.models.letter import InboundLetter
from backend.models.project import Project
from backend.models.project_master import ProjectMaster
from backend.models.sharepoint_sync import SharePointSyncLog
from backend.models.user import User
from backend.services.knowledge_base import get_folder_summary

router = APIRouter(prefix="/api/projects", tags=["Projects"])


def readiness(folders: dict, project: dict) -> dict:
    """Drafting readiness: the four things a project needs before its drafts
    can cite the right records. Each is worth 25%."""
    checks = [
        {"key": "contract_volume", "label": "Contract volumes indexed", "ok": folders["contract_volume"]["indexed"] > 0},
        {"key": "outgoing_letter", "label": "Outgoing letters indexed", "ok": folders["outgoing_letter"]["indexed"] > 0},
        {"key": "incoming_letter", "label": "Incoming letters indexed", "ok": folders["incoming_letter"]["indexed"] > 0},
        {"key": "brief", "label": "Project brief verified", "ok": bool(project.get("brief")) and bool(project.get("brief_verified"))},
    ]
    return {"percent": 25 * sum(c["ok"] for c in checks), "checks": checks}


async def _letter_counts(db: AsyncSession, project_ids: list[str]) -> dict:
    if not project_ids:
        return {}
    rows = (await db.execute(
        select(InboundLetter.project_id, func.count())
        .where(InboundLetter.project_id.in_(project_ids))
        .group_by(InboundLetter.project_id)
    )).all()
    return {str(pid): n for pid, n in rows}


@router.get("")
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List active projects — CCM projects (with folder summary and drafting
    readiness) plus Master module projects that have no CCM workspace yet."""
    # 1. CCM-native projects
    stmt = select(Project).where(Project.status == "active").order_by(Project.created_at.desc())
    result = await db.execute(stmt)
    ccm_rows = result.scalars().all()
    ids = [str(p.id) for p in ccm_rows]
    folders = await get_folder_summary(db, ids)
    letters = await _letter_counts(db, ids)

    projects = []
    linked_master_ids = set()
    for p in ccm_rows:
        d = p.to_dict()
        if d.get("master_id") is not None:
            linked_master_ids.add(str(d["master_id"]))
        f = folders.get(d["id"])
        d["folders"] = f
        d["letters"] = letters.get(d["id"], 0)
        d["readiness"] = readiness(f, d)
        projects.append(d)

    # 2. Master module projects (from Master.project_master table) not yet linked
    stmt2 = select(ProjectMaster).where(
        ProjectMaster.status != "9",
    ).order_by(ProjectMaster.id)
    result2 = await db.execute(stmt2)
    for row in result2.scalars().all():
        if str(row.id) in linked_master_ids:
            continue
        projects.append({
            "id": f"master-{row.id}",
            "master_id": row.id,
            "name": row.project_name or row.project_code or f"Project #{row.id}",
            "project_code": row.project_code,
            "client_name": row.client_name,
            "business_unit": row.business_unit,
            "business_line": row.business_line,
            "sharepoint_site_id": None,
            "status": "active",
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "source": "master",
            "folders": None,
            "letters": 0,
            "readiness": {"percent": 0, "checks": []},
        })

    return {"projects": projects}


@router.post("")
async def create_project(
    name: str = Form(...),
    sharepoint_site_id: str = Form(None),
    client_name: str = Form(None),
    project_code: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project."""
    if not name.strip():
        raise HTTPException(status_code=400, detail="Project name is required")
    meta = {k: v for k, v in {"client_name": client_name, "project_code": project_code}.items() if v}
    project = Project(
        name=name.strip(),
        sharepoint_site_id=sharepoint_site_id or None,
        project_metadata=meta or None,
    )
    db.add(project)
    await db.flush()
    return {"status": "success", "project": project.to_dict()}


@router.post("/link-master/{master_id}")
async def link_master_project(
    master_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create (or return) the CCM workspace for a Master module project, so it
    can hold folders, letters and drafts."""
    existing = (await db.execute(select(Project))).scalars().all()
    for p in existing:
        if str((p.project_metadata or {}).get("master_id")) == str(master_id):
            return {"status": "success", "project": p.to_dict()}

    row = await db.get(ProjectMaster, master_id)
    if not row:
        raise HTTPException(status_code=404, detail="Master project not found")
    project = Project(
        name=row.project_name or row.project_code or f"Project #{row.id}",
        project_metadata={
            "master_id": row.id,
            "project_code": row.project_code,
            "client_name": row.client_name,
        },
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
    """Get project details, folder summary and drafting readiness."""
    project = await db.get(Project, str(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    d = project.to_dict()
    folders = (await get_folder_summary(db, [d["id"]]))[d["id"]]
    d["folders"] = folders
    d["letters"] = (await _letter_counts(db, [d["id"]])).get(d["id"], 0)
    d["readiness"] = readiness(folders, d)
    return {"project": d}


@router.put("/{project_id}")
async def update_project(
    project_id: uuid.UUID,
    name: str = Form(None),
    sharepoint_site_id: str = Form(None),
    status: str = Form(None),
    brief: str = Form(None),
    brief_verified: bool = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a project. `brief` is the project memory used in every draft."""
    project = await db.get(Project, str(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if name:
        project.name = name
    if sharepoint_site_id is not None:
        project.sharepoint_site_id = sharepoint_site_id
    if status:
        project.status = status
    if brief is not None or brief_verified is not None:
        meta = dict(project.project_metadata or {})
        if brief is not None:
            meta["brief"] = brief
            # Editing the brief needs a fresh verification unless sent together.
            if brief_verified is None:
                meta["brief_verified"] = False
        if brief_verified is not None:
            meta["brief_verified"] = bool(brief_verified)
        project.project_metadata = meta  # reassign so SQLAlchemy sees the JSONB change
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


@router.post("/{project_id}/sync", status_code=202)
async def sync_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a SharePoint sync of this project's document library."""
    from backend.services.job_queue import enqueue_job, get_arq_redis

    project = await db.get(Project, str(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.sharepoint_site_id:
        raise HTTPException(status_code=400, detail="Add a SharePoint site ID to this project first")
    job = await enqueue_job(
        db=db,
        arq_redis=await get_arq_redis(),
        job_type="sharepoint_sync_task",
        payload={"project_id": str(project_id)},
        created_by=current_user.id,
        background=True,
    )
    return {"job_id": str(job.id), "status": "queued"}


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
        "folders": (await get_folder_summary(db, [str(project_id)]))[str(project_id)],
        "last_sync": {
            "status": sync_log.sync_status if sync_log else None,
            "last_synced_at": sync_log.last_synced_at.isoformat() if sync_log else None,
            "files_synced": sync_log.files_synced if sync_log else None,
        } if sync_log else None,
    }
