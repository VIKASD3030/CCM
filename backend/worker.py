"""
ARQ worker for background job processing.
Implements tasks for letter classification, draft generation, and KB document indexing.
Each task updates the jobs table and sends pg_notify on completion/failure.
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

import structlog
from arq.connections import RedisSettings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import async_session_factory
from backend.models.job import Job
from backend.models.letter import InboundLetter
from backend.models.document import KnowledgeDocument, DocumentChunk
from backend.services.job_queue import pg_notify_job_update

logger = structlog.get_logger()
settings = get_settings()


async def _update_job_status(
    session: AsyncSession,
    job_id: str,
    status: str,
    result: dict = None,
    error_message: str = None,
):
    """Helper to update job status and send pg_notify."""
    stmt = select(Job).where(Job.id == job_id)
    result_obj = await session.execute(stmt)
    job = result_obj.scalar_one_or_none()
    if not job:
        logger.warning("job.not_found", job_id=job_id)
        return

    job.status = status
    if status == "running" and not job.started_at:
        job.started_at = datetime.now(timezone.utc)
    if status in ("completed", "failed"):
        job.completed_at = datetime.now(timezone.utc)
    if result is not None:
        job.result = result
    if error_message is not None:
        job.error_message = error_message
    job.attempts += 1

    await session.flush()
    await session.commit()
    await pg_notify_job_update(job_id, status)


async def classify_letter_task(ctx: Dict[str, Any], letter_id: str) -> Dict[str, Any]:
    """
    Classify a letter using AI in the background.
    Fetches the letter from DB, classifies its text, and updates the record.
    """
    job_id = ctx.get("job_id", "")
    logger.info("classify_letter_task.start", letter_id=letter_id, job_id=job_id)

    async with async_session_factory() as session:
        try:
            await _update_job_status(session, job_id, "running")

            # Fetch the letter
            stmt = select(InboundLetter).where(InboundLetter.id == letter_id)
            result = await session.execute(stmt)
            letter = result.scalar_one_or_none()

            if not letter:
                raise ValueError(f"Letter {letter_id} not found")

            # Classify the letter text
            from backend.services.letter_intake import classify_letter
            classification = await classify_letter(letter.raw_text)

            # Update letter with classification results
            letter.category = classification.get("category")
            letter.urgency = classification.get("urgency")
            letter.intent = classification.get("intent")
            letter.confidence_score = classification.get("confidence_score")
            letter.key_entities = classification.get("key_entities")
            letter.status = "classified"
            await session.flush()

            await _update_job_status(
                session, job_id, "completed",
                result={"classification": classification, "letter_id": letter_id}
            )
            logger.info("classify_letter_task.success", letter_id=letter_id, job_id=job_id)
            return {"status": "completed", "letter_id": letter_id}
        except Exception as e:
            error_msg = str(e)
            logger.error("classify_letter_task.failed", letter_id=letter_id, job_id=job_id, error=error_msg)
            await _update_job_status(
                session, job_id, "failed",
                error_message=error_msg
            )
            raise


async def generate_draft_task(ctx: Dict[str, Any], letter_id: str, tone: str = "") -> Dict[str, Any]:
    """
    Generate a draft response for a letter using RAG + AI.
    """
    job_id = ctx.get("job_id", "")
    logger.info("generate_draft_task.start", letter_id=letter_id, job_id=job_id, tone=tone)

    async with async_session_factory() as session:
        try:
            await _update_job_status(session, job_id, "running")

            from backend.services.drafting import generate_draft
            draft = await generate_draft(session, letter_id, additional_instructions=tone)

            await _update_job_status(
                session, job_id, "completed",
                result={
                    "draft_id": str(draft.id),
                    "letter_id": letter_id,
                    "version": draft.version,
                }
            )
            logger.info("generate_draft_task.success", letter_id=letter_id, draft_id=str(draft.id), job_id=job_id)
            return {"status": "completed", "draft_id": str(draft.id), "letter_id": letter_id}
        except Exception as e:
            error_msg = str(e)
            logger.error("generate_draft_task.failed", letter_id=letter_id, job_id=job_id, error=error_msg)
            await _update_job_status(
                session, job_id, "failed",
                error_message=error_msg
            )
            raise


async def index_kb_document_task(ctx: Dict[str, Any], document_id: str) -> Dict[str, Any]:
    """
    Index a knowledge base document in the background:
    1. Load file from storage
    2. Extract text
    3. Chunk text
    4. Generate embeddings
    5. Store chunks
    """
    job_id = ctx.get("job_id", "")
    logger.info("index_kb_document_task.start", document_id=document_id, job_id=job_id)

    async with async_session_factory() as session:
        try:
            await _update_job_status(session, job_id, "running")

            stmt = select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
            result_obj = await session.execute(stmt)
            doc = result_obj.scalar_one_or_none()

            if not doc:
                raise ValueError(f"Document {document_id} not found")

            if doc.status == "indexed":
                logger.info("index_kb_document_task.already_indexed", document_id=document_id)
                await _update_job_status(session, job_id, "completed",
                    result={"document_id": document_id, "status": "already_indexed"})
                return {"status": "completed", "document_id": document_id}

            from backend.services.storage import storage_backend
            from backend.services.knowledge_base import extract_text_from_bytes, chunk_text, generate_embeddings

            # Load file from storage
            file_content = await storage_backend.download(doc.storage_path)
            raw_text = await extract_text_from_bytes(file_content, doc.file_type, doc.filename)
            doc.raw_text = raw_text
            await session.flush()

            # Chunk and embed
            chunks = chunk_text(raw_text)

            if not chunks:
                doc.status = "failed"
                doc.chunk_count = 0
                await session.flush()
                raise ValueError(f"Document {document_id} produced no chunks")

            embeddings = await generate_embeddings(chunks)

            # Remove existing chunks (if re-indexing)
            delete_stmt = select(DocumentChunk).where(DocumentChunk.document_id == document_id)
            existing = await session.execute(delete_stmt)
            for chunk in existing.scalars().all():
                await session.delete(chunk)

            # Store new chunks
            for idx, (chunk_text_str, embedding) in enumerate(zip(chunks, embeddings)):
                chunk = DocumentChunk(
                    document_id=document_id,
                    chunk_index=idx,
                    chunk_text=chunk_text_str,
                    embedding=embedding,
                    metadata_={
                        "filename": doc.filename,
                        "category": doc.category,
                        "chunk_index": idx,
                        "total_chunks": len(chunks),
                    },
                )
                session.add(chunk)

            doc.chunk_count = len(chunks)
            doc.status = "indexed"
            await session.flush()

            await _update_job_status(
                session, job_id, "completed",
                result={"document_id": document_id, "chunks": len(chunks)}
            )
            logger.info("index_kb_document_task.success", document_id=document_id, chunks=len(chunks), job_id=job_id)
            return {"status": "completed", "document_id": document_id}
        except Exception as e:
            error_msg = str(e)
            logger.error("index_kb_document_task.failed", document_id=document_id, job_id=job_id, error=error_msg)
            await _update_job_status(
                session, job_id, "failed",
                error_message=error_msg
            )
            raise


async def send_email_task(ctx: Dict[str, Any], template_name: str, recipients: list, subject: str, template_data: dict) -> Dict[str, Any]:
    """
    Send an email notification via background task.
    Silently skips if SMTP is not configured.
    """
    job_id = ctx.get("job_id", "")
    logger.info("send_email_task.start", template=template_name, recipients=recipients, job_id=job_id)

    try:
        from backend.services.email_service import EmailService
        email_service = EmailService()
        await email_service.send(template_name, recipients, subject, template_data)
        logger.info("send_email_task.success", template=template_name, job_id=job_id)
        return {"status": "completed"}
    except Exception as e:
        logger.warning("send_email_task.failed", template=template_name, error=str(e), job_id=job_id)
        return {"status": "failed", "error": str(e)}


async def deliver_webhook_task(ctx: Dict[str, Any], webhook_id: str, event: str, payload: dict) -> Dict[str, Any]:
    """
    Deliver a webhook event to a configured webhook URL.
    """
    job_id = ctx.get("job_id", "")
    logger.info("deliver_webhook_task.start", webhook_id=webhook_id, event_name=event, job_id=job_id)

    async with async_session_factory() as session:
        try:
            from backend.services.webhook_service import deliver_webhook
            result = await deliver_webhook(session, webhook_id, event, payload)
            logger.info("deliver_webhook_task.success", webhook_id=webhook_id, event_name=event, job_id=job_id)
            return result
        except Exception as e:
            logger.error("deliver_webhook_task.failed", webhook_id=webhook_id, event_name=event, error=str(e), job_id=job_id)
            raise


async def startup(ctx: Dict[str, Any]):
    logger.info("worker.starting")


async def shutdown(ctx: Dict[str, Any]):
    logger.info("worker.stopping")


class WorkerSettings:
    """
    ARQ worker settings.
    """
    functions = [
        classify_letter_task,
        generate_draft_task,
        index_kb_document_task,
        send_email_task,
        deliver_webhook_task,
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(str(settings.redis.url))
    job_timeout = 600
    result_ttl = 3600
    max_tries = 3
    keep_result = 3600
    keep_result_failed = 7200
