"""
Phase 4 API — Review, Approve & Archive endpoints.
Human-in-the-loop workflow: approve, reject, send, archive, audit trail.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_role
from backend.database import get_db
from backend.models.user import User
from backend.services import review as review_service

router = APIRouter(prefix="/api/review", tags=["Review & Audit"])


@router.post("/{draft_id}/approve")
async def approve_draft(
    draft_id: UUID,
    reviewer_notes: str = Form(""),
    current_user: User = Depends(require_role("admin", "reviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Approve a draft response. Only admins and reviewers can approve."""
    try:
        result = await review_service.approve_draft(db, draft_id, reviewer_notes, current_user.id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{draft_id}/reject")
async def reject_draft(
    draft_id: UUID,
    feedback: str = Form(...),
    current_user: User = Depends(require_role("admin", "reviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Reject a draft with feedback for revision. Only admins and reviewers can reject."""
    try:
        result = await review_service.reject_draft(db, draft_id, feedback, current_user.id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{draft_id}/send")
async def mark_as_sent(
    draft_id: UUID,
    current_user: User = Depends(require_role("admin", "reviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Mark an approved draft as sent. Only admins and reviewers can send."""
    try:
        result = await review_service.mark_as_sent(db, draft_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/archive/{letter_id}")
async def archive_letter(
    letter_id: UUID,
    current_user: User = Depends(require_role("admin", "reviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Archive a letter and all its drafts. Only admins and reviewers can archive."""
    try:
        result = await review_service.archive_letter(db, letter_id, current_user.id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/audit")
async def get_audit_trail(
    entity_type: str = None,
    entity_id: str = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get audit trail entries. Only admins can view audit trail."""
    entries = await review_service.get_audit_trail(db, entity_type, entity_id)
    return {"audit_entries": entries}


@router.get("/dashboard/stats")
async def dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dashboard statistics."""
    stats = await review_service.get_dashboard_stats(db, current_user.id, current_user.role)
    return stats
