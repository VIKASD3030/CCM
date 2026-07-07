"""
API endpoints for Drafting Sessions (ChatGPT-style conversation threads).

Routes:
  GET    /api/drafting-sessions/templates     — list prompt chips (no session needed)
  GET    /api/drafting-sessions               — list sessions for current user
  POST   /api/drafting-sessions               — create new session
  GET    /api/drafting-sessions/search        — search sessions by q
  GET    /api/drafting-sessions/{id}          — get session + full thread
  PATCH  /api/drafting-sessions/{id}/pin      — toggle pin
  PATCH  /api/drafting-sessions/{id}/title    — rename session
  DELETE /api/drafting-sessions/{id}          — delete session
  POST   /api/drafting-sessions/{id}/messages — append a message to thread
"""
import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, Query

from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.database import get_db
from backend.models.user import User
from backend.services import drafting_sessions as svc

router = APIRouter(prefix="/api/drafting-sessions", tags=["Drafting Sessions"])


# ── Templates ──────────────────────────────────────────────────────────────────

@router.get("/templates")
async def get_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all active prompt templates ordered by display_order."""
    templates = await svc.list_templates(db)
    return {"templates": templates}


# ── Sessions ───────────────────────────────────────────────────────────────────

@router.get("/search")
async def search_sessions(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search sessions by title or message content."""
    results = await svc.search_sessions(db, query=q, user_id=current_user.id)
    return {"sessions": results}


@router.get("")
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all drafting sessions for the current user."""
    sessions = await svc.list_sessions(db, user_id=current_user.id)
    return {"sessions": sessions}


@router.post("", status_code=201)
async def create_session(
    letter_id: str = Form(""),
    project_id: str = Form(""),
    title: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new drafting session. Title is auto-generated if not provided."""
    session_title = title.strip() or "New Draft"
    session = await svc.create_session(
        db,
        letter_id=letter_id or None,
        project_id=project_id or None,
        title=session_title,
        created_by=current_user.id,
    )
    return {"session": session.to_dict()}


@router.get("/{session_id}")
async def get_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return full session with all messages and stored context_documents."""
    data = await svc.get_session(db, session_id=str(session_id), user_id=current_user.id)
    if not data:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session": data}


@router.patch("/{session_id}/pin")
async def toggle_pin(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle the pinned status of a session."""
    session = await svc.toggle_pin(db, session_id=str(session_id), user_id=current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session": session.to_dict()}


@router.patch("/{session_id}/title")
async def rename_session(
    session_id: uuid.UUID,
    title: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rename a drafting session."""
    session = await svc.update_session_title(
        db, session_id=str(session_id), user_id=current_user.id, title=title
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session": session.to_dict()}


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a drafting session and all its messages."""
    deleted = await svc.delete_session(db, session_id=str(session_id), user_id=current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")


@router.post("/{session_id}/messages", status_code=201)
async def add_message(
    session_id: uuid.UUID,
    role: str = Form(...),
    content: str = Form(...),
    draft_response_id: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Append a user or assistant message to a session thread."""
    if role not in ("user", "assistant"):
        raise HTTPException(status_code=422, detail="role must be 'user' or 'assistant'")

    # Verify session ownership
    session_data = await svc.get_session(db, session_id=str(session_id), user_id=current_user.id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")

    msg = await svc.add_message(
        db,
        session_id=str(session_id),
        role=role,
        content=content,
        draft_response_id=draft_response_id or None,
    )
    return {"message": msg.to_dict()}
