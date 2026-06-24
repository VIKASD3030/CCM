"""
Webhook event dispatching service.
Dispatches events to configured webhooks, tracks delivery history,
and disables webhooks after 10 consecutive failures.
"""
import hashlib
import hmac
import json
import uuid
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models.webhook import Webhook, WebhookDelivery

logger = structlog.get_logger()
settings = get_settings()


async def dispatch_event(event: str, payload: dict):
    """Dispatch an event to all active webhooks that subscribe to it.
    
    This is fire-and-forget: it enqueues arq jobs and does not await them.
    Called from service functions after auditable actions.
    """
    logger.info("webhook.dispatch_event", event_name=event)

    async with async_session_factory() as session:
        stmt = select(Webhook).where(
            Webhook.is_active == True,
            Webhook.events.any(event),
        )
        result = await session.execute(stmt)
        webhooks = result.scalars().all()

    if not webhooks:
        logger.debug("webhook.no_subscribers", event_name=event)
        return

    for webhook in webhooks:
        try:
            arq_redis = await get_arq_redis()
            await arq_redis.enqueue_job(
                "deliver_webhook_task",
                webhook_id=str(webhook.id),
                event=event,
                payload=payload,
            )
        except Exception as e:
            logger.error("webhook.enqueue_failed", webhook_id=str(webhook.id), event_name=event, error=str(e))


async def deliver_webhook(
    session: AsyncSession,
    webhook_id: str,
    event: str,
    payload: dict,
) -> dict:
    """Deliver a webhook event to a single webhook URL.
    
    Called from the ARQ worker deliver_webhook_task.
    """
    stmt = select(Webhook).where(Webhook.id == webhook_id)
    result = await session.execute(stmt)
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise ValueError(f"Webhook {webhook_id} not found")

    delivery_id = str(uuid.uuid4())
    body = json.dumps(payload, default=str)
    signature = compute_hmac(webhook.secret, body)

    headers = {
        "Content-Type": "application/json",
        "X-CCM-Event": event,
        "X-CCM-Signature": signature,
        "X-CCM-Delivery": delivery_id,
        "User-Agent": "CCM-Webhook/1.0",
    }

    start_time = time.monotonic()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(webhook.url, content=body, headers=headers)

        duration_ms = int((time.monotonic() - start_time) * 1000)

        delivery = WebhookDelivery(
            id=uuid.UUID(delivery_id),
            webhook_id=uuid.UUID(webhook_id),
            event=event,
            payload=payload,
            response_status=response.status_code,
            response_body=response.text[:10000],
            duration_ms=duration_ms,
            success=response.is_success,
        )
        session.add(delivery)

        if response.is_success:
            webhook.failure_count = 0
            webhook.last_triggered_at = datetime.now(timezone.utc)
            logger.info("webhook.delivered", webhook_id=webhook_id, event_name=event, status=response.status_code)
        else:
            webhook.failure_count += 1
            await _check_disable_webhook(session, webhook)
            logger.warning("webhook.failed", webhook_id=webhook_id, event_name=event, status=response.status_code)

        await session.flush()
        await session.commit()

        return {"delivery_id": delivery_id, "success": response.is_success, "status_code": response.status_code}

    except Exception as e:
        duration_ms = int((time.monotonic() - start_time) * 1000)

        delivery = WebhookDelivery(
            id=uuid.UUID(delivery_id),
            webhook_id=uuid.UUID(webhook_id),
            event=event,
            payload=payload,
            response_status=None,
            response_body=str(e),
            duration_ms=duration_ms,
            success=False,
        )
        session.add(delivery)

        webhook.failure_count += 1
        await _check_disable_webhook(session, webhook)

        await session.flush()
        await session.commit()

        logger.error("webhook.delivery_failed", webhook_id=webhook_id, event_name=event, error=str(e))
        raise


async def _check_disable_webhook(session: AsyncSession, webhook: Webhook):
    """Disable webhook if failure count >= 10."""
    if webhook.failure_count >= 10:
        webhook.is_active = False
        logger.warning("webhook.disabled", webhook_id=str(webhook.id), failure_count=webhook.failure_count)


def compute_hmac(secret: str, body: str) -> str:
    """Compute HMAC-SHA256 signature."""
    h = hmac.new(secret.encode(), body.encode(), hashlib.sha256)
    return h.hexdigest()


async def send_test_webhook(session: AsyncSession, webhook_id: str) -> dict:
    """Send a test ping event to verify a webhook URL."""
    from backend.services.job_queue import get_arq_redis

    test_payload = {
        "event": "test.ping",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {"message": "This is a test webhook delivery from CCM"},
    }

    arq_redis = await get_arq_redis()
    await arq_redis.enqueue_job(
        "deliver_webhook_task",
        webhook_id=webhook_id,
        event="test.ping",
        payload=test_payload,
    )

    return {"status": "queued", "message": "Test webhook event queued for delivery"}


# Import at bottom to avoid circular imports
from backend.database import async_session_factory
from backend.services.job_queue import get_arq_redis
