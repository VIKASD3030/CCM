"""
Email notification settings API endpoints.
Users can manage their own notification preferences.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.database import get_db
from backend.models.user import User
from backend.models.email_notification import EmailNotificationSetting

router = APIRouter(prefix="/api/users/me/notification-settings", tags=["Notifications"])


@router.get("")
async def get_notification_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's email notification settings."""
    stmt = select(EmailNotificationSetting).where(EmailNotificationSetting.user_id == current_user.id)
    result = await db.execute(stmt)
    settings = result.scalar_one_or_none()

    if not settings:
        settings = EmailNotificationSetting(user_id=current_user.id)
        db.add(settings)
        await db.flush()
        await db.commit()

    return {"notification_settings": settings.to_dict()}


@router.patch("")
async def update_notification_settings(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's email notification settings."""
    body = await request.json()

    stmt = select(EmailNotificationSetting).where(EmailNotificationSetting.user_id == current_user.id)
    result = await db.execute(stmt)
    settings = result.scalar_one_or_none()

    if not settings:
        settings = EmailNotificationSetting(user_id=current_user.id)
        db.add(settings)

    if "on_review_needed" in body:
        settings.on_review_needed = bool(body["on_review_needed"])
    if "on_draft_approved" in body:
        settings.on_draft_approved = bool(body["on_draft_approved"])
    if "on_draft_rejected" in body:
        settings.on_draft_rejected = bool(body["on_draft_rejected"])
    if "on_letter_assigned" in body:
        settings.on_letter_assigned = bool(body["on_letter_assigned"])

    await db.flush()
    await db.commit()

    return {"notification_settings": settings.to_dict()}
