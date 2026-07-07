"""
Database models package.
Import all models here so Alembic and Base.metadata.create_all() discover them.
"""

from backend.models.document import KnowledgeDocument, DocumentChunk
from backend.models.letter import InboundLetter
from backend.models.draft import DraftResponse
from backend.models.audit import AuditEntry
from backend.models.user import User
from backend.models.file import FileRecord
from backend.models.job import Job
from backend.models.webhook import Webhook, WebhookDelivery
from backend.models.email_notification import EmailNotificationSetting
from backend.models.revoked_token import RevokedToken
from backend.models.password_reset import PasswordResetToken
from backend.models.project import Project
from backend.models.sharepoint_sync import SharePointSyncLog
from backend.models.drafting_session import DraftingSession
from backend.models.drafting_message import DraftingMessage
from backend.models.prompt_template import PromptTemplate

__all__ = [
    "KnowledgeDocument",
    "DocumentChunk",
    "InboundLetter",
    "DraftResponse",
    "AuditEntry",
    "User",
    "FileRecord",
    "Job",
    "Webhook",
    "WebhookDelivery",
    "EmailNotificationSetting",
    "RevokedToken",
    "PasswordResetToken",
    "Project",
    "SharePointSyncLog",
    "DraftingSession",
    "DraftingMessage",
    "PromptTemplate",
]
