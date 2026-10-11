"""
Phase 1 API — Knowledge Base endpoints.
Upload documents, list, search, and manage the knowledge base.
"""
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_permission
from backend.api.limiter import limiter
from backend.database import get_db
from backend.models.project import Project
from backend.models.user import User
from backend.services import knowledge_base as kb_service
from backend.services.job_queue import enqueue_job, get_arq_redis
from backend.services.file_validator import validate_file

router = APIRouter(prefix="/api/knowledge", tags=["Knowledge Base"])


async def _resolve_project_id(db: AsyncSession, project_id: str | None) -> str | None:
    """Validate a CCM project id from a form field ("" / None = no project)."""
    if not project_id:
        return None
    try:
        pid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Select a CCM project. Master-only projects must be linked first.")
    if not await db.get(Project, pid):
        raise HTTPException(status_code=404, detail="Project not found")
    return str(pid)


def _validate_document_type(document_type: str | None) -> str | None:
    if not document_type:
        return None
    if document_type not in kb_service.DOCUMENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown folder '{document_type}'. Use one of: {', '.join(kb_service.DOCUMENT_TYPES)}",
        )
    return document_type


@router.post("/upload")
@limiter.limit("20/minute")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    category: str = Form("general"),
    project_id: str = Form(None),
    document_type: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document to the knowledge base for background indexing.

    `project_id` + `document_type` file it into a project folder
    (contract_volume / outgoing_letter / incoming_letter).
    Rate limited: 20/minute per user.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    pid = await _resolve_project_id(db, project_id)
    dtype = _validate_document_type(document_type)
    if dtype and not pid:
        raise HTTPException(status_code=400, detail="A project is required when uploading to a folder")

    content = await file.read()

    try:
        validation = await validate_file(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "txt"

    try:
        # Save to storage and create DB record — heavy work done by ARQ worker
        doc = await kb_service.init_document(
            db, file.filename, content, ext, dtype or category, current_user.id,
            project_id=pid, document_type=dtype,
        )
    except kb_service.DuplicateDocumentError as dup:
        # The same file is already in this project: nothing to index.
        return {"status": "duplicate", "document": dup.existing.to_dict(), "job": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

    try:
        arq_redis = await get_arq_redis()
        job = await enqueue_job(
            db=db,
            arq_redis=arq_redis,
            job_type="index_kb_document_task",
            payload={"document_id": str(doc.id)},
            created_by=current_user.id,
            background=True,
        )

        return {
            "status": "accepted",
            "document": doc.to_dict(),
            "job": {"id": str(job.id), "status": "queued"},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@router.post("/import-zip")
@limiter.limit("5/minute")
async def import_zip(
    request: Request,
    file: UploadFile = File(...),
    project_id: str = Form(...),
    document_type: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import: every PDF/DOCX/TXT/image inside a ZIP goes into one project
    folder. Duplicates are skipped; indexing runs in the background."""
    pid = await _resolve_project_id(db, project_id)
    dtype = _validate_document_type(document_type)
    if not pid or not dtype:
        raise HTTPException(status_code=400, detail="Choose a project and a folder")
    content = await file.read()
    try:
        result = await kb_service.import_zip(db, content, pid, dtype, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # One job per new document (the worker limits how many run at once).
    arq_redis = await get_arq_redis()
    await db.commit()  # the documents must exist before their jobs start
    for doc in result["created"]:
        await enqueue_job(
            db=db, arq_redis=arq_redis, job_type="index_kb_document_task",
            payload={"document_id": str(doc.id)}, created_by=current_user.id, background=True,
        )
    return {
        "status": "accepted",
        "imported": len(result["created"]),
        "duplicates": result["duplicates"],
        "skipped": result["skipped"],
        "errors": result["errors"],
        "documents": [d.to_dict() for d in result["created"]],
    }


@router.get("/documents/{document_id}/file")
async def download_document_file(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The original uploaded file (the scan itself, with letterhead and stamps)."""
    found = await kb_service.get_document_file(db, str(document_id))
    if not found:
        raise HTTPException(status_code=404, detail="The original file isn't stored for this document")
    data, content_type, filename = found
    from fastapi.responses import Response
    return Response(
        content=data, media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename.replace(chr(34), "")}"'},
    )


@router.post("/documents/{document_id}/reindex", status_code=202)
async def reindex_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run extraction and indexing again (after an OCR or embedding failure)."""
    from backend.models.document import KnowledgeDocument
    doc = await db.get(KnowledgeDocument, document_id)
    if not doc or not doc.storage_path:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.status = "processing"
    doc.status_detail = None
    await db.commit()
    job = await enqueue_job(
        db=db, arq_redis=await get_arq_redis(), job_type="index_kb_document_task",
        payload={"document_id": str(doc.id)}, created_by=current_user.id, background=True,
    )
    return {"status": "accepted", "job": {"id": str(job.id), "status": "queued"}, "document": doc.to_dict()}


@router.get("/chunks/{chunk_id}")
async def chunk_detail(
    chunk_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full text of one cited passage, with its document, clause and pages."""
    detail = await kb_service.get_chunk_detail(db, str(chunk_id))
    if not detail:
        raise HTTPException(status_code=404, detail="Passage not found")
    return detail


@router.get("/documents")
async def list_documents(
    skip: int = 0,
    limit: int = 50,
    project_id: str = None,
    document_type: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List documents in the knowledge base with pagination.
    Filter by `project_id` and folder `document_type`. Default limit 50, max 200.
    """
    limit = min(limit, 200)
    pid = await _resolve_project_id(db, project_id) if project_id else None
    documents, total = await kb_service.get_all_documents(
        db, current_user.id, current_user.role, skip=skip, limit=limit,
        project_id=pid, document_type=_validate_document_type(document_type),
    )
    return {"documents": documents, "total": total, "skip": skip, "limit": limit}


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(require_permission("knowledge", "delete")),
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
    project_id: str = Form(None),
    document_type: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Semantic search across the knowledge base, optionally within one project folder."""
    pid = await _resolve_project_id(db, project_id)
    results = await kb_service.search_hybrid(
        db, query, top_k,
        category=category,
        project_id=pid,
        user_id=None if pid else current_user.id,
        user_role=current_user.role,
        document_type=_validate_document_type(document_type),
    )
    return {"results": results, "query": query, "count": len(results)}
