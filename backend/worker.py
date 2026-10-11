"""
ARQ worker for background job processing.
Implements tasks for letter classification, draft generation, and KB document indexing.
Each task updates the jobs table and sends pg_notify on completion/failure.
"""
import asyncio
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
    # A failing task leaves its transaction aborted; roll back so we can still
    # persist the "failed" status instead of the job hanging non-terminal
    # (which the frontend surfaces as "Timed out waiting for draft").
    if status == "failed":
        try:
            await session.rollback()
        except Exception:  # noqa: BLE001
            pass

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

            from backend.services.letter_intake import (
                ROUTE_AUTO_ASSIGN_CONFIDENCE, apply_classification, classify_letter, route_by_keywords,
            )

            def apply_routing(routing: dict, valid_ids: set) -> None:
                """Assign the project when confident, otherwise leave a suggestion
                (with its reason) for the user to confirm."""
                if routing["project_id"] not in valid_ids:
                    return
                letter.routing_confidence = routing["confidence"]
                letter.routing_reason = routing["reason"]
                if routing["confidence"] >= ROUTE_AUTO_ASSIGN_CONFIDENCE:
                    letter.project_id = routing["project_id"]
                    letter.suggested_project_id = None
                else:
                    letter.suggested_project_id = routing["project_id"]

            # Route to a project only if the upload didn't already specify one.
            projects_list = None
            valid_ids: set = set()
            if not letter.project_id:
                from backend.models.project import Project
                projects_result = await session.execute(
                    select(Project).where(Project.status == "active")
                )
                active_projects = projects_result.scalars().all()
                projects_list = [p.to_dict() for p in active_projects] if active_projects else None
                valid_ids = {p["id"] for p in (projects_list or [])}
                # 1. The letter names a project's code or name: no LLM needed.
                keyword_route = route_by_keywords(letter.raw_text, projects_list or [])
                if keyword_route:
                    apply_routing(keyword_route, valid_ids)
                    # Keep the routing even if classification below fails.
                    await session.commit()

            # Classify the letter text
            classification = await classify_letter(
                letter.raw_text,
                projects=projects_list if not letter.project_id else None,
            )

            # Update letter with classification results
            apply_classification(letter, classification)
            if not letter.project_id and classification.get("predicted_project"):
                pred = classification["predicted_project"]
                # Only accept a real project id; anything else leaves the letter
                # unassigned so the inbox asks the user to confirm a project.
                apply_routing({
                    "project_id": pred.get("predicted_project_id"),
                    "confidence": float(pred.get("confidence") or 0.0),
                    "reason": pred.get("reason") or "Suggested by CCM from the letter's content.",
                }, valid_ids)
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


async def generate_draft_task(ctx: Dict[str, Any], letter_id: str, tone: str = "", session_id: str = "") -> Dict[str, Any]:
    """
    Generate a draft response for a letter using RAG + AI.
    """
    job_id = ctx.get("job_id", "")
    logger.info("generate_draft_task.start", letter_id=letter_id, job_id=job_id, tone=tone, session_id=session_id)

    async with async_session_factory() as session:
        try:
            await _update_job_status(session, job_id, "running")

            from backend.services.drafting import generate_draft
            draft = await generate_draft(session, letter_id, additional_instructions=tone)

            # If session_id is provided, automatically add the AI response to the drafting session thread
            if session_id:
                try:
                    from backend.services.drafting_sessions import add_message
                    await add_message(
                        db=session,
                        session_id=session_id,
                        role="assistant",
                        content=draft.draft_text,
                        draft_response_id=str(draft.id),
                    )
                    logger.info("generate_draft_task.saved_message", session_id=session_id, draft_id=str(draft.id))
                except Exception as e:
                    logger.error("generate_draft_task.save_message_failed", session_id=session_id, error=str(e))

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


# Indexing reads, OCRs and embeds a whole document. A bulk ZIP import queues
# hundreds at once, so cap how many run at the same time in this process.
_INDEX_SLOTS = asyncio.Semaphore(3)


async def index_kb_document_task(ctx: Dict[str, Any], document_id: str) -> Dict[str, Any]:
    """
    Index a knowledge base document in the background:
    1. Load the original file from storage
    2. Extract text (OCR for scanned pages) and correspondence metadata
    3. Chunk (clause-aware for contract volumes), embed and store
    """
    job_id = ctx.get("job_id", "")
    logger.info("index_kb_document_task.start", document_id=document_id, job_id=job_id)

    async with _INDEX_SLOTS, async_session_factory() as session:
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
            from backend.services.knowledge_base import process_document

            file_content = await storage_backend.download(doc.storage_path)
            chunk_total = await process_document(session, doc, file_content)
            if not chunk_total:
                raise ValueError(doc.status_detail or f"Document {document_id} produced no chunks")

            await _update_job_status(
                session, job_id, "completed",
                result={"document_id": document_id, "chunks": chunk_total}
            )
            logger.info("index_kb_document_task.success", document_id=document_id, chunks=chunk_total, job_id=job_id)
            return {"status": "completed", "document_id": document_id}
        except Exception as e:
            error_msg = str(e)
            logger.error("index_kb_document_task.failed", document_id=document_id, job_id=job_id, error=error_msg)
            # Don't leave the document stuck in "processing" in the project folder.
            try:
                await session.rollback()
                failed_doc = await session.get(KnowledgeDocument, document_id)
                if failed_doc and failed_doc.status != "indexed":
                    failed_doc.status = "failed"
                    failed_doc.status_detail = error_msg.splitlines()[0][:500] if error_msg else "Indexing failed"
                    await session.commit()
            except Exception as mark_err:  # noqa: BLE001
                logger.warning("index_kb_document_task.mark_failed_error", error=str(mark_err))
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


async def sharepoint_sync_task(ctx: Dict[str, Any], project_id: str = None) -> Dict[str, Any]:
    """
    Sync SharePoint documents for a project (or all projects).
    Runs in the background so it doesn't block the API.
    """
    job_id = ctx.get("job_id", "")
    logger.info("sharepoint_sync_task.start", project_id=project_id, job_id=job_id)

    try:
        from backend.services.sharepoint_sync import sync_project_sharepoint, sync_all_projects

        if project_id:
            result = await sync_project_sharepoint(project_id)
        else:
            result = await sync_all_projects()

        logger.info("sharepoint_sync_task.success", project_id=project_id, result=result, job_id=job_id)
        return {"status": "completed", "result": result}
    except Exception as e:
        logger.error("sharepoint_sync_task.failed", project_id=project_id, error=str(e), job_id=job_id)
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
        sharepoint_sync_task,
    ]
    on_startup = startup
    on_shutdown = shutdown
    # Only needed to run the standalone ARQ worker process (`ccm worker start`).
    # When Redis isn't configured, jobs run inline instead and this module is
    # still imported (for its task functions), so this must not raise at import time.
    redis_settings = RedisSettings.from_dsn(str(settings.redis.url)) if settings.redis.url else None
    job_timeout = 600
    result_ttl = 3600
    max_tries = 3
    keep_result = 3600
    keep_result_failed = 7200
