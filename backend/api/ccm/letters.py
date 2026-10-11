"""
Phase 2 API — Letter Intake endpoints.
Upload client letters, classify, list, and manage.
"""
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_permission
from backend.database import get_db
from backend.models.letter import InboundLetter
from backend.models.project import Project
from backend.models.user import User
from backend.services import letter_intake as letter_service
from backend.services import threads
from backend.services.job_queue import enqueue_job, get_arq_redis

router = APIRouter(prefix="/api/letters", tags=["Letters"])


async def _resolve_letter_project(db: AsyncSession, project_id: str | None) -> str | None:
    """CCM project id for a letter. A Master-module id ("master-3") resolves to
    its linked CCM workspace, or None when it has none yet."""
    if not project_id:
        return None
    if project_id.startswith("master-"):
        master_id = project_id.split("-", 1)[1]
        for p in (await db.execute(select(Project))).scalars().all():
            if str((p.project_metadata or {}).get("master_id")) == master_id:
                return str(p.id)
        return None
    try:
        return str(uuid.UUID(project_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project id")


@router.post("/upload")
async def upload_letter(
    file: UploadFile = File(...),
    project_id: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload and classify a new client letter, optionally scoped to a project."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "txt"
    content = await file.read()

    project_id = await _resolve_letter_project(db, project_id)

    try:
        # Fast path: extract text + save the letter only — no LLM call, so this
        # returns almost immediately regardless of file size.
        letter = await letter_service.intake_letter(db, file.filename, content, ext, current_user.id, project_id=project_id)

        # Classification (an LLM call) happens in the background so it never
        # holds up the upload response. If a draft is requested before this
        # finishes, generate_draft() classifies inline instead (~1-2s).
        arq_redis = await get_arq_redis()
        job = await enqueue_job(
            db=db,
            arq_redis=arq_redis,
            job_type="classify_letter_task",
            payload={"letter_id": str(letter.id)},
            created_by=current_user.id,
            background=True,
        )

        return {
            "status": "success",
            "letter": letter.to_dict(),
            "job": {"id": str(job.id), "status": "queued"},
        }
    except ValueError as e:
        # e.g. a scan that OCR could not read: tell the user why.
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Letter intake failed: {str(e)}")


@router.get("")
async def list_letters(
    status: str = None,
    category: str = None,
    project_id: str = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all letters with pagination, optionally filtered by status or category.
    Default limit is 50, max 200.
    """
    limit = min(limit, 200)
    letters, total = await letter_service.get_all_letters(
        db, status, category, project_id=await _resolve_letter_project(db, project_id) if project_id else None,
        user_id=current_user.id, user_role=current_user.role, skip=skip, limit=limit
    )
    await threads.enrich_letters(db, letters)
    return {"letters": letters, "total": total, "skip": skip, "limit": limit}


@router.get("/{letter_id}")
async def get_letter(
    letter_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific letter."""
    letter = await letter_service.get_letter_by_id(db, str(letter_id), current_user.id, current_user.role)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    await threads.enrich_letters(db, [letter])
    return {"letter": letter}


@router.get("/{letter_id}/thread")
async def letter_thread(
    letter_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Our replies that answer this letter, and the earlier letters it quotes."""
    letter = await db.get(InboundLetter, letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    return await threads.get_thread(db, letter)


@router.get("/{letter_id}/file")
async def letter_original_file(
    letter_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The letter as it was uploaded: the scan with its letterhead, stamps and signature."""
    from fastapi.responses import Response
    from backend.services.knowledge_base import CONTENT_TYPES
    from backend.services.storage import storage_backend

    letter = await db.get(InboundLetter, letter_id)
    if not letter or not letter.storage_path:
        raise HTTPException(status_code=404, detail="The original file isn't stored for this letter")
    data = await storage_backend.download(letter.storage_path)
    return Response(
        content=data,
        media_type=CONTENT_TYPES.get(letter.file_type or "", "application/octet-stream"),
        headers={"Content-Disposition": f'inline; filename="{letter.filename.replace(chr(34), "")}"'},
    )


@router.put("/{letter_id}/reclassify")
async def reclassify_letter(
    letter_id: uuid.UUID,
    category: str = Form(None),
    urgency: str = Form(None),
    current_user: User = Depends(require_permission("letters", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """Manually override a letter's classification. Only admins can reclassify."""
    letter = await letter_service.reclassify_letter(db, str(letter_id), category, urgency)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    return {"status": "success", "letter": letter}


@router.put("/{letter_id}/project")
async def assign_letter_project(
    letter_id: uuid.UUID,
    project_id: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm which project a letter belongs to. Drafting is blocked until a
    letter has a project, so replies only use that project's records."""
    letter = await db.get(InboundLetter, letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    pid = await _resolve_letter_project(db, project_id)
    if not pid:
        raise HTTPException(status_code=400, detail="Open this Master project in Projects first to create its workspace")
    if not await db.get(Project, uuid.UUID(pid)):
        raise HTTPException(status_code=404, detail="Project not found")
    letter.project_id = uuid.UUID(pid)
    await db.flush()
    return {"status": "success", "letter": letter.to_dict()}


@router.post("/{letter_id}/classify", status_code=202)
async def classify_letter_endpoint(
    letter_id: uuid.UUID,
    current_user: User = Depends(require_permission("letters", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """Enqueue letter classification as a background job. Returns HTTP 202."""
    arq_redis = await get_arq_redis()
    job = await enqueue_job(
        db=db,
        arq_redis=arq_redis,
        job_type="classify_letter_task",
        payload={"letter_id": str(letter_id)},
        created_by=current_user.id,
    )
    return {"job_id": str(job.id), "status": "queued"}
