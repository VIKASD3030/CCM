"""Auto Notification master backed by a dedicated table."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import upsert_model, soft_delete_model
from backend.models.user import User
from backend.models.auto_notification import AutoNotification

router = APIRouter(prefix="/common", tags=["master-auto-notification"])

AUTO_NOTIFICATION_MAP = {
    "NotificationName": "notification_name",
    "NotificaionName": "notification_name",
    "NotificationType": "notification_type",
    "ActivityType": "activity_type",
    "Days": "days",
    "Remarks": "remarks",
    "Status": "status",
    "CreatedBy": "created_by",
    "CreatedDate": "created_date",
    "LockedBy": "locked_by",
    "LockedDate": "locked_date",
    "SecurityId": "security_id",
}


async def _refresh_auto_notifications(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(AutoNotification).where(AutoNotification.status != "9").order_by(AutoNotification.id))
    return [row.to_dict() for row in result.scalars().all()]


@router.get("/GetAutoNotification")
async def get_auto_notification(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await _refresh_auto_notifications(db)


@router.post("/saveAutoNotificationDetails")
async def save_auto_notification(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await upsert_model(db, AutoNotification, body, "AutoNotificationId", AUTO_NOTIFICATION_MAP)
    return await _refresh_auto_notifications(db)


@router.post("/deleteAutoNotificationDetails")
async def delete_auto_notification(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await soft_delete_model(db, AutoNotification, body.get("AutoNotificationId"))
    return await _refresh_auto_notifications(db)
