"""
Phase 1 API — Knowledge Base endpoints.
Upload documents, list, search, and manage the knowledge base.
"""
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_role
from backend.api.limiter import limiter
from backend.database import get_db
from backend.models.user import User
from backend.services import knowledge_base as kb_service
from backend.services.job_queue import enqueue_job, get_arq_redis
from backend.services.file_validator import validate_file

router = APIRouter(prefix="/api/knowledge", tags=["Knowledge Base"])


@router.post("/upload")
@limiter.limit("20/minute")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    category: str = Form("general"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document to the knowledge base for background indexing. Returns HTTP 202 with job_id.
    Rate limited: 20/minute per user.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    content = await file.read()

    try:
        validation = await validate_file(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "txt"

    try:
        # Save to storage and create DB record — heavy work done by ARQ worker
        doc = await kb_service.init_document(
            db, file.filename, content, ext, category, current_user.id
        )

        arq_redis = await get_arq_redis()
        job = await enqueue_job(
            db=db,
            arq_redis=arq_redis,
            job_type="index_kb_document_task",
            payload={"document_id": str(doc.id)},
            created_by=current_user.id,
        )

        return {
            "status": "accepted",
            "document": doc.to_dict(),
            "job": {"id": str(job.id), "status": "queued"},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@router.get("/documents")
async def list_documents(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all documents in the knowledge base with pagination.
    Default limit is 50, max 200.
    """
    limit = min(limit, 200)
    documents, total = await kb_service.get_all_documents(
        db, current_user.id, current_user.role, skip=skip, limit=limit
    )
    return {"documents": documents, "total": total, "skip": skip, "limit": limit}


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(require_role("admin", "drafter")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a document and all its chunks. Only admins and drafters can delete."""
    success = await kb_service.delete_document(db, document_id, current_user.id, current_user.role)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "success", "message": "Document deleted"}


@router.get("/stats")
async def knowledge_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get knowledge base statistics."""
    stats = await kb_service.get_document_stats(db, current_user.id, current_user.role)
    return stats


@router.post("/search")
async def search_knowledge(
    query: str = Form(...),
    top_k: int = Form(5),
    category: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Semantic search across the knowledge base."""
    results = await kb_service.search_similar_chunks(db, query, top_k, category, current_user.id, current_user.role)
    return {"results": results, "query": query, "count": len(results)}
