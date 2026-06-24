"""
Storage abstraction layer.
Supports LocalStorageBackend (dev) and S3StorageBackend (prod/MinIO).
Selected via STORAGE_BACKEND env var.
"""
import io
import os
import hashlib
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

import structlog

from backend.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class StorageBackend(ABC):
    """Abstract base class for file storage backends."""

    @abstractmethod
    async def upload(self, file_bytes: bytes, key: str, content_type: str) -> str:
        """Upload bytes to storage. Returns the URL or key."""

    @abstractmethod
    async def download(self, key: str) -> bytes:
        """Download bytes from storage."""

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete a file from storage."""

    @abstractmethod
    async def get_signed_url(self, key: str, expires_seconds: int = 3600) -> str:
        """Get a signed/download URL for the file."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the storage backend is healthy."""


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage backend for development."""

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or settings.storage.local_path
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info("storage.local.initialized", path=str(self.base_path))

    async def upload(self, file_bytes: bytes, key: str, content_type: str) -> str:
        file_path = self.base_path / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        logger.info("storage.local.uploaded", key=key, size=len(file_bytes))
        return key

    async def download(self, key: str) -> bytes:
        file_path = self.base_path / key
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {key}")
        with open(file_path, "rb") as f:
            return f.read()

    async def delete(self, key: str) -> None:
        file_path = self.base_path / key
        if file_path.exists():
            file_path.unlink()
            logger.info("storage.local.deleted", key=key)

    async def get_signed_url(self, key: str, expires_seconds: int = 3600) -> str:
        from backend.config import get_settings
        s = get_settings()
        base_url = os.getenv("APP_BASE_URL", "http://localhost:8000")
        return f"{base_url}/api/files/{key}"

    async def health_check(self) -> bool:
        return self.base_path.exists()


class S3StorageBackend(StorageBackend):
    """S3/MinIO storage backend for production."""

    def __init__(self):
        self.bucket = settings.storage.s3_bucket or "ccm-files"
        self.region = settings.storage.s3_region or "us-east-1"
        self.endpoint_url = settings.storage.s3_endpoint_url
        self.access_key = os.getenv("AWS_ACCESS_KEY_ID", "minioadmin")
        self.secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin")
        logger.info("storage.s3.initialized", bucket=self.bucket, endpoint=self.endpoint_url)

    async def _get_client(self):
        import aioboto3
        session = aioboto3.Session()
        return session.client(
            "s3",
            region_name=self.region,
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
        )

    async def upload(self, file_bytes: bytes, key: str, content_type: str) -> str:
        async with await self._get_client() as s3:
            await s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
        logger.info("storage.s3.uploaded", key=key, bucket=self.bucket)
        return key

    async def download(self, key: str) -> bytes:
        async with await self._get_client() as s3:
            response = await s3.get_object(Bucket=self.bucket, Key=key)
            return await response["Body"].read()

    async def delete(self, key: str) -> None:
        async with await self._get_client() as s3:
            await s3.delete_object(Bucket=self.bucket, Key=key)
        logger.info("storage.s3.deleted", key=key)

    async def get_signed_url(self, key: str, expires_seconds: int = 3600) -> str:
        async with await self._get_client() as s3:
            url = await s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_seconds,
            )
            return url

    async def health_check(self) -> bool:
        try:
            async with await self._get_client() as s3:
                await s3.head_bucket(Bucket=self.bucket)
            return True
        except Exception as e:
            logger.error("storage.s3.health_check.failed", error=str(e))
            return False


def get_storage_backend() -> StorageBackend:
    """Factory function to get the configured storage backend."""
    backend_type = settings.storage.backend
    if backend_type == "s3":
        return S3StorageBackend()
    return LocalStorageBackend()


storage_backend = get_storage_backend()


def compute_sha256(file_bytes: bytes) -> str:
    """Compute SHA-256 checksum of file bytes."""
    return hashlib.sha256(file_bytes).hexdigest()
