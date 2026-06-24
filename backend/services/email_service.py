"""
Email notification service using aiosmtplib.
Sends HTML emails via Jinja2 templates.
If SMTP is not configured, logs a warning and skips silently.
"""
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import List, Optional

import structlog
from jinja2 import Environment, FileSystemLoader

from backend.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = BASE_DIR / "templates" / "email"

_jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


class EmailService:
    """Service for sending email notifications via SMTP."""

    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("SMTP_FROM_EMAIL", "noreply@ccm.app")
        self.from_name = os.getenv("SMTP_FROM_NAME", "CCM System")

        self._configured = bool(self.smtp_host)

    async def send(
        self,
        template_name: str,
        recipients: List[str],
        subject: str,
        template_data: dict,
    ) -> bool:
        """Send an email using a Jinja2 template.

        Silently skips if SMTP is not configured.
        Returns True if sent, False if skipped.
        """
        if not self._configured:
            logger.warning(
                "email_service.not_configured",
                template=template_name,
                recipients=recipients,
                subject=subject,
            )
            return False

        try:
            template = _jinja_env.get_template(f"{template_name}.html")
            html_body = template.render(**template_data)

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = ", ".join(recipients)
            msg.attach(MIMEText(html_body, "html"))

            import aiosmtplib

            await aiosmtplib.send(
                msg,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_password,
                start_tls=True,
            )

            logger.info("email_service.sent", template=template_name, recipients=recipients)
            return True
        except Exception as e:
            logger.warning("email_service.failed", template=template_name, error=str(e))
            return False


# Singleton instance
email_service = EmailService()
