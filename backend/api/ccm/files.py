"""
File download API endpoints.
Provides secure access to stored files with auth verification.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.database import get_db
from backend.models.user import User
from backend.models.file import FileRecord
from backend.models.letter import InboundLetter
from backend.services.storage import storage_backend

router = APIRouter(prefix="/api/files", tags=["Files"])


@router.get("/{file_id}/download")
async def download_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download a file.
    
    Access control:
    - Admins can download any file
    - Drafters can only download files they uploaded
    """
    file_record = await db.get(FileRecord, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    if file_record.deleted_at:
        raise HTTPException(status_code=410, detail="File has been deleted")

    if current_user.role != "admin":
        if file_record.uploaded_by != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Get signed URL for S3, stream for local
    try:
        if file_record.storage_backend == "s3":
            signed_url = await storage_backend.get_signed_url(file_record.storage_key)
            return Response(
                content=None,
                status_code=302,
                headers={"Location": signed_url},
            )
        else:
            file_bytes = await storage_backend.download(file_record.storage_key)
            return StreamingResponse(
                iter([file_bytes]),
                media_type=file_record.content_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{file_record.original_filename}"',
                    "Content-Length": str(file_record.size_bytes),
                },
            )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found on storage backend")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
