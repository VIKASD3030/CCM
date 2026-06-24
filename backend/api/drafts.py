"""
Phase 3 API — Draft Generation endpoints.
Generate AI drafts, regenerate with feedback, edit manually.
"""
import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_role
from backend.api.limiter import limiter
from backend.database import get_db
from backend.models.user import User
from backend.services import drafting as draft_service
from backend.services.job_queue import enqueue_job, get_arq_redis

router = APIRouter(prefix="/api/drafts", tags=["Drafts"])


@router.post("", status_code=202)
@limiter.limit("10/minute")
async def create_draft(
    request: Request,
    letter_id: uuid.UUID = Form(...),
    tone: str = Form(""),
    instructions: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enqueue a draft generation job. Returns HTTP 202 with job_id.
    Rate limited: 10/minute per user.
    """
    arq_redis = await get_arq_redis()
    job = await enqueue_job(
        db=db,
        arq_redis=arq_redis,
        job_type="generate_draft_task",
        payload={
            "letter_id": str(letter_id),
            "tone": tone or instructions,
        },
        created_by=current_user.id,
    )
    return {"job_id": str(job.id), "status": "queued"}


@router.post("/generate/{letter_id}", status_code=202)
@limiter.limit("10/minute")
async def generate_draft(
    request: Request,
    letter_id: uuid.UUID,
    tone: str = Form(""),
    instructions: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI draft response for a letter. Returns HTTP 202 with job_id.
    Rate limited: 10/minute per user.
    """
    arq_redis = await get_arq_redis()
    job = await enqueue_job(
        db=db,
        arq_redis=arq_redis,
        job_type="generate_draft_task",
        payload={
            "letter_id": str(letter_id),
            "tone": tone or instructions,
        },
        created_by=current_user.id,
    )
    return {"job_id": str(job.id), "status": "queued"}


@router.get("/{draft_id}")
async def get_draft(
    draft_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific draft."""
    draft = await draft_service.get_draft_by_id(db, str(draft_id), current_user.id, current_user.role)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"draft": draft}


@router.put("/{draft_id}")
async def update_draft(
    draft_id: uuid.UUID,
    draft_text: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually edit a draft's text."""
    draft = await draft_service.update_draft_text(db, str(draft_id), draft_text, current_user.id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"status": "success", "draft": draft}


@router.post("/{draft_id}/regenerate")
@limiter.limit("10/minute")
async def regenerate_draft(
    request: Request,
    draft_id: uuid.UUID,
    feedback: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-generate a draft with feedback/adjustments.
    Rate limited: 10/minute per user.
    """
    try:
        draft = await draft_service.regenerate_draft(db, str(draft_id), feedback, current_user.id)
        return {"status": "success", "draft": draft.to_dict()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")


@router.get("/letter/{letter_id}")
async def get_drafts_for_letter(
    letter_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all draft versions for a letter."""
    drafts = await draft_service.get_drafts_for_letter(db, str(letter_id), current_user.id, current_user.role)
    return {"drafts": drafts}
