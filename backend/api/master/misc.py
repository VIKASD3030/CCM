"""Misc master endpoints: getTestApi, isRecordExists, reference documents."""
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.api.deps import get_current_user
from backend.api.master._helpers import mr_list, mr_save, mr_delete, mr_exists
from backend.models.user import User

router = APIRouter(prefix="/common", tags=["master-misc"])
DOC, DOC_ID = "reference_document", "DocumentId"


@router.post("/getTestApi")
async def get_test_api(body: dict[str, Any] = {}, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return {"status": "ok", "message": "API reachable", "echo": body}


@router.post("/isRecordExists")
async def is_record_exists(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    # Frontend sends { Record, TableName } (or entity-specific fields). Match on
    # provided value(s) within the named entity's MasterRecord rows.
    table = body.get("TableName") or body.get("Entity") or "reference_document"
    record = body.get("Record")
    if record is None:
        # fall back to matching all non-key fields provided
        match = {k: v for k, v in body.items() if k not in ("TableName", "Entity")}
    else:
        match = {"Record": record}
    return await mr_exists(db, str(table), match)


# ─── Reference Documents ────────────────────────────────────────────────

@router.get("/getDocuments")
async def get_documents(documentId: int = Query(0), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    filters = {DOC_ID: documentId} if documentId else None
    return await mr_list(db, DOC, DOC_ID, filters)


@router.post("/saveDocuments")
async def save_documents(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_save(db, DOC, DOC_ID, body)


@router.post("/deleteDocuments")
async def delete_documents(body: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await mr_delete(db, DOC, DOC_ID, body)
