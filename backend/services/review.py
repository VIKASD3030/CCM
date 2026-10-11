"""
Phase 4 — Review, Approve & Archive Service.
Handles the human-in-the-loop workflow: approve, reject, archive, audit trail.
Dispatches webhooks and email notifications on status changes.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

import structlog

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models.letter import InboundLetter
from backend.models.draft import DraftResponse
from backend.models.audit import AuditEntry
from backend.models.user import User
from backend.models.email_notification import EmailNotificationSetting
from backend.services.knowledge_base import DuplicateDocumentError, ingest_document
from backend.services.webhook_service import dispatch_event
from backend.services.job_queue import get_arq_redis, run_job

logger = structlog.get_logger()
settings = get_settings()

# A letter is "open" until its reply is approved, sent or the letter archived.
CLOSED_LETTER_STATUSES = ("approved", "sent", "archived")
# Replies older than this are counted as overdue on the dashboard.
REPLY_SLA_DAYS = 7


async def get_review_queue(
    db: AsyncSession,
    status: str = "pending_review",
    user_id: uuid.UUID = None,
    user_role: str = None,
    limit: int = 100,
) -> list[dict]:
    """Drafts in a review state, newest first, with their letter and project."""
    from backend.models.project import Project

    stmt = (
        select(DraftResponse, InboundLetter, Project.name)
        .join(InboundLetter, DraftResponse.letter_id == InboundLetter.id)
        .outerjoin(Project, Project.id == InboundLetter.project_id)
        .where(DraftResponse.status == status)
        .order_by(DraftResponse.created_at.desc())
        .limit(limit)
    )
    if user_role != "admin" and user_id is not None:
        stmt = stmt.where(InboundLetter.created_by == user_id)

    items = []
    for draft, letter, project_name in (await db.execute(stmt)).all():
        verification = (draft.letter_data or {}).get("verification")
        items.append({
            "draft": draft.to_dict(),
            "letter": {
                "id": str(letter.id),
                "filename": letter.filename,
                # Head of the letter: enough for its reference and subject lines.
                "raw_text": (letter.raw_text or "")[:3000],
                "key_entities": letter.key_entities,
                "category": letter.category,
                "urgency": letter.urgency,
                "intent": letter.intent,
                "received_at": letter.received_at.isoformat() if letter.received_at else None,
                "project_id": str(letter.project_id) if letter.project_id else None,
            },
            "project_name": project_name,
            # None = drafted before verification existed (not checked).
            "issues": verification.get("issues", 0) if verification else None,
        })
    return items


async def _notify_admins(db: AsyncSession, draft: DraftResponse, letter: InboundLetter):
    """Send review_needed notification to all admins who opted in."""
    try:
        stmt = (
            select(User)
            .join(EmailNotificationSetting, User.id == EmailNotificationSetting.user_id)
            .where(
                User.role == "admin",
                User.is_active == True,
                EmailNotificationSetting.on_review_needed == True,
            )
        )
        result = await db.execute(stmt)
        admins = result.scalars().all()

        if not admins:
            return

        arq_redis = await get_arq_redis()
        for admin in admins:
            await run_job(
                arq_redis,
                "send_email_task",
                template_name="review_needed.html",
                recipients=[admin.email],
                subject=f"Review Needed: {letter.filename}",
                template_data={
                    "letter_subject": letter.filename,
                    "sender_name": letter.created_by or "Unknown",
                    "draft_excerpt": draft.draft_text[:200] + "...",
                    "review_url": f"{settings.app_base_url}/review/{draft.id}",
                },
            )
    except Exception as e:
        logger.warning("review.notify_admins_failed", error=str(e))


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
                "reviewer_name": extra_data.get("reviewer_name", "Admin") if extra_data else "Admin",
                "approved_at": extra_data.get("approved_at", "") if extra_data else "",
                "view_url": f"{settings.app_base_url}/drafts/{draft.id}",
            })

        elif notification_type == "rejected" and notify_settings.on_draft_rejected:
            should_send = True
            template_name = "draft_rejected.html"
            subject = f"Draft Needs Revision: {letter.filename}"
            template_data.update({
                "reviewer_name": extra_data.get("reviewer_name", "Admin") if extra_data else "Admin",
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

    draft.status = "approved"
    draft.reviewer_notes = reviewer_notes
    letter.status = "approved"

    reviewer_name = "Admin"
    if user_id:
        reviewer = await db.get(User, user_id)
        if reviewer:
            reviewer_name = reviewer.email

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

    # File the exchange into the project's folders so later drafts can cite it:
    # our approved reply -> Outgoing letters, the client's letter -> Incoming.
    # Each ingest runs in a savepoint so a failure can't undo the approval.
    project_id = str(letter.project_id) if letter.project_id else None
    stem = letter.filename.rsplit(".", 1)[0]
    ref_no = (draft.letter_data or {}).get("reference_number") or f"v{draft.version}"
    # Explicit metadata, so the thread links up: the reply quotes the client's
    # reference (that is what marks the letter "answered"), the incoming letter
    # keeps the reference, date and subject read at intake.
    reply_meta = {
        "ref_no": ref_no,
        "doc_date": date.today(),
        "subject": (draft.letter_data or {}).get("subject"),
        "referenced_refs": [letter.ref_no, *(letter.referenced_refs or [])[:5]] if letter.ref_no else list(letter.referenced_refs or [])[:5],
    }
    letter_meta = {
        "ref_no": letter.ref_no,
        "doc_date": letter.letter_date,
        "subject": letter.subject,
        "referenced_refs": list(letter.referenced_refs or []),
    }
    for filename, content, document_type, meta in (
        (f"{ref_no} - reply to {stem}.txt", draft.draft_text, "outgoing_letter", reply_meta),
        (f"{stem}.txt", letter.raw_text, "incoming_letter", letter_meta),
    ):
        try:
            async with db.begin_nested():
                await ingest_document(
                    db,
                    filename=filename,
                    content=(content or "").encode("utf-8"),
                    file_type="txt",
                    category=document_type if project_id else "response",
                    user_id=user_id,
                    project_id=project_id,
                    document_type=document_type if project_id else None,
                    metadata=meta,
                )
            logger.info("review.approved_exchange_filed", letter_id=str(draft.letter_id), document_type=document_type)
        except DuplicateDocumentError:
            logger.info("review.approved_exchange_already_filed", document_type=document_type)
        except Exception as e:
            logger.warning("review.feed_kb_failed", document_type=document_type, error=str(e))

    await db.flush()

    await dispatch_event("draft.approved", {
        "draft_id": str(draft_id),
        "letter_id": str(draft.letter_id),
        "version": draft.version,
        "reviewer_notes": reviewer_notes,
    })

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

    reviewer_name = "Admin"
    if user_id:
        reviewer = await db.get(User, user_id)
        if reviewer:
            reviewer_name = reviewer.email

    if letter:
        letter.status = "classified"

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

    await dispatch_event("draft.rejected", {
        "draft_id": str(draft_id),
        "letter_id": str(draft.letter_id) if letter else None,
        "version": draft.version,
        "feedback": feedback,
    })

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

    if user_role != "admin" and user_id is not None:
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

    # Open-letter figures and turnaround for the dashboard KPI cards.
    open_stmt = select(InboundLetter.urgency, InboundLetter.received_at).where(
        InboundLetter.status.notin_(CLOSED_LETTER_STATUSES)
    )
    turnaround_stmt = (
        select(InboundLetter.received_at, func.max(DraftResponse.updated_at))
        .join(DraftResponse, DraftResponse.letter_id == InboundLetter.id)
        .where(DraftResponse.status.in_(("approved", "sent")))
        .group_by(InboundLetter.id, InboundLetter.received_at)
    )
    if user_role != "admin" and user_id is not None:
        open_stmt = open_stmt.where(InboundLetter.created_by == user_id)
        turnaround_stmt = turnaround_stmt.where(InboundLetter.created_by == user_id)

    now = datetime.now(timezone.utc)
    open_rows = (await db.execute(open_stmt)).all()
    overdue_cutoff = now - timedelta(days=REPLY_SLA_DAYS)
    turnaround_days = [
        (approved_at - received_at).total_seconds() / 86400
        for received_at, approved_at in (await db.execute(turnaround_stmt)).all()
        if received_at and approved_at and approved_at >= received_at
    ]

    return {
        "open_letters": len(open_rows),
        "open_high_urgency": sum(1 for urgency, _ in open_rows if (urgency or "").lower() in ("high", "critical")),
        "overdue_letters": sum(1 for _, received_at in open_rows if received_at and received_at < overdue_cutoff),
        "reply_sla_days": REPLY_SLA_DAYS,
        "avg_turnaround_days": round(sum(turnaround_days) / len(turnaround_days), 1) if turnaround_days else None,
        "total_letters": total_letters.scalar() or 0,
        "total_drafts": total_drafts.scalar() or 0,
        "pending_review": pending_review.scalar() or 0,
        "letters_by_status": {row[0]: row[1] for row in letter_stats.all()},
        "drafts_by_status": {row[0]: row[1] for row in draft_stats.all()},
        "letters_by_category": {row[0]: row[1] for row in category_result.all()},
        "recent_activity": [e.to_dict() for e in recent_audit.scalars().all()],
    }
