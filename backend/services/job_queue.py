"""
Job queue service for managing background jobs with ARQ and pg_notify.
"""
import json
import uuid
import os
from datetime import datetime, timezone
from typing import Optional

import asyncpg
import structlog
from arq import ArqRedis
from arq.connections import RedisSettings
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models.job import Job

logger = structlog.get_logger()
settings = get_settings()


def _get_notify_dsn() -> str:
    """Get the PostgreSQL DSN for LISTEN/NOTIFY connections.
    
    If behind PgBouncer, this should connect directly to PostgreSQL
    (PgBouncer doesn't support LISTEN/NOTIFY in transaction mode).
    Falls back to the main database URL without asyncpg driver prefix.
    """
    direct_url = os.getenv("DATABASE_DIRECT_URL", "")
    if direct_url:
        return direct_url
    return str(settings.database.url).replace("+asyncpg", "")


async def get_arq_redis() -> Optional[ArqRedis]:
    """Get ARQ Redis connection pool, or None if Redis is disabled/unreachable.

    Redis is optional for the initial stage. When it's not configured (or not
    reachable), callers fall back to running jobs synchronously in-process —
    see `enqueue_job` / `run_job` below.
    """
    if not settings.redis.url:
        return None

    from arq.connections import create_pool
    import asyncio
    try:
        settings_redis = RedisSettings.from_dsn(str(settings.redis.url))
        pool = await asyncio.wait_for(create_pool(settings_redis), timeout=3.0)
        return pool
    except Exception as e:
        logger.warning("redis.unavailable", error=str(e))
        return None


async def _run_job_inline(job_type: str, job_id: str, payload: dict):
    """Execute a job's task function directly, without a Redis-backed queue.

    Used when Redis is not configured. Task functions in worker.py already
    update job status and pg_notify on their own, so this just invokes them.
    """
    from backend import worker
    task_fn = getattr(worker, job_type, None)
    if task_fn is None:
        logger.error("job.inline_run_failed", job_id=job_id, job_type=job_type, error="unknown job_type")
        return
    ctx = {"job_id": job_id}
    try:
        await task_fn(ctx, **payload)
    except Exception as e:
        logger.error("job.inline_run_failed", job_id=job_id, job_type=job_type, error=str(e))


async def run_job(arq_redis: Optional[ArqRedis], job_type: str, **kwargs):
    """Enqueue a fire-and-forget job via ARQ, or run it inline if Redis is unavailable.

    Use for jobs that aren't tracked in the `jobs` table (e.g. webhook delivery).
    """
    if arq_redis is not None:
        await arq_redis.enqueue_job(job_type, **kwargs)
    else:
        await _run_job_inline(job_type, kwargs.get("job_id", ""), kwargs)


async def create_job(
    db: AsyncSession,
    job_type: str,
    payload: dict,
    created_by: uuid.UUID,
    priority: int = 0,
    max_attempts: int = 3,
) -> Job:
    """Create a new job record in the database."""
    job = Job(
        job_type=job_type,
        status="queued",
        payload=payload,
        created_by=created_by,
        max_attempts=max_attempts,
        priority=priority,
    )
    db.add(job)
    await db.flush()
    return job


async def enqueue_job(
    db: AsyncSession,
    arq_redis: ArqRedis,
    job_type: str,
    payload: dict,
    created_by: uuid.UUID,
    priority: int = 0,
    max_attempts: int = 3,
) -> Job:
    """Create a job record and enqueue it in ARQ."""
    job = await create_job(db, job_type, payload, created_by, priority, max_attempts)
    await db.commit()

    if arq_redis is not None:
        # Enqueue in ARQ
        await arq_redis.enqueue_job(job_type, job_id=str(job.id), **payload)
        logger.info("job.enqueued", job_id=str(job.id), job_type=job_type)
    else:
        # No Redis configured — run the job synchronously in-process.
        logger.info("job.running_inline", job_id=str(job.id), job_type=job_type)
        await _run_job_inline(job_type, str(job.id), payload)

    return job


async def update_job_status(
    db: AsyncSession,
    job_id: uuid.UUID,
    status: str,
    result: dict = None,
    error_message: str = None,
    worker_id: str = None,
) -> Optional[Job]:
    """Update job status and notify via pg_notify."""
    stmt = select(Job).where(Job.id == job_id)
    result_obj = await db.execute(stmt)
    job = result_obj.scalar_one_or_none()

    if not job:
        logger.warning("job.not_found", job_id=str(job_id))
        return None

    job.status = status
    if status == "running" and not job.started_at:
        job.started_at = datetime.now(timezone.utc)
    if status in ("completed", "failed", "cancelled"):
        job.completed_at = datetime.now(timezone.utc)
    if result is not None:
        job.result = result
    if error_message is not None:
        job.error_message = error_message
    if worker_id is not None:
        job.worker_id = worker_id
    job.attempts += 1

    await db.flush()

    # Notify via pg_notify using raw asyncpg connection
    await pg_notify_job_update(str(job.id), status)

    logger.info("job.status_updated", job_id=str(job.id), status=status)
    return job


async def pg_notify_job_update(job_id: str, status: str):
    """Send job update notification via PostgreSQL LISTEN/NOTIFY.
    
    Uses a direct asyncpg connection bypassing PgBouncer.
    """
    dsn = _get_notify_dsn()
    try:
        conn = await asyncpg.connect(dsn)
        try:
            payload = json.dumps({"job_id": job_id, "status": status})
            await conn.execute("SELECT pg_notify('job_updates', $1)", payload)
        finally:
            await conn.close()
    except Exception as e:
        logger.error("pg_notify.failed", job_id=job_id, error=str(e))


async def cancel_job(db: AsyncSession, job_id: uuid.UUID) -> bool:
    """Cancel a queued job (only if status is 'queued')."""
    stmt = select(Job).where(Job.id == job_id)
    result_obj = await db.execute(stmt)
    job = result_obj.scalar_one_or_none()

    if not job:
        return False

    if job.status != "queued":
        return False

    job.status = "cancelled"
    job.completed_at = datetime.now(timezone.utc)
    await db.flush()

    await pg_notify_job_update(str(job.id), "cancelled")

    logger.info("job.cancelled", job_id=str(job_id))
    return True


async def get_job(db: AsyncSession, job_id: uuid.UUID) -> Optional[Job]:
    """Get a job by ID."""
    stmt = select(Job).where(Job.id == job_id)
    result_obj = await db.execute(stmt)
    return result_obj.scalar_one_or_none()
