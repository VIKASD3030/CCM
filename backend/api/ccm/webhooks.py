"""
Webhook management API endpoints.
CRUD for webhooks, delivery logs, and test pings.
Admin only.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_role
from backend.database import get_db
from backend.models.user import User
from backend.models.webhook import Webhook, WebhookDelivery

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


@router.post("")
async def create_webhook(
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new webhook. Admin only."""
    body = await request.json()
    url = body.get("url")
    secret = body.get("secret")
    events = body.get("events", [])

    if not url or not secret or not events:
        raise HTTPException(status_code=400, detail="url, secret, and events are required")

    webhook = Webhook(
        url=url,
        secret=secret,
        events=events,
        created_by=current_user.id,
    )
    db.add(webhook)
    await db.flush()
    await db.commit()

    return {"status": "success", "webhook": webhook.to_dict()}


@router.get("")
async def list_webhooks(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all webhooks. Admin only."""
    stmt = select(Webhook).order_by(Webhook.created_at.desc())
    result = await db.execute(stmt)
    webhooks = result.scalars().all()
    return {"webhooks": [w.to_dict() for w in webhooks]}


@router.get("/{webhook_id}")
async def get_webhook(
    webhook_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific webhook. Admin only."""
    webhook = await db.get(Webhook, webhook_id)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"webhook": webhook.to_dict()}


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a webhook. Admin only."""
    webhook = await db.get(Webhook, webhook_id)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.delete(webhook)
    await db.commit()
    return {"status": "deleted"}


@router.get("/{webhook_id}/deliveries")
async def list_webhook_deliveries(
    webhook_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List deliveries for a webhook. Paginated. Admin only."""
    webhook = await db.get(Webhook, webhook_id)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    offset = (page - 1) * per_page
    stmt = (
        select(WebhookDelivery)
        .where(WebhookDelivery.webhook_id == webhook_id)
        .order_by(WebhookDelivery.delivered_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(stmt)
    deliveries = result.scalars().all()

    count_stmt = select(func.count()).select_from(WebhookDelivery).where(WebhookDelivery.webhook_id == webhook_id)
    count_result = await db.execute(count_stmt)
    total = count_result.scalar() or 0

    return {
        "deliveries": [d.to_dict() for d in deliveries],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Send a test ping event to verify the webhook URL. Admin only."""
    webhook = await db.get(Webhook, webhook_id)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    from backend.services.webhook_service import send_test_webhook
    result = await send_test_webhook(db, str(webhook_id))
    return result
