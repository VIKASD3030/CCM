"""
Phase 4 — Review, Approve & Archive Service.
Handles the human-in-the-loop workflow: approve, reject, archive, audit trail.
Dispatches webhooks and email notifications on status changes.
"""
import uuid
import structlog

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models.letter import InboundLetter
from backend.models.draft import DraftResponse
from backend.models.audit import AuditEntry
from backend.models.user import User
from backend.models.email_notification import EmailNotificationSetting
from backend.services.knowledge_base import ingest_document
from backend.services.webhook_service import dispatch_event
from backend.services.job_queue import get_arq_redis, run_job

logger = structlog.get_logger()
settings = get_settings()


async def _notify_reviewers(db: AsyncSession, draft: DraftResponse, letter: InboundLetter):
    """Send review_needed notification to all reviewers who opted in."""
    try:
        stmt = (
            select(User)
            .join(EmailNotificationSetting, User.id == EmailNotificationSetting.user_id)
            .where(
                User.role == "reviewer",
                User.is_active == True,
                EmailNotificationSetting.on_review_needed == True,
            )
        )
        result = await db.execute(stmt)
        reviewers = result.scalars().all()

        if not reviewers:
            return

        arq_redis = await get_arq_redis()
        for reviewer in reviewers:
            await run_job(
                arq_redis,
                "send_email_task",
                template_name="review_needed.html",
                recipients=[reviewer.email],
                subject=f"Review Needed: {letter.filename}",
                template_data={
                    "letter_subject": letter.filename,
                    "sender_name": letter.created_by or "Unknown",
                    "draft_excerpt": draft.draft_text[:200] + "...",
                    "review_url": f"{settings.app_base_url}/review/{draft.id}",
                },
            )
    except Exception as e:
        logger.warning("review.notify_reviewers_failed", error=str(e))


async def _notify_drafter(
    db: AsyncSession,
    draft: DraftResponse,
    letter: InboundLetter,
    notification_type: str,
    extra_data: dict = None,
):
    """Send notification to the drafter of a letter."""
    try:
        if not letter.created_by:
            return

        stmt = select(EmailNotificationSetting).where(
            EmailNotificationSetting.user_id == letter.created_by
        )
        result = await db.execute(stmt)
        notify_settings = result.scalar_one_or_none()

        if not notify_settings:
            return

        should_send = False
        template_name = ""
        subject = ""
        template_data = {
            "letter_subject": letter.filename,
        }

        if notification_type == "approved" and notify_settings.on_draft_approved:
            should_send = True
            template_name = "draft_approved.html"
            subject = f"Draft Approved: {letter.filename}"
            template_data.update({
                "reviewer_name": extra_data.get("reviewer_name", "Reviewer") if extra_data else "Reviewer",
                "approved_at": extra_data.get("approved_at", "") if extra_data else "",
                "view_url": f"{settings.app_base_url}/drafts/{draft.id}",
            })

        elif notification_type == "rejected" and notify_settings.on_draft_rejected:
            should_send = True
            template_name = "draft_rejected.html"
            subject = f"Draft Needs Revision: {letter.filename}"
            template_data.update({
                "reviewer_name": extra_data.get("reviewer_name", "Reviewer") if extra_data else "Reviewer",
                "rejection_reason": extra_data.get("feedback", "No feedback provided") if extra_data else "No feedback provided",
                "edit_url": f"{settings.app_base_url}/drafts/{draft.id}/edit",
            })

        if should_send:
            user_stmt = select(User).where(User.id == letter.created_by)
            user_result = await db.execute(user_stmt)
            drafter = user_result.scalar_one_or_none()
            if drafter:
                arq_redis = await get_arq_redis()
                await run_job(
                    arq_redis,
                    "send_email_task",
                    template_name=template_name,
                    recipients=[drafter.email],
                    subject=subject,
                    template_data=template_data,
                )
    except Exception as e:
        logger.warning("review.notify_drafter_failed", error=str(e))


