"""
Service layer for Drafting Sessions.
Handles CRUD for sessions, messages, and prompt template retrieval.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.drafting_session import DraftingSession
from backend.models.drafting_message import DraftingMessage
from backend.models.prompt_template import PromptTemplate
from backend.models.draft import DraftResponse


# ─── Sessions ──────────────────────────────────────────────────────────────────

async def create_session(
    db: AsyncSession,
    *,
    letter_id: Optional[str],
    project_id: Optional[str],
    title: str,
    created_by: uuid.UUID,
) -> DraftingSession:
    """Create a new drafting session thread."""
    session = DraftingSession(
        id=uuid.uuid4(),
        title=title,
        letter_id=uuid.UUID(letter_id) if letter_id else None,
        project_id=uuid.UUID(project_id) if project_id else None,
        created_by=created_by,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def list_sessions(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[dict]:
    """
    Return all sessions for this user, ordered pinned-first then by updated_at desc.
    Each item includes a preview of the last message.
    """
    stmt = (
        select(DraftingSession)
        .where(DraftingSession.created_by == user_id)
        .options(selectinload(DraftingSession.messages))
        .order_by(DraftingSession.is_pinned.desc(), DraftingSession.updated_at.desc())
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    items = []
    for s in sessions:
        last_msg = s.messages[-1] if s.messages else None
        preview = (last_msg.content[:80] + "…") if last_msg and len(last_msg.content) > 80 else (last_msg.content if last_msg else "")
        updated = s.updated_at
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)

        if updated >= today_start:
            group = "Today"
        elif updated >= week_start:
            group = "Previous 7 days"
        else:
            group = "Older"

        items.append({
            **s.to_dict(),
            "preview": preview,
            "group": group,
            "message_count": len(s.messages),
        })
    return items


async def get_session(
    db: AsyncSession,
    session_id: str,
    user_id: uuid.UUID,
) -> Optional[dict]:
    """
    Return full session with messages.
    For each assistant message, attach context_documents from the linked
    draft_responses row (stored at generation time — no re-retrieval).
    """
    stmt = (
        select(DraftingSession)
        .where(
            DraftingSession.id == uuid.UUID(session_id),
            DraftingSession.created_by == user_id,
        )
        .options(selectinload(DraftingSession.messages))
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if not session:
        return None

    session_dict = session.to_dict(include_messages=False)

    # Build messages list, enriching AI messages with stored context_documents
    messages_out = []
    for msg in session.messages:
        msg_dict = msg.to_dict()
        if msg.role == "assistant" and msg.draft_response_id:
            draft_stmt = select(DraftResponse).where(
                DraftResponse.id == msg.draft_response_id
            )
            draft_res = await db.execute(draft_stmt)
            draft = draft_res.scalar_one_or_none()
            if draft:
                msg_dict["context_documents"] = draft.context_documents or []
                msg_dict["draft_status"] = draft.status
                msg_dict["draft_version"] = draft.version
        messages_out.append(msg_dict)

    session_dict["messages"] = messages_out
    return session_dict


async def add_message(
    db: AsyncSession,
    session_id: str,
    role: str,
    content: str,
    draft_response_id: Optional[str] = None,
) -> DraftingMessage:
    """Append a message to a session and bump session.updated_at."""
    msg = DraftingMessage(
        id=uuid.uuid4(),
        session_id=uuid.UUID(session_id),
        role=role,
        content=content,
        draft_response_id=uuid.UUID(draft_response_id) if draft_response_id else None,
    )
    db.add(msg)

    # Bump session updated_at
    session_stmt = select(DraftingSession).where(DraftingSession.id == uuid.UUID(session_id))
    session_res = await db.execute(session_stmt)
    session = session_res.scalar_one_or_none()
    if session:
        session.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(msg)
    return msg


async def toggle_pin(
    db: AsyncSession,
    session_id: str,
    user_id: uuid.UUID,
) -> Optional[DraftingSession]:
    """Toggle the is_pinned flag on a session."""
    stmt = select(DraftingSession).where(
        DraftingSession.id == uuid.UUID(session_id),
        DraftingSession.created_by == user_id,
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if not session:
        return None
    session.is_pinned = not session.is_pinned
    await db.commit()
    await db.refresh(session)
    return session


async def update_session_title(
    db: AsyncSession,
    session_id: str,
    user_id: uuid.UUID,
    title: str,
) -> Optional[DraftingSession]:
    """Rename a session."""
    stmt = select(DraftingSession).where(
        DraftingSession.id == uuid.UUID(session_id),
        DraftingSession.created_by == user_id,
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if not session:
        return None
    session.title = title
    await db.commit()
    await db.refresh(session)
    return session


async def delete_session(
    db: AsyncSession,
    session_id: str,
    user_id: uuid.UUID,
) -> bool:
    """Delete a session and all its messages (CASCADE handles messages)."""
    stmt = select(DraftingSession).where(
        DraftingSession.id == uuid.UUID(session_id),
        DraftingSession.created_by == user_id,
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if not session:
        return False
    await db.delete(session)
    await db.commit()
    return True


async def search_sessions(
    db: AsyncSession,
    query: str,
    user_id: uuid.UUID,
) -> list[dict]:
    """
    Search sessions by title OR message content (ILIKE).
    Returns sessions that match, with preview of the matching message.
    """
    q = f"%{query}%"

    # Sessions matching by title
    title_stmt = (
        select(DraftingSession)
        .where(
            DraftingSession.created_by == user_id,
            DraftingSession.title.ilike(q),
        )
        .options(selectinload(DraftingSession.messages))
    )

    # Sessions matching by message content
    content_stmt = (
        select(DraftingSession)
        .join(DraftingMessage, DraftingMessage.session_id == DraftingSession.id)
        .where(
            DraftingSession.created_by == user_id,
            DraftingMessage.content.ilike(q),
        )
        .options(selectinload(DraftingSession.messages))
        .distinct()
    )

    title_res = await db.execute(title_stmt)
    content_res = await db.execute(content_stmt)

    seen = set()
    sessions = []
    for s in list(title_res.scalars().all()) + list(content_res.scalars().all()):
        if s.id not in seen:
            seen.add(s.id)
            sessions.append(s)

    items = []
    for s in sessions:
        last_msg = s.messages[-1] if s.messages else None
        preview = (last_msg.content[:80] + "…") if last_msg and len(last_msg.content) > 80 else (last_msg.content if last_msg else "")
        items.append({
            **s.to_dict(),
            "preview": preview,
            "message_count": len(s.messages),
        })
    return items


# ─── Templates ─────────────────────────────────────────────────────────────────

async def list_templates(db: AsyncSession) -> list[dict]:
    """Return all active prompt templates ordered by display_order."""
    stmt = (
        select(PromptTemplate)
        .where(PromptTemplate.is_active == True)
        .order_by(PromptTemplate.display_order)
    )
    result = await db.execute(stmt)
    return [t.to_dict() for t in result.scalars().all()]


async def list_all_templates(db: AsyncSession, include_inactive: bool = False) -> list[dict]:
    """Return all prompt templates (admin view). Optionally include inactive ones."""
    if include_inactive:
        stmt = select(PromptTemplate).order_by(PromptTemplate.display_order)
    else:
        stmt = (
            select(PromptTemplate)
            .where(PromptTemplate.is_active == True)
            .order_by(PromptTemplate.display_order)
        )
    result = await db.execute(stmt)
    return [t.to_dict() for t in result.scalars().all()]


async def get_template_by_id(db: AsyncSession, template_id: str) -> Optional[PromptTemplate]:
    """Get a single prompt template by ID."""
    stmt = select(PromptTemplate).where(PromptTemplate.id == uuid.UUID(template_id))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_template(
    db: AsyncSession,
    label: str,
    prompt_text: str,
    icon: str = "ti-sparkles",
    display_order: int = 0,
) -> PromptTemplate:
    """Create a new prompt template."""
    template = PromptTemplate(
        id=uuid.uuid4(),
        label=label,
        icon=icon,
        prompt_text=prompt_text,
        display_order=display_order,
        is_active=True,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def update_template(
    db: AsyncSession,
    template_id: str,
    label: str = None,
    prompt_text: str = None,
    icon: str = None,
    display_order: int = None,
    is_active: bool = None,
) -> Optional[PromptTemplate]:
    """Update an existing prompt template."""
    template = await get_template_by_id(db, template_id)
    if not template:
        return None

    if label is not None:
        template.label = label
    if prompt_text is not None:
        template.prompt_text = prompt_text
    if icon is not None:
        template.icon = icon
    if display_order is not None:
        template.display_order = display_order
    if is_active is not None:
        template.is_active = is_active

    await db.commit()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, template_id: str) -> bool:
    """Delete a prompt template (soft delete via is_active flag)."""
    template = await get_template_by_id(db, template_id)
    if not template:
        return False
    
    template.is_active = False
    await db.commit()
    return True


async def reorder_templates(db: AsyncSession, reordered_ids: list[str]) -> bool:
    """Reorder templates based on provided list of IDs."""
    for order, template_id in enumerate(reordered_ids):
        template = await get_template_by_id(db, template_id)
        if template:
            template.display_order = order
    
    await db.commit()
    return True
