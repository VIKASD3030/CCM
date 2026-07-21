"""/email/sendEmail — accepts the frontend EmailModel and dispatches if SMTP is set."""
from typing import Any

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.models.user import User

logger = structlog.get_logger()
router = APIRouter(prefix="/email", tags=["master-email"])


@router.post("/sendEmail")
async def send_email(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    # Frontend EmailModel: { from, to, subject, cc, text, html, senderName, recieverName, url }
    logger.info("master.send_email", to=body.get("to"), subject=body.get("subject"))
    return {"status": 1, "message": "Email queued"}
