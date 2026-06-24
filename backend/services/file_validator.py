"""
File upload validation service.
Checks magic bytes, size limits, and computes SHA-256 checksum.
"""
import structlog

from backend.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/jpeg",
    "image/png",
}

MAX_UPLOAD_SIZE = settings.max_upload_size_mb * 1024 * 1024


async def validate_file(file_bytes: bytes, original_filename: str) -> dict:
    """Validate file: check magic bytes, size, return content_type and checksum.
    
    Returns:
        dict with content_type, checksum_sha256, size_bytes
    Raises:
        ValueError if validation fails
    """
    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise ValueError(
            f"File size {len(file_bytes)} bytes exceeds maximum {MAX_UPLOAD_SIZE} bytes"
        )

    content_type = await detect_mime_type(file_bytes, original_filename)

    if content_type not in ALLOWED_MIME_TYPES:
        raise ValueError(
            f"File type '{content_type}' is not allowed. "
            f"Allowed types: {', '.join(ALLOWED_MIME_TYPES)}"
        )

    from backend.services.storage import compute_sha256
    checksum = compute_sha256(file_bytes)

    return {
        "content_type": content_type,
        "checksum_sha256": checksum,
        "size_bytes": len(file_bytes),
    }


async def detect_mime_type(file_bytes: bytes, filename: str) -> str:
    """Detect MIME type using python-magic (magic bytes)."""
    try:
        import magic
        mime = magic.from_buffer(file_bytes, mime=True)
        if mime:
            return mime
    except ImportError:
        logger.warning("python-magic not available, falling back to extension detection")
    except Exception as e:
        logger.warning("magic detection failed", error=str(e))

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    extension_map = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "txt": "text/plain",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
    }
    return extension_map.get(ext, "application/octet-stream")
