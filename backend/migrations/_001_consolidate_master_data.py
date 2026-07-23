"""
Migration 001: Consolidate master schema data into core tables.

Idempotent — safe to run multiple times.

What it does:
1. Copies master_project → projects.project_metadata (JSONB), matching on name.
2. Copies master_lookup → lookups.
3. Copies master_department → departments.
4. Copies master_location → locations.
5. Copies master_designation → designations.
6. Copies master_unit → units.
7. Reassigns any existing core users with role='reviewer' to role='admin'.
   ⚠️ REVIEW THIS: If your data has users who are 'reviewer' but should be
   'drafter' instead, adjust the WHERE clause below before running.
8. Deletes 'reviewer' rows from role_permissions.
9. Removes the 'reviewer' entry from the roles table.
"""

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = structlog.get_logger()


async def run(conn: AsyncConnection) -> None:
    logger.info("migration.001.starting")

    # ── Step 1: Copy master projects into core projects.project_metadata ──
    master_project_count = await _count_rows(conn, "master_project")
    logger.info("migration.001.master_project_count", count=master_project_count)

    if master_project_count > 0:
        result = await conn.execute(text("""
            INSERT INTO projects (id, name, project_metadata, created_at)
            SELECT
                gen_random_uuid(),
                COALESCE(mp.ProjectName, 'Migrated Project ' || mp.ProjectMasterId),
                jsonb_build_object(
                    'opportunity_code', mp.OpportunityCode,
                    'parent_project_master_id', mp.ParentProjectMasterId,
                    'file_name', mp."FileName",
                    'document_path', mp.DocumentPath,
                    'project_code', mp.ProjectCode,
                    'business_unit', mp.BusinessUnit,
                    'business_line', mp.BusinessLine,
                    'client_name', mp.ClientName,
                    'project_manager_id', mp.ProjectManagerId,
                    'project_director_id', mp.ProjectDirectorId,
                    'contract_value', mp.ContractValue,
                    'sensitivity', mp.Sensitivity::text,
                    'risk_contingency_amount', mp.RiskContingencyAmount::text,
                    'bid_status', mp.BidStatus,
                    'bid_status_date', (mp.BidStatusDate AT TIME ZONE 'UTC')::text,
                    'remarks', mp.Remarks,
                    'pmo_id', mp.PMOId,
                    'source_table', 'master_project',
                    'original_id', mp.ProjectMasterId
                ),
                COALESCE(mp.CreatedDate, NOW())
            FROM master_project mp
            WHERE NOT EXISTS (
                SELECT 1 FROM projects p WHERE p.name = mp.ProjectName
            )
        """))
        logger.info("migration.001.master_project_copied", rows=result.rowcount)

    # ── Step 2: Copy master_lookup → lookups ──
    lookup_count = await _count_rows(conn, "public.master_lookup")
    if lookup_count > 0:
        result = await conn.execute(text("""
            INSERT INTO "Master".lookups (id, lookup_type, lookup_code, lookup_name, description)
            SELECT
                ml.LookupId,
                ml.LookupType,
                ml.LookupCode,
                ml.LookupName,
                ml.Description
            FROM master_lookup ml
            WHERE NOT EXISTS (
                SELECT 1 FROM "Master".lookups l WHERE l.id = ml.LookupId
            )
        """))
        logger.info("migration.001.master_lookup_copied", rows=result.rowcount)

    # ── Step 3: Copy master_department → departments ──
    dept_count = await _count_rows(conn, "public.master_department")
    if dept_count > 0:
        result = await conn.execute(text("""
            INSERT INTO "Master".departments (id, code, name, parent_id, level, remarks)
            SELECT
                md.DepartmentId,
                md.DepartmentCode,
                md.DepartmentName,
                md.ParentDepartmentId,
                md.Level,
                md.Remarks
            FROM master_department md
            WHERE NOT EXISTS (
                SELECT 1 FROM "Master".departments d WHERE d.id = md.DepartmentId
            )
        """))
        logger.info("migration.001.master_department_copied", rows=result.rowcount)

    # ── Step 4: Copy master_location → locations ──
    loc_count = await _count_rows(conn, "public.master_location")
    if loc_count > 0:
        result = await conn.execute(text("""
            INSERT INTO "Master".locations (id, name, parent_id, level, remarks)
            SELECT
                ml.LocationId,
                ml.LocationName,
                ml.ParentLocationId,
                ml.Level,
                ml.Remarks
            FROM master_location ml
            WHERE NOT EXISTS (
                SELECT 1 FROM "Master".locations l WHERE l.id = ml.LocationId
            )
        """))
        logger.info("migration.001.master_location_copied", rows=result.rowcount)

    # ── Step 5: Copy master_designation → designations ──
    desig_count = await _count_rows(conn, "public.master_designation")
    if desig_count > 0:
        result = await conn.execute(text("""
            INSERT INTO "Master".designations (id, code, name, parent_id, level, remarks)
            SELECT
                md.DesignationId,
                md.DesignationCode,
                md.DesignationName,
                md.ParentDesignationId,
                md.Level,
                md.Remarks
            FROM master_designation md
            WHERE NOT EXISTS (
                SELECT 1 FROM "Master".designations d WHERE d.id = md.DesignationId
            )
        """))
        logger.info("migration.001.master_designation_copied", rows=result.rowcount)

    # ── Step 6: Copy master_unit → units ──
    unit_count = await _count_rows(conn, "public.master_unit")
    if unit_count > 0:
        result = await conn.execute(text("""
            INSERT INTO "Master".units (id, code, name, parent_id, level, remarks)
            SELECT
                mu.UnitId,
                mu.UnitCode,
                mu.UnitName,
                mu.ParentUnitId,
                mu.Level,
                mu.Remarks
            FROM master_unit mu
            WHERE NOT EXISTS (
                SELECT 1 FROM "Master".units u WHERE u.id = mu.UnitId
            )
        """))
        logger.info("migration.001.master_unit_copied", rows=result.rowcount)

    # ── Step 7: Reassign reviewer users to admin ──
    reviewer_users = await conn.execute(
        text('SELECT COUNT(*) FROM "Master".users WHERE role = \'reviewer\'')
    )
    reviewer_count = reviewer_users.scalar() or 0
    logger.info("migration.001.reviewer_users_found", count=reviewer_count)

    if reviewer_count > 0:
        # ⚠️ TODO: Review this reassignment carefully. If some users with
        # role='reviewer' should become 'drafter' instead of 'admin', add
        # a more specific WHERE clause (e.g., check a custom field or
        # another condition). For now, ALL reviewer users go to admin.
        await conn.execute(
            text('UPDATE "Master".users SET role = \'admin\' WHERE role = \'reviewer\'')
        )
        logger.info("migration.001.reviewer_users_reassigned_to_admin", count=reviewer_count)

    # ── Step 8: Remove reviewer permissions ──
    reviewer_perms = await conn.execute(
        text('SELECT COUNT(*) FROM "Master".role_permissions WHERE role_name = \'reviewer\'')
    )
    perm_count = reviewer_perms.scalar() or 0
    if perm_count > 0:
        await conn.execute(
            text('DELETE FROM "Master".role_permissions WHERE role_name = \'reviewer\'')
        )
        logger.info("migration.001.reviewer_permissions_deleted", count=perm_count)

    # ── Step 9: Remove reviewer role ──
    await conn.execute(
        text('DELETE FROM "Master".roles WHERE name = \'reviewer\'')
    )
    logger.info("migration.001.reviewer_role_removed")

    # ── Step 10: Add new columns to users table (safe, idempotent) ──
    for col_spec in [
        "ADD COLUMN IF NOT EXISTS azure_oid VARCHAR(255) UNIQUE",
        "ADD COLUMN IF NOT EXISTS azure_tenant_id VARCHAR(255)",
        ("ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) "
         "NOT NULL DEFAULT 'password'"),
        "ALTER COLUMN hashed_password DROP NOT NULL",
    ]:
        try:
            await conn.execute(text(f'ALTER TABLE "Master".users {col_spec}'))
        except Exception as e:
            logger.warning("migration.001.alter_users_skipped", column=col_spec, error=str(e))

    # ── Step 11: Add project_metadata column to projects ──
    try:
        await conn.execute(text(
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_metadata JSONB"
        ))
    except Exception as e:
        logger.warning("migration.001.alter_projects_skipped", error=str(e))

    logger.info("migration.001.complete")


async def _count_rows(conn: AsyncConnection, table: str) -> int:
    result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
    return result.scalar() or 0
