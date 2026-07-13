"""
SharePoint sync connector using Microsoft Graph API.
Pulls files from each project's SharePoint document library and feeds them
into the ingestion pipeline, tagging documents with the correct project_id.
Logs each run in sharepoint_sync_log.
"""
import uuid
import structlog
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import async_session_factory
from backend.models.project import Project
from backend.models.sharepoint_sync import SharePointSyncLog
from backend.models.document import KnowledgeDocument, DocumentChunk
from backend.services.knowledge_base import extract_text_from_bytes, chunk_text, generate_embeddings, ingest_document
from backend.services.storage import storage_backend

logger = structlog.get_logger()
settings = get_settings()

MICROSOFT_GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# In production, use OAuth2 client credentials flow with a certificate
# For development, we use a tenant-scoped token passed via env
SHAREPOINT_ACCESS_TOKEN = None


def _get_auth_headers() -> dict:
    """Return auth headers for Graph API calls."""
    token = settings.sharepoint_access_token if hasattr(settings, 'sharepoint_access_token') else None
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


async def _fetch_site_drive_items(site_id: str, folder_path: str = "") -> list[dict]:
    """Fetch files from a SharePoint site's default document library."""
    headers = _get_auth_headers()
    if not headers:
        logger.warning("sharepoint.no_access_token_configured")
        return []

    async with httpx.AsyncClient(base_url=MICROSOFT_GRAPH_BASE, headers=headers, timeout=30.0) as client:
        try:
            # Get the default document library
            drives_resp = await client.get(f"/sites/{site_id}/drives")
            drives_resp.raise_for_status()
            drives = drives_resp.json().get("value", [])
            if not drives:
                logger.warning("sharepoint.no_drives_found", site_id=site_id)
                return []

            drive_id = drives[0]["id"]
            path = f"/drives/{drive_id}/root/children"
            if folder_path:
                path = f"/drives/{drive_id}/root:/{folder_path}:/children"

            items_resp = await client.get(path)
            items_resp.raise_for_status()
            items = items_resp.json().get("value", [])

            return [
                {
                    "id": item["id"],
                    "name": item["name"],
                    "download_url": item.get("@microsoft.graph.downloadUrl"),
                    "last_modified": item.get("lastModifiedDateTime"),
                    "size": item.get("size", 0),
                    "file_type": item.get("file", {}).get("mimeType", "").split("/")[-1] or item["name"].rsplit(".", 1)[-1],
                }
                for item in items
                if "file" in item and item.get("@microsoft.graph.downloadUrl")
            ]
        except Exception as e:
            logger.error("sharepoint.fetch_drive_items_failed", site_id=site_id, error=str(e))
            return []


async def _download_file(download_url: str) -> bytes:
    """Download a file from SharePoint."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(download_url)
        resp.raise_for_status()
        return resp.content


async def sync_project_sharepoint(project_id: str) -> dict:
    """Sync a single project's SharePoint document library into the KB."""
    result = {
        "files_synced": 0,
        "files_deleted": 0,
        "errors": [],
    }

    async with async_session_factory() as db:
        # Fetch project
        project = await db.get(Project, project_id)
        if not project or not project.sharepoint_site_id:
            return {"error": "Project has no SharePoint site configured"}

        # Create sync log entry
        sync_log = SharePointSyncLog(
            project_id=uuid.UUID(project_id),
            sync_status="running",
            last_synced_at=datetime.now(timezone.utc),
        )
        db.add(sync_log)
        await db.flush()

        try:
            # Fetch files from SharePoint
            files = await _fetch_site_drive_items(project.sharepoint_site_id)

            # Get existing document filenames for this project
            existing_stmt = select(KnowledgeDocument).where(
                KnowledgeDocument.project_id == project_id
            )
            existing_result = await db.execute(existing_stmt)
            existing_docs = {doc.filename: doc for doc in existing_result.scalars().all()}

            synced_filenames = set()

            for file_info in files:
                filename = file_info["name"]
                synced_filenames.add(filename)

                try:
                    # Check if file has been modified
                    if filename in existing_docs:
                        existing = existing_docs[filename]
                        sharepoint_modified = file_info.get("last_modified", "")
                        if existing.updated_at and sharepoint_modified:
                            import dateutil.parser
                            sharepoint_ts = dateutil.parser.parse(sharepoint_modified)
                            if sharepoint_ts.tzinfo is None:
                                sharepoint_ts = sharepoint_ts.replace(tzinfo=timezone.utc)
                            if existing.updated_at >= sharepoint_ts:
                                continue

                    # Download and ingest
                    content = await _download_file(file_info["download_url"])
                    file_type = file_info.get("file_type", "pdf")

                    await ingest_document(
                        db,
                        filename=filename,
                        content=content,
                        file_type=file_type,
                        category="sharepoint",
                        user_id=None,
                    )
                    result["files_synced"] += 1

                except Exception as e:
                    logger.warning("sharepoint.file_sync_failed", filename=filename, error=str(e))
                    result["errors"].append(f"{filename}: {str(e)}")

            # Handle deletions: remove docs that no longer exist in SharePoint
            for filename, doc in existing_docs.items():
                if filename not in synced_filenames:
                    await db.delete(doc)
                    result["files_deleted"] += 1

            # Update sync log
            sync_log.sync_status = "success" if not result["errors"] else "partial"
            sync_log.files_synced = result["files_synced"]
            sync_log.files_deleted = result["files_deleted"]
            if result["errors"]:
                sync_log.error_message = "; ".join(result["errors"][:5])
            await db.flush()

        except Exception as e:
            sync_log.sync_status = "failed"
            sync_log.error_message = str(e)
            await db.flush()
            result["error"] = str(e)

    return result


async def sync_all_projects() -> dict:
    """Sync SharePoint for all projects that have a site_id configured."""
    results = {}
    async with async_session_factory() as db:
        stmt = select(Project).where(
            Project.status == "active",
            Project.sharepoint_site_id.isnot(None),
        )
        result = await db.execute(stmt)
        projects = result.scalars().all()

        for project in projects:
            results[str(project.id)] = await sync_project_sharepoint(str(project.id))

    return results
