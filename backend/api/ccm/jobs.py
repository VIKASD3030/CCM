"""
Job queue API endpoints.
Allows clients to poll job status, cancel queued jobs, and receive real-time updates via WebSocket.
"""
import json
import uuid
from datetime import datetime, timezone

import structlog
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_role
from backend.database import get_db
from backend.models.user import User
from backend.models.job import Job
from backend.services.job_queue import cancel_job, get_job

logger = structlog.get_logger()

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


@router.get("/{job_id}")
async def get_job_status(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the status of a background job (polling fallback for clients without WebSocket support)."""
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job": job.to_dict()}


@router.delete("/{job_id}")
async def cancel_queued_job(
    job_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a queued job (only if status is still 'queued'). Admin only."""
    success = await cancel_job(db, job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Job cannot be cancelled (not found or not in 'queued' state)")
    await db.commit()
    return {"status": "cancelled", "job_id": str(job_id)}


@router.websocket("/ws/{job_id}")
async def websocket_job_updates(websocket: WebSocket, job_id: str):
    """WebSocket endpoint for real-time job status updates via PostgreSQL LISTEN/NOTIFY.
    
    Opens an asyncpg connection, LISTENs on 'job_updates' channel,
    filters notifications for the requested job_id, and forwards them to the client.
    """
    await websocket.accept()

    try:
        from backend.config import get_settings
        settings = get_settings()
        db_url = str(settings.database.url).replace("+asyncpg", "")

        conn = await asyncpg.connect(db_url)
        try:
            await conn.execute("LISTEN job_updates")

            async def handle_notification(connection, pid, channel, payload):
                data = json.loads(payload)
                if data.get("job_id") == job_id:
                    await websocket.send_json(data)
                    if data.get("status") in ("completed", "failed", "cancelled"):
                        await websocket.close()

            await conn.add_listener("job_updates", handle_notification)

            # Keep connection alive
            try:
                while True:
                    await websocket.receive_text()
            except WebSocketDisconnect:
                pass
        finally:
            await conn.close()
    except Exception as e:
        logger.error("websocket.error", job_id=job_id, error=str(e))
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
