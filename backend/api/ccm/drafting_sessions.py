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

Admin prompt management:
  GET    /api/prompts                         — list all templates (admin only)
  POST   /api/prompts                         — create new template (admin only)
  GET    /api/prompts/{id}                    — get single template (admin only)
  PUT    /api/prompts/{id}                    — update template (admin only)
  DELETE /api/prompts/{id}                    — delete template (admin only)
  POST   /api/prompts/reorder                 — reorder templates (admin only)
"""
import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, Query

from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_role
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


# ── Admin: Prompt Template Management ───────────────────────────────────────────

# Create a separate router for admin prompts endpoints
prompts_router = APIRouter(prefix="/api/prompts", tags=["Prompts (Admin)"])


@prompts_router.get("", dependencies=[Depends(require_role("admin"))])
async def list_all_templates(
    include_inactive: bool = Query(False),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all prompt templates (admin only). Include inactive if requested."""
    templates = await svc.list_all_templates(db, include_inactive=include_inactive)
    return {"templates": templates}


@prompts_router.post("", status_code=201, dependencies=[Depends(require_role("admin"))])
async def create_template(
    label: str = Form(...),
    prompt_text: str = Form(...),
    icon: str = Form("ti-sparkles"),
    display_order: int = Form(0),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new prompt template (admin only)."""
    template = await svc.create_template(
        db,
        label=label.strip(),
        prompt_text=prompt_text.strip(),
        icon=icon.strip(),
        display_order=display_order,
    )
    return {"template": template.to_dict()}


@prompts_router.get("/{template_id}", dependencies=[Depends(require_role("admin"))])
async def get_template(
    template_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single prompt template (admin only)."""
    template = await svc.get_template_by_id(db, str(template_id))
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"template": template.to_dict()}


@prompts_router.put("/{template_id}", dependencies=[Depends(require_role("admin"))])
async def update_template(
    template_id: uuid.UUID,
    label: str = Form(None),
    prompt_text: str = Form(None),
    icon: str = Form(None),
    display_order: int = Form(None),
    is_active: bool = Form(None),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update a prompt template (admin only)."""
    template = await svc.update_template(
        db,
        str(template_id),
        label=label.strip() if label else None,
        prompt_text=prompt_text.strip() if prompt_text else None,
        icon=icon.strip() if icon else None,
        display_order=display_order,
        is_active=is_active,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"template": template.to_dict()}


@prompts_router.delete("/{template_id}", status_code=204, dependencies=[Depends(require_role("admin"))])
async def delete_template(
    template_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a prompt template (soft delete, admin only)."""
    deleted = await svc.delete_template(db, str(template_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")


@prompts_router.post("/reorder", dependencies=[Depends(require_role("admin"))])
async def reorder_templates(
    template_ids: list[str] = Form(...),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Reorder prompt templates (admin only)."""
    success = await svc.reorder_templates(db, template_ids)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to reorder templates")
    templates = await svc.list_all_templates(db, include_inactive=True)
    return {"templates": templates}