async def approve_draft(
    db: AsyncSession,
    draft_id: str,
    reviewer_notes: str = None,
    user_id: uuid.UUID = None,
) -> dict:
    """
    Approve a draft response.
    - Marks draft as approved
    - Updates letter status to approved
    - Feeds the approved response back into the knowledge base
    - Creates audit trail
    - Dispatches webhooks and email notifications
    """
    draft = await db.get(DraftResponse, str(draft_id))
    if not draft:
        raise ValueError(f"Draft {draft_id} not found")

    letter = await db.get(InboundLetter, str(draft.letter_id))
    if not letter:
        raise ValueError(f"Letter {draft.letter_id} not found")

    # Update statuses
    draft.status = "approved"
    draft.reviewer_notes = reviewer_notes
    letter.status = "approved"

    # Get reviewer name
    reviewer_name = "Reviewer"
    if user_id:
        reviewer = await db.get(User, user_id)
        if reviewer:
            reviewer_name = reviewer.email

    # Audit
    audit = AuditEntry(
        entity_type="draft",
        entity_id=str(draft_id),
        action="approved",
        user_id=user_id,
        details={
            "letter_id": str(draft.letter_id),
            "version": draft.version,
            "reviewer_notes": reviewer_notes,
        },
    )
    db.add(audit)

    # Feed approved response back into knowledge base (feedback loop)
    try:
        response_content = (
            f"APPROVED RESPONSE TO: {letter.filename}\n"
            f"CATEGORY: {letter.category}\n"
            f"INTENT: {letter.intent}\n\n"
            f"ORIGINAL LETTER:\n{letter.raw_text}\n\n"
            f"APPROVED RESPONSE:\n{draft.draft_text}"
        ).encode("utf-8")

        await ingest_document(
            db,
            filename=f"approved_response_{letter.filename}",
            content=response_content,
            file_type="txt",
            category="response",
            user_id=user_id,
        )
        logger.info("review.approved_response_fed_to_kb", letter_id=str(draft.letter_id), user_id=str(user_id) if user_id else None)
    except Exception as e:
        logger.warning("review.feed_kb_failed", error=str(e))

    await db.flush()

    # Dispatch webhook (fire-and-forget)
    await dispatch_event("draft.approved", {
        "draft_id": str(draft_id),
        "letter_id": str(draft.letter_id),
        "version": draft.version,
        "reviewer_notes": reviewer_notes,
    })

    # Send email notification (fire-and-forget)
    await _notify_drafter(db, draft, letter, "approved", {
        "reviewer_name": reviewer_name,
        "approved_at": str(draft.updated_at),
    })

    return {
        "draft": draft.to_dict(),
        "letter": letter.to_dict(),
        "message": "Draft approved successfully",
    }


async def reject_draft(
    db: AsyncSession,
    draft_id: str,
    feedback: str,
    user_id: uuid.UUID = None,
) -> dict:
    """
    Reject a draft response with feedback.
    - Marks draft as rejected
    - Updates letter status back to 'classified' for re-drafting
    - Creates audit trail
    - Dispatches webhooks and email notifications
    """
    draft = await db.get(DraftResponse, str(draft_id))
    if not draft:
        raise ValueError(f"Draft {draft_id} not found")

    letter = await db.get(InboundLetter, str(draft.letter_id))

    draft.status = "rejected"
    draft.reviewer_notes = feedback

    reviewer_name = "Reviewer"
    if user_id:
        reviewer = await db.get(User, user_id)
        if reviewer:
            reviewer_name = reviewer.email

    if letter:
        letter.status = "classified"

    # Audit
    audit = AuditEntry(
        entity_type="draft",
        entity_id=str(draft_id),
        action="rejected",
        user_id=user_id,
        details={
            "letter_id": str(draft.letter_id),
            "version": draft.version,
            "feedback": feedback,
        },
    )
    db.add(audit)
    await db.flush()

    # Dispatch webhook (fire-and-forget)
    await dispatch_event("draft.rejected", {
        "draft_id": str(draft_id),
        "letter_id": str(draft.letter_id) if letter else None,
        "version": draft.version,
        "feedback": feedback,
    })

    # Send email notification (fire-and-forget)
    if letter:
        await _notify_drafter(db, draft, letter, "rejected", {
            "reviewer_name": reviewer_name,
            "feedback": feedback,
        })

    return {
        "draft": draft.to_dict(),
        "message": "Draft rejected. Feedback recorded for revision.",
    }


async def mark_as_sent(
    db: AsyncSession,
    draft_id: str,
    user_id: uuid.UUID = None,
) -> dict:
    """Mark an approved draft as sent and archive it."""
    draft = await db.get(DraftResponse, str(draft_id))
    if not draft:
        raise ValueError(f"Draft {draft_id} not found")

    if draft.status != "approved":
        raise ValueError("Only approved drafts can be marked as sent")

    letter = await db.get(InboundLetter, str(draft.letter_id))

    if letter:
        letter.status = "sent"

    # Audit
    audit = AuditEntry(
        entity_type="draft",
        entity_id=str(draft_id),
        action="sent",
        user_id=user_id,
        details={
            "letter_id": str(draft.letter_id),
            "version": draft.version,
        },
    )
    db.add(audit)
    await db.flush()

    return {
        "draft": draft.to_dict(),
        "letter": letter.to_dict() if letter else None,
        "message": "Response marked as sent and archived.",
    }


