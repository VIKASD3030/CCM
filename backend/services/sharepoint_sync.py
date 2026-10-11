"""
SharePoint sync connector using Microsoft Graph API.
Pulls files from each project's SharePoint document library and feeds them
into the ingestion pipeline, tagging documents with the project_id and the
project folder they came from (contract volumes / outgoing / incoming letters).
Logs each run in sharepoint_sync_log.
"""
import uuid
import structlog
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from backend.config import get_settings
from backend.database import async_session_factory
from backend.models.project import Project
from backend.models.sharepoint_sync import SharePointSyncLog
from backend.models.document import KnowledgeDocument
from backend.services.knowledge_base import DuplicateDocumentError, ingest_document

logger = structlog.get_logger()
settings = get_settings()

MICROSOFT_GRAPH_BASE = "https://graph.microsoft.com/v1.0"
MAX_FOLDER_DEPTH = 3

# Top-level library folder name -> project folder. Matched by keyword so
# "01 Contract Volumes", "Outgoing Letters", "Incoming correspondence" all work.
_FOLDER_KEYWORDS = (
    ("contract", "contract_volume"),
    ("outgoing", "outgoing_letter"),
    ("incoming", "incoming_letter"),
)


def folder_document_type(top_folder: str | None) -> str | None:
    name = (top_folder or "").lower()
    for keyword, document_type in _FOLDER_KEYWORDS:
        if keyword in name:
            return document_type
    return None


def _get_auth_headers() -> dict:
    """Return auth headers for Graph API calls."""
    token = settings.sharepoint_access_token
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


async def _list_children(client: httpx.AsyncClient, drive_id: str, item_id: str | None) -> list[dict]:
    path = f"/drives/{drive_id}/items/{item_id}/children" if item_id else f"/drives/{drive_id}/root/children"
    items: list[dict] = []
    while path:
        resp = await client.get(path)
        resp.raise_for_status()
        data = resp.json()
        items.extend(data.get("value", []))
        next_link = data.get("@odata.nextLink")
        path = next_link.replace(MICROSOFT_GRAPH_BASE, "") if next_link else None
    return items


async def _fetch_site_drive_items(site_id: str) -> list[dict]:
    """Fetch files from a SharePoint site's default document library, walking
    sub-folders. Each file carries the name of its top-level folder."""
    headers = _get_auth_headers()
    if not headers:
        logger.warning("sharepoint.no_access_token_configured")
        raise RuntimeError("SharePoint is not configured: set SHAREPOINT_ACCESS_TOKEN on the server")

    async with httpx.AsyncClient(base_url=MICROSOFT_GRAPH_BASE, headers=headers, timeout=30.0) as client:
        drives_resp = await client.get(f"/sites/{site_id}/drives")
        drives_resp.raise_for_status()
        drives = drives_resp.json().get("value", [])
        if not drives:
            logger.warning("sharepoint.no_drives_found", site_id=site_id)
            return []
        drive_id = drives[0]["id"]

        files: list[dict] = []

        async def walk(item_id: str | None, top_folder: str | None, depth: int):
            for item in await _list_children(client, drive_id, item_id):
                if "folder" in item and depth < MAX_FOLDER_DEPTH:
                    await walk(item["id"], top_folder or item["name"], depth + 1)
                elif "file" in item and item.get("@microsoft.graph.downloadUrl"):
                    files.append({
                        "id": item["id"],
                        "name": item["name"],
                        "download_url": item.get("@microsoft.graph.downloadUrl"),
                        "last_modified": item.get("lastModifiedDateTime"),
                        "size": item.get("size", 0),
                        "file_type": item["name"].rsplit(".", 1)[-1].lower() if "." in item["name"] else "pdf",
                        "top_folder": top_folder,
                    })

        await walk(None, None, 0)
        return files


async def _download_file(download_url: str) -> bytes:
    """Download a file from SharePoint."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(download_url)
        resp.raise_for_status()
        return resp.content


async def sync_project_sharepoint(project_id: str) -> dict:
    """Sync a single project's SharePoint document library into its folders."""
    result = {
        "files_synced": 0,
        "files_deleted": 0,
        "errors": [],
    }

    async with async_session_factory() as db:
        project = await db.get(Project, project_id)
        if not project or not project.sharepoint_site_id:
            return {"error": "Project has no SharePoint site configured"}

        sync_log = SharePointSyncLog(
            project_id=uuid.UUID(project_id),
            sync_status="running",
            last_synced_at=datetime.now(timezone.utc),
        )
        db.add(sync_log)
        await db.flush()

        try:
            files = await _fetch_site_drive_items(project.sharepoint_site_id)

            existing_stmt = select(KnowledgeDocument).where(
                KnowledgeDocument.project_id == project_id,
                KnowledgeDocument.category == "sharepoint",
            )
            existing_result = await db.execute(existing_stmt)
            existing_docs = {doc.filename: doc for doc in existing_result.scalars().all()}

            synced_filenames = set()

            for file_info in files:
                filename = file_info["name"]
                synced_filenames.add(filename)
                document_type = folder_document_type(file_info.get("top_folder"))

                try:
                    existing = existing_docs.get(filename)
                    if existing:
                        sharepoint_modified = file_info.get("last_modified", "")
                        if existing.updated_at and sharepoint_modified:
                            import dateutil.parser
                            sharepoint_ts = dateutil.parser.parse(sharepoint_modified)
                            if sharepoint_ts.tzinfo is None:
                                sharepoint_ts = sharepoint_ts.replace(tzinfo=timezone.utc)
                            if existing.updated_at >= sharepoint_ts:
                                continue
                        # Changed upstream: replace the old copy.
                        await db.delete(existing)
                        await db.flush()

                    content = await _download_file(file_info["download_url"])
                    await ingest_document(
                        db,
                        filename=filename,
                        content=content,
                        file_type=file_info.get("file_type", "pdf"),
                        category="sharepoint",
                        user_id=None,
                        project_id=project_id,
                        document_type=document_type,
                    )
                    result["files_synced"] += 1

                except DuplicateDocumentError:
                    # Identical file already in the project (e.g. uploaded by hand): nothing to do.
                    logger.info("sharepoint.file_already_in_project", filename=filename)
                except Exception as e:
                    logger.warning("sharepoint.file_sync_failed", filename=filename, error=str(e))
                    result["errors"].append(f"{filename}: {str(e)}")

            # Remove docs that no longer exist in SharePoint
            for filename, doc in existing_docs.items():
                if filename not in synced_filenames:
                    await db.delete(doc)
                    result["files_deleted"] += 1

            sync_log.sync_status = "success" if not result["errors"] else "partial"
            sync_log.files_synced = result["files_synced"]
            sync_log.files_deleted = result["files_deleted"]
            if result["errors"]:
                sync_log.error_message = "; ".join(result["errors"][:5])
            await db.commit()

        except Exception as e:
            await db.rollback()
            db.add(sync_log)
            sync_log.sync_status = "failed"
            sync_log.error_message = str(e)
            await db.commit()
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
