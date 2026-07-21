"""
Idempotent RBAC seed — replaces the old Alembic migration f80533d1bf3e.

Called from init_db() after create_all so permissions always exist
even when Alembic is removed.
"""
import structlog
from sqlalchemy.ext.asyncio import AsyncConnection

logger = structlog.get_logger()

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

    roles = [
        ("admin", "Full system access"),
        ("drafter", "Creates letters, drafts, and knowledge base entries"),
    ]
    for name, desc in roles:
        await conn.execute(
            text(
                "INSERT INTO roles (name, description, is_system) "
                "VALUES (:name, :desc, TRUE) ON CONFLICT (name) DO NOTHING"
            ),
            {"name": name, "desc": desc},
        )

    for key, label in MODULES:
        await conn.execute(
            text(
                "INSERT INTO modules (key, label) "
                "VALUES (:key, :label) ON CONFLICT (key) DO NOTHING"
            ),
            {"key": key, "label": label},
        )

    for role, module, can_view, can_create, can_edit, can_delete in PERMISSIONS:
        await conn.execute(
            text(
                "INSERT INTO role_permissions "
                "(role_name, module_key, can_view, can_create, can_edit, can_delete) "
                "VALUES (:role, :module, :v, :c, :e, :d) "
                "ON CONFLICT (role_name, module_key) DO NOTHING"
            ),
            {
                "role": role,
                "module": module,
                "v": can_view,
                "c": can_create,
                "e": can_edit,
                "d": can_delete,
            },
        )

    logger.info("db_seed.rbac_complete")