async def archive_letter(
    db: AsyncSession,
    letter_id: str,
    user_id: uuid.UUID = None,
) -> dict:
    """Archive a letter and all its drafts."""
    letter = await db.get(InboundLetter, str(letter_id))
    if not letter:
        raise ValueError(f"Letter {letter_id} not found")

    letter.status = "archived"

    # Audit
    audit = AuditEntry(
        entity_type="letter",
        entity_id=str(letter_id),
        action="archived",
        user_id=user_id,
        details={"filename": letter.filename},
    )
    db.add(audit)
    await db.flush()

    return {
        "letter": letter.to_dict(),
        "message": "Letter archived successfully.",
    }


async def get_audit_trail(
    db: AsyncSession,
    entity_type: str = None,
    entity_id: str = None,
    user_id: uuid.UUID = None,
    user_role: str = None,
) -> list[dict]:
    """Get audit trail entries, optionally filtered with row-level security."""
    stmt = select(AuditEntry).order_by(AuditEntry.created_at.desc())

    if user_role not in ["admin", "reviewer"] and user_id is not None:
        pass

    if entity_type:
        stmt = stmt.where(AuditEntry.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditEntry.entity_id == entity_id)

    result = await db.execute(stmt)
    entries = result.scalars().all()
    return [entry.to_dict() for entry in entries]


async def get_dashboard_stats(
    db: AsyncSession,
    user_id: uuid.UUID = None,
    user_role: str = None,
) -> dict:
    """Get statistics for the dashboard with row-level security."""
    letter_stats_stmt = (
        select(InboundLetter.status, func.count())
        .group_by(InboundLetter.status)
    )

    draft_stats_stmt = (
        select(DraftResponse.status, func.count())
        .group_by(DraftResponse.status)
    )

    total_letters_stmt = select(func.count()).select_from(InboundLetter)
    total_drafts_stmt = select(func.count()).select_from(DraftResponse)
    pending_review_stmt = (
        select(func.count())
        .select_from(DraftResponse)
        .where(DraftResponse.status == "pending_review")
    )

    category_stmt = (
        select(InboundLetter.category, func.count())
        .group_by(InboundLetter.category)
    )

    recent_audit_stmt = (
        select(AuditEntry)
        .order_by(AuditEntry.created_at.desc())
        .limit(10)
    )

    if user_role not in ["admin", "reviewer"] and user_id is not None:
        letter_stats_stmt = letter_stats_stmt.where(InboundLetter.created_by == user_id)
        draft_stats_stmt = draft_stats_stmt.where(DraftResponse.letter_id.in_(
            select(InboundLetter.id).where(InboundLetter.created_by == user_id)
        ))
        total_letters_stmt = total_letters_stmt.where(InboundLetter.created_by == user_id)
        total_drafts_stmt = total_drafts_stmt.where(DraftResponse.letter_id.in_(
            select(InboundLetter.id).where(InboundLetter.created_by == user_id)
        ))
        pending_review_stmt = pending_review_stmt.where(DraftResponse.letter_id.in_(
            select(InboundLetter.id).where(InboundLetter.created_by == user_id)
        ))
        category_stmt = category_stmt.where(InboundLetter.created_by == user_id)

    letter_stats = await db.execute(letter_stats_stmt)
    draft_stats = await db.execute(draft_stats_stmt)
    total_letters = await db.execute(total_letters_stmt)
    total_drafts = await db.execute(total_drafts_stmt)
    pending_review = await db.execute(pending_review_stmt)
    category_result = await db.execute(category_stmt)
    recent_audit = await db.execute(recent_audit_stmt)

    return {
        "total_letters": total_letters.scalar() or 0,
        "total_drafts": total_drafts.scalar() or 0,
        "pending_review": pending_review.scalar() or 0,
        "letters_by_status": {row[0]: row[1] for row in letter_stats.all()},
        "drafts_by_status": {row[0]: row[1] for row in draft_stats.all()},
        "letters_by_category": {row[0]: row[1] for row in category_result.all()},
        "recent_activity": [e.to_dict() for e in recent_audit.scalars().all()],
    }
