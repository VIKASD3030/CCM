"""
Phase 2 API — Letter Intake endpoints.
Upload client letters, classify, list, and manage.
"""
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_role
from backend.database import get_db
from backend.models.user import User
from backend.services import letter_intake as letter_service
from backend.services.job_queue import enqueue_job, get_arq_redis

router = APIRouter(prefix="/api/letters", tags=["Letters"])


@router.post("/upload")
async def upload_letter(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload and classify a new client letter."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "txt"
    content = await file.read()

    try:
        letter = await letter_service.intake_letter(db, file.filename, content, ext, current_user.id)

        # Enqueue classification as background job
        arq_redis = await get_arq_redis()
        job = await enqueue_job(
            db=db,
            arq_redis=arq_redis,
            job_type="classify_letter_task",
            payload={"letter_id": str(letter.id)},
            created_by=current_user.id,
        )

        return {
            "status": "success",
            "letter": letter.to_dict(),
            "job": {"id": str(job.id), "status": "queued"},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Letter intake failed: {str(e)}")


@router.get("")
async def list_letters(
    status: str = None,
    category: str = None,
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
        db, status, category, current_user.id, current_user.role, skip=skip, limit=limit
    )
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
    return {"letter": letter}


@router.put("/{letter_id}/reclassify")
async def reclassify_letter(
    letter_id: uuid.UUID,
    category: str = Form(None),
    urgency: str = Form(None),
    current_user: User = Depends(require_role("admin", "reviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Manually override a letter's classification. Only admins and reviewers can reclassify."""
    letter = await letter_service.reclassify_letter(db, str(letter_id), category, urgency)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    return {"status": "success", "letter": letter}


@router.post("/{letter_id}/classify", status_code=202)
async def classify_letter_endpoint(
    letter_id: uuid.UUID,
    current_user: User = Depends(require_role("admin", "reviewer")),
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
