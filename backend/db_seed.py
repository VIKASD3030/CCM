"""
Idempotent RBAC seed — replaces the old Alembic migration f80533d1bf3e.

Called from init_db() after create_all so permissions always exist
even when Alembic is removed.
"""
from datetime import datetime, timezone
import uuid

import structlog
from sqlalchemy.ext.asyncio import AsyncConnection

logger = structlog.get_logger()

SCHEMA = "Master"

MODULES = [
    ("users", "User Management"),
    ("roles", "Roles & Permissions"),
    ("prompts", "Prompt Templates"),
    ("letters", "Letters"),
    ("knowledge", "Knowledge Base"),
    ("jobs", "Background Jobs"),
    ("webhooks", "Webhooks"),
    ("review", "Review & Audit"),
    ("projects", "Projects"),
    ("drafts", "Drafts"),
    ("files", "Files"),
    ("drafting_sessions", "Drafting Sessions"),
    ("notifications", "Notifications"),
    # MASTER / ADMIN sub-app screens
    ("departments", "Department Master"),
    ("locations", "Location Master"),
    ("designations", "Designation Master"),
    ("units", "Unit Master"),
    ("lookups", "Lookup Master"),
    ("ui_modules", "Module Master"),
    ("module_groups", "Module Group Master"),
    ("projects_master", "Project Master"),
    ("contractors", "Contractor Master"),
    ("contracts", "Contract Master"),
    ("activities", "Activity Master"),
    ("variation_orders", "Variation Order Master"),
    ("monthly_breakup", "Monthly Breakup Master"),
    ("auto_notifications", "Auto Notification Master"),
    ("reference_documents", "Reference Document Master"),
    ("user_roles", "User Role Master"),
    ("role_rights", "Role Right Master"),
    ("user_logs", "User Logs"),
    ("error_logs", "User Errors"),
    ("api_test", "API Test"),
]

PERMISSIONS = [
    *[("admin", m, True, True, True, True) for m, _ in MODULES],
    ("drafter", "letters", True, True, False, False),
    ("drafter", "knowledge", True, True, False, True),
    ("drafter", "drafts", True, True, True, False),
    ("drafter", "files", True, True, True, False),
    ("drafter", "drafting_sessions", True, True, True, False),
    ("drafter", "projects", True, False, False, False),
    ("drafter", "jobs", True, False, False, False),
    ("drafter", "notifications", True, False, False, False),
]


async def seed_rbac(conn: AsyncConnection) -> None:
    from sqlalchemy import text

    now = datetime.now(timezone.utc)

    roles = [
        ("admin", "Full system access"),
        ("drafter", "Creates letters, drafts, and knowledge base entries"),
    ]
    for name, desc in roles:
        await conn.execute(
            text(
                f'INSERT INTO "{SCHEMA}".roles (name, description, is_system, created_at) '
                "VALUES (:name, :desc, TRUE, :created_at) ON CONFLICT (name) DO NOTHING"
            ),
            {"name": name, "desc": desc, "created_at": now},
        )

    for key, label in MODULES:
        await conn.execute(
            text(
                f'INSERT INTO "{SCHEMA}".modules (key, label, created_at) '
                "VALUES (:key, :label, :created_at) ON CONFLICT (key) DO NOTHING"
            ),
            {"key": key, "label": label, "created_at": now},
        )

    for role, module, can_view, can_create, can_edit, can_delete in PERMISSIONS:
        await conn.execute(
            text(
                f'INSERT INTO "{SCHEMA}".role_permissions '
                "(id, role_name, module_key, can_view, can_create, can_edit, can_delete, created_at) "
                "VALUES (:id, :role, :module, :v, :c, :e, :d, :created_at) "
                "ON CONFLICT (role_name, module_key) DO NOTHING"
            ),
            {
                "id": uuid.uuid4(),
                "role": role,
                "module": module,
                "v": can_view,
                "c": can_create,
                "e": can_edit,
                "d": can_delete,
                "created_at": now,
            },
        )

    logger.info("db_seed.rbac_complete")
