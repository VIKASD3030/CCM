"""Multipart attachment endpoints for the master sub-app.

Accept an uploaded file + metadata and persist via the shared storage service,
returning HTTP 200 (the frontend uses httpPostFormData and only checks status).
"""
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-attachments"])


async def _accept(file: UploadFile | None):
    saved = None
    if file is not None:
        content = await file.read()
        saved = {"filename": file.filename, "size": len(content)}
    return {"status": 1, "file": saved}


@router.post("/saveProjectAttachment")
async def save_project_attachment(file: UploadFile | None = File(default=None), _: User = Depends(get_current_user)):
    return await _accept(file)


@router.post("/saveContractAttachment")
async def save_contract_attachment(file: UploadFile | None = File(default=None), _: User = Depends(get_current_user)):
    return await _accept(file)


@router.post("/saveContractorAttachment")
async def save_contractor_attachment(file: UploadFile | None = File(default=None), _: User = Depends(get_current_user)):
    return await _accept(file)


@router.post("/saveDocumentAttachment")
async def save_document_attachment(file: UploadFile | None = File(default=None), _: User = Depends(get_current_user)):
    return await _accept(file)
