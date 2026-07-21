"""
CCM Application Configuration.
Reads settings from .env file using Pydantic BaseSettings v2.
Supports reading secrets from files (Docker/Kubernetes secrets pattern).
Uses nested settings model with env_nested_delimiter="__".
"""

from pydantic_settings import BaseSettings
from pydantic import BaseModel, PostgresDsn, RedisDsn, Field, field_validator, model_validator
from typing import List, Literal, Optional
from pathlib import Path


class DatabaseSettings(BaseModel):
    url: PostgresDsn = Field(..., description="PostgreSQL connection URL")
    pool_size: int = Field(5, description="Connection pool size")
    max_overflow: int = Field(10, description="Connection pool max overflow")
    pool_timeout: int = Field(30, description="Connection pool timeout")
    pool_recycle: int = Field(1800, description="Connection pool recycle")
    pool_pre_ping: bool = Field(True, description="Connection pool pre ping")


class RedisSettings(BaseModel):
    # Optional for the initial stage: without Redis, background jobs run
    # synchronously in-process instead of via the ARQ queue (see job_queue.py).
    url: Optional[RedisDsn] = Field(None, description="Redis connection URL (optional — omit to run without Redis)")


class StorageSettings(BaseModel):
    backend: Literal['local', 's3'] = Field('local', description="Storage backend")
    local_path: Path = Field(Path('/tmp/ccm-files'), description="Local storage path")
    s3_bucket: Optional[str] = Field(None, description="S3 bucket name")
    s3_region: Optional[str] = Field(None, description="S3 region")
    s3_endpoint_url: Optional[str] = Field(None, description="S3 endpoint URL (for MinIO)")


class AISettings(BaseModel):
    openai_api_key: str = Field(..., description="OpenAI API key (fallback)")
    model: str = Field('gpt-4o', description="AI model name")
    max_tokens: int = Field(4096, description="Maximum tokens for AI model")


# class KnowerSettings(BaseModel):
#     api_key: str = Field(..., description="Knower API key")
#     api_base: str = Field('https://api.knower.ai/v1', description="Knower API base URL")
#     model: str = Field('gpt-5.5', description="Knower model name")


class AuthSettings(BaseModel):
    secret_key: str = Field(min_length=32, description="Secret key for JWT")
    access_token_expire_minutes: int = Field(15, description="Access token expire minutes")
    refresh_token_expire_days: int = Field(7, description="Refresh token expire days")
    google_client_id: str | None = Field(None, description="Google OAuth client ID")
    google_client_secret: str | None = Field(None, description="Google OAuth client secret")
    google_allowed_domains: list[str] | None = Field(None, description="Allowed email domains for Google sign-in")

    @field_validator("google_allowed_domains", mode="before")
    @classmethod
    def parse_google_allowed_domains(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database: DatabaseSettings

    # Redis (optional — see RedisSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)

    # Storage
    storage: StorageSettings

    # AI
    ai: AISettings

    # Knower API
    # knower: KnowerSettings

    # Auth
    auth: AuthSettings

    # App
    app_name: str = Field("CCM - Correspondence Contract Management", description="Application name")
    debug: bool = Field(False, description="Debug mode")
    environment: Literal['development', 'staging', 'production'] = Field('development', description="Environment")
    allowed_origins: List[str] = Field([], description="Allowed origins for CORS")
    app_base_url: str = Field("http://localhost:8000", description="Base URL for the application (links in emails)")

    # File upload
    max_upload_size_mb: int = Field(50, description="Maximum upload size in MB")
    enable_virus_scan: bool = Field(False, description="Enable virus scan")
    clamav_url: Optional[str] = Field(None, description="ClamAV URL")

    # Webhooks
    webhook_secret_key: str = Field(..., description="Secret key for HMAC signing webhooks")

    # Rate limiting
    rate_limit_per_minute: int = Field(100, description="Rate limit per minute")

    # Prometheus
    enable_metrics: bool = Field(True, description="Enable Prometheus metrics")
    metrics_allowed_cidr: Optional[str] = Field(None, description="CIDR allowed to scrape /api/metrics")

    # Azure AD SSO (per-user auth_provider field, not a global mode)
    azure_tenant_id: Optional[str] = Field(None, description="Azure AD tenant ID")
    azure_client_id: Optional[str] = Field(None, description="Azure AD client ID")
    azure_jwks_url: Optional[str] = Field(None, description="Azure AD JWKS URL override")

    # PgBouncer
    use_pgbouncer: bool = Field(True, description="Use PgBouncer")

    # @property
    # def knower_api_key(self) -> str:
    #     return self.knower.api_key

    @property
    def openai_api_key(self) -> str:
        return self.ai.openai_api_key

    @property
    def generation_model(self) -> str:
        return self.ai.model

    @property
    def chunk_size(self) -> int:
        return 500

    @property
    def chunk_overlap(self) -> int:
        return 50

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def validate_enterprise_runtime(self):
        placeholder_secrets = {
            "your-super-secret-key-change-this-to-at-least-32-characters",
            "your-webhook-secret-key-change-this",
        }
        if self.environment == "production":
            if not self.allowed_origins:
                raise ValueError("ALLOWED_ORIGINS must be set in production")
            if self.auth.secret_key in placeholder_secrets:
                raise ValueError("AUTH__SECRET_KEY must be changed before production")
            if self.webhook_secret_key in placeholder_secrets:
                raise ValueError("WEBHOOK_SECRET_KEY must be changed before production")
            if self.debug:
                raise ValueError("DEBUG must be false in production")
        return self

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "env_nested_delimiter": "__",
        "extra": "ignore",
    }


def get_settings() -> Settings:
    """Settings instance — loaded once at startup."""
    return Settings()
