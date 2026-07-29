# CCM Database — Reconciliation Report (Phase 1)

> **Audit date:** July 25, 2026
> **Database:** PostgreSQL `ccm_db` (localhost:5432)
> **Method:** Direct SQL queries via asyncpg against live database
> **Auditor:** Automated audit script + manual code inspection

---

## Executive Summary

The actual database state **significantly differs** from what `TABLE_ANALYSIS.md`, `CCM_ARCHITECTURE.md`, and the original prompt claimed. The database is in much better shape than documented — several "problems" flagged in documentation do not exist. However, real issues remain.

### Key Discrepancies (Dump Wins)

| Claim in Documentation | Actual State | Severity |
|------------------------|-------------|----------|
| Duplicate `public.*` copies of `Master.*` tables exist | **FALSE** — `public.users`, `public.roles`, `public.modules`, `public.role_permissions`, `public.departments`, `public.designations`, `public.locations`, `public.units`, `public.lookups`, `public.master_records` **DO NOT EXIST** | Low (docs were wrong) |
| `public.master_records` has different row count from `Master.master_records` | **FALSE** — `public.master_records` does not exist at all | Low (docs were wrong) |
| RBAC data duplicated in EAV (`Roles`, `Module`, `UserRole`, `RoleRight` entities) | **FALSE** — EAV contains zero RBAC rows. Only 5 entity types exist: `contractor` (1), `project_master` (2), `role` (3), `user` (2), `user_log` (6) | Low (cleaner than expected) |
| EAV entity names are PascalCase | **FALSE** — All 5 entity types are lowercase (`contractor`, `project_master`, `role`, `user`, `user_log`) | Low (docs were wrong) |
| `public.designations` has rows `Master.designations` doesn't | **FALSE** — `public.designations` doesn't exist; only `Master.designations` exists with 2 rows | Low |
| Alembic not installed | **FALSE** — `alembic==1.18.5` is installed | Medium |
| "No working migration framework" | **PARTIALLY TRUE** — Alembic is installed but has no `alembic.ini`, no `env.py`, no proper Alembic directory structure. Migrations are ad-hoc Python scripts run from `init_db()` | High |
| EAV JSONB `data` column stores proper JSON | **MISLEADING** — Column type is JSONB, but data is stored as JSON-encoded strings (`data_type=str`), requiring double-parsing | Medium |
| 18 different entity types in EAV | **FALSE** — Only 5 entity types with 14 total rows | Low |
| `document_chunks.embedding` is `vector` type | **FALSE** — It's `double precision[]` (ARRAY). pgvector is NOT installed | Confirmed (expected) |

---

## 1. Complete Table Inventory (41 tables)

### Master Schema (10 tables)

| Table | Rows | Status |
|-------|------|--------|
| `Master.users` | 4 | Active — primary auth |
| `Master.roles` | 2 | Active — seeded (admin, drafter) |
| `Master.modules` | 33 | Active — seeded |
| `Master.role_permissions` | 41 | Active — RBAC matrix |
| `Master.departments` | 4 | Active |
| `Master.designations` | 2 | Active |
| `Master.locations` | 0 | Active (empty) |
| `Master.units` | 0 | Active (empty) |
| `Master.lookups` | 0 | Active (empty) |
| `Master.master_records` | 14 | Active — EAV table |

### Public Schema — CCM Core (17 tables)

| Table | Rows | Status |
|-------|------|--------|
| `public.projects` | 0 | Active |
| `public.inbound_letters` | 0 | Active |
| `public.draft_responses` | 0 | Active |
| `public.knowledge_documents` | 0 | Active |
| `public.document_chunks` | 0 | Active |
| `public.drafting_sessions` | 0 | Active |
| `public.drafting_messages` | 0 | Active |
| `public.prompt_templates` | 0 | Active |
| `public.jobs` | 0 | Active |
| `public.audit_logs` | 0 | Active |
| `public.files` | 0 | Active |
| `public.email_notification_settings` | 0 | Active |
| `public.revoked_tokens` | 0 | Active |
| `public.password_reset_tokens` | 0 | Active |
| `public.webhooks` | 0 | Active |
| `public.webhook_deliveries` | 0 | Active |
| `public.sharepoint_sync_log` | 0 | Active |

### Public Schema — Legacy (13 tables, ALL EMPTY)

| Table | Rows | Action |
|-------|------|--------|
| `public.master_department` | 0 | Drop (migration 002) |
| `public.master_designation` | 0 | Drop (migration 002) |
| `public.master_location` | 0 | Drop (migration 002) |
| `public.master_unit` | 0 | Drop (migration 002) |
| `public.master_lookup` | 0 | Drop (migration 002) |
| `public.master_module` | 0 | Drop (migration 002) |
| `public.master_module_group` | 0 | Drop (migration 002) |
| `public.master_project` | 0 | Drop (migration 002) |
| `public.master_project_details` | 0 | Drop (migration 002) |
| `public.master_role` | 0 | Drop (migration 002) |
| `public.master_role_right` | 0 | Drop (migration 002) |
| `public.master_unit` | 0 | Drop (migration 002) |
| `public.master_user` | 0 | Drop (migration 002) |
| `public.master_user_role` | 0 | Drop (migration 002) |

### System Table

| Table | Rows | Status |
|-------|------|--------|
| `public.alembic_version` | 2 | System — 2 version heads |

---

## 2. EAV `Master.master_records` — Full Content

14 rows, 5 entity types, stored as **JSON-encoded strings** (not native JSONB objects):

| ID | Entity | Status | JSON Keys |
|----|--------|--------|-----------|
| 1 | `contractor` | 9 (deleted) | Remarks, ContractorCode, ContractorName |
| 2 | `user_log` | 1 | UserId, LockedBy, CreatedBy, IPAddress, LoginDate, UserLogId, LockedDate, LogOutDate, MACAddress, SecurityId, TokenValue, CreatedDate, LogInStatus |
| 3 | `project_master` | 1 | PMOID, Status, Remarks, LockedBy, CreatedBy, ClientName, LockedDate, SecurityId, CreatedDate, ProjectCode, ProjectName, BusinessLine, BusinessUnit, ProjectManagerId, ProjectDirectorId |
| 4 | `user` | 1 | Id, Status, EmailId, MobileNo, UserName, UserType, CreatedBy, AdUserName, EmployeeNo, SecurityId, CreatedDate, DepartmentId, EmployeeName, DesignationId, ModuleGroupId, LastUpdatedDate |
| 5 | `user` | 1 | (same keys as #4) |
| 6 | `user_log` | 1 | (same keys as #2) |
| 7 | `user_log` | 1 | (same keys as #2) |
| 8 | `role` | 9 (deleted) | Level, Status, Remarks, LockedBy, RoleCode, RoleName, CreatedBy, LockedDate, SecurityId, CreatedDate, ParentRoleId |
| 9 | `role` | 1 | (same keys as #8) |
| 10 | `project_master` | 1 | (same keys as #3) |
| 11 | `role` | 1 | (same keys as #8) |
| 12 | `user_log` | 1 | (same keys as #2) |
| 13 | `user_log` | 1 | (same keys as #2) |
| 14 | `user_log` | 1 | (same keys as #2) |

**EAV vs Canonical reconciliation:**
- `Roles`/`role` entity: 3 EAV rows (2 active, 1 deleted) — these are **legacy** roles from old system, NOT the same as `Master.roles` (admin/drafter). No overlap.
- `User`/`user` entity: 2 EAV rows — **legacy** user directory entries, different from `Master.users` (4 rows). No overlap.
- `Module`/`ModuleGroup` entities: **Zero EAV rows** — all module data is in canonical `Master.modules` table.
- `UserRole`/`RoleRight` entities: **Zero EAV rows** — all RBAC data is in canonical `Master.role_permissions`.

**Conclusion:** The EAV table is NOT a dual-write problem. It holds legacy data that has no overlap with canonical tables.

---

## 3. Foreign Key Constraints (19 total)

| Constraint | From | → To | On Delete |
|-----------|------|------|-----------|
| `users_role_fkey` | `Master.users.role` | `Master.roles.name` | NO ACTION |
| `role_permissions_role_name_fkey` | `Master.role_permissions.role_name` | `Master.roles.name` | CASCADE |
| `role_permissions_module_key_fkey` | `Master.role_permissions.module_key` | `Master.modules.key` | CASCADE |
| `audit_logs_user_id_fkey` | `public.audit_logs.user_id` | `Master.users.id` | SET NULL |
| `document_chunks_document_id_fkey` | `public.document_chunks.document_id` | `public.knowledge_documents.id` | CASCADE |
| `draft_responses_letter_id_fkey` | `public.draft_responses.letter_id` | `public.inbound_letters.id` | CASCADE |
| `draft_responses_project_id_fkey` | `public.draft_responses.project_id` | `public.projects.id` | SET NULL |
| `drafting_messages_session_id_fkey` | `public.drafting_messages.session_id` | `public.drafting_sessions.id` | CASCADE |
| `drafting_sessions_letter_id_fkey` | `public.drafting_sessions.letter_id` | `public.inbound_letters.id` | SET NULL |
| `drafting_sessions_project_id_fkey` | `public.drafting_sessions.project_id` | `public.projects.id` | SET NULL |
| `email_notification_settings_user_id_fkey` | `public.email_notification_settings.user_id` | `Master.users.id` | CASCADE |
| `files_uploaded_by_fkey` | `public.files.uploaded_by` | `Master.users.id` | SET NULL |
| `inbound_letters_project_id_fkey` | `public.inbound_letters.project_id` | `public.projects.id` | SET NULL |
| `jobs_created_by_fkey` | `public.jobs.created_by` | `Master.users.id` | SET NULL |
| `knowledge_documents_project_id_fkey` | `public.knowledge_documents.project_id` | `public.projects.id` | SET NULL |
| `password_reset_tokens_user_id_fkey` | `public.password_reset_tokens.user_id` | `Master.users.id` | CASCADE |
| `sharepoint_sync_log_project_id_fkey` | `public.sharepoint_sync_log.project_id` | `public.projects.id` | CASCADE |
| `webhook_deliveries_webhook_id_fkey` | `public.webhook_deliveries.webhook_id` | `public.webhooks.id` | CASCADE |
| `webhooks_created_by_fkey` | `public.webhooks.created_by` | `Master.users.id` | SET NULL |

---

## 4. Soft FK Columns (NO constraint)

| Table | Column | Notes |
|-------|--------|-------|
| `public.inbound_letters` | `created_by` | UUID, references users |
| `public.draft_responses` | `edited_by` | UUID, references users |
| `public.knowledge_documents` | `uploaded_by` | UUID, references users |
| `public.drafting_messages` | `draft_response_id` | UUID, references draft_responses |
| `public.drafting_sessions` | `created_by` | UUID, references users |

---

## 5. Existing Indexes (7 non-PK indexes)

| Schema | Table | Index | Columns |
|--------|-------|-------|---------|
| `Master` | `master_records` | `ix_master_records_entity` | `entity` |
| `public` | `drafting_messages` | `ix_drafting_messages_session_id` | `session_id` |
| `public` | `drafting_sessions` | `ix_drafting_sessions_created_by` | `created_by` |
| `public` | `drafting_sessions` | `ix_drafting_sessions_letter_id` | `letter_id` |
| `public` | `password_reset_tokens` | `ix_password_reset_tokens_token_hash` | `token_hash` |
| `public` | `password_reset_tokens` | `ix_password_reset_tokens_user_id` | `user_id` |
| `public` | `revoked_tokens` | `ix_revoked_tokens_expires_at` | `expires_at` |

**Unique constraints (6):**

| Table | Columns |
|-------|---------|
| `Master.role_permissions` | `role_name`, `module_key` |
| `Master.role_permissions` | `module_key`, `role_name` (duplicate!) |
| `Master.users` | `azure_oid` |
| `Master.users` | `email` |
| `public.files` | `storage_key` |
| `public.revoked_tokens` | `jti` |

Note: `Master.role_permissions` has a **duplicate unique constraint** — both `(role_name, module_key)` and `(module_key, role_name)` exist. One should be dropped.

---

## 6. Missing Indexes (13 FK columns + 21 filter columns)

### FK Columns Without Indexes (13)

| Table | Column | Target Table |
|-------|--------|-------------|
| `public.document_chunks` | `document_id` | `knowledge_documents.id` |
| `public.draft_responses` | `letter_id` | `inbound_letters.id` |
| `public.draft_responses` | `project_id` | `projects.id` |
| `public.inbound_letters` | `project_id` | `projects.id` |
| `public.knowledge_documents` | `project_id` | `projects.id` |
| `public.drafting_sessions` | `project_id` | `projects.id` |
| `public.audit_logs` | `user_id` | `Master.users.id` |
| `public.files` | `uploaded_by` | `Master.users.id` |
| `public.jobs` | `created_by` | `Master.users.id` |
| `public.webhooks` | `created_by` | `Master.users.id` |
| `public.webhook_deliveries` | `webhook_id` | `webhooks.id` |
| `public.sharepoint_sync_log` | `project_id` | `projects.id` |
| `Master.users` | `role` | `Master.roles.name` |

### Filter Columns Without Indexes (21)

| Table | Column | Type |
|-------|--------|------|
| `Master.departments` | `status` | VARCHAR(10) |
| `Master.designations` | `status` | VARCHAR(10) |
| `Master.locations` | `status` | VARCHAR(10) |
| `Master.lookups` | `status` | VARCHAR(10) |
| `Master.lookups` | `lookup_type` | VARCHAR(100) |
| `Master.master_records` | `status` | VARCHAR(10) |
| `Master.units` | `status` | VARCHAR(10) |
| `public.audit_logs` | `entity_type` | VARCHAR(100) |
| `public.draft_responses` | `status` | VARCHAR(50) |
| `public.drafting_messages` | `role` | VARCHAR(20) |
| `public.files` | `content_type` | VARCHAR(100) |
| `public.inbound_letters` | `category` | VARCHAR(100) |
| `public.inbound_letters` | `status` | VARCHAR(50) |
| `public.jobs` | `status` | VARCHAR(20) |
| `public.jobs` | `job_type` | VARCHAR(100) |
| `public.knowledge_documents` | `category` | VARCHAR(100) |
| `public.knowledge_documents` | `status` | VARCHAR(50) |
| `public.knowledge_documents` | `file_type` | VARCHAR(50) |
| `public.projects` | `status` | VARCHAR(50) |
| `public.sharepoint_sync_log` | `sync_status` | VARCHAR(50) |
| `Master.users` | `role` | VARCHAR(20) |

**Recommended partial index for `jobs`:**
```sql
CREATE INDEX idx_jobs_active ON public.jobs (created_at) WHERE status IN ('queued', 'running');
```

---

## 7. Alembic State

**Installed:** `alembic==1.18.5`

**Version table:** 2 heads in `alembic_version`:
- `3b7f9c2d4e5a`
- `f80533d1bf3e`

**Problem:** No `alembic.ini`, no `env.py`, no proper Alembic directory. Migrations are ad-hoc Python scripts:
- `_001_consolidate_master_data.py` — copies legacy data
- `_002_drop_master_tables.py` — drops legacy tables (NOT YET RUN)
- `_003_move_master_to_schema.py` — moves tables to Master schema (run via `init_db()`)

`init_db()` runs schema mutations directly:
1. `Base.metadata.create_all` — creates ORM tables
2. `seed_rbac()` — inserts roles/modules/permissions
3. `ALTER TABLE knowledge_documents ADD COLUMN storage_path` — if missing
4. `ALTER TABLE "Master".{dept,loc,desig,unit,lookup} ADD COLUMN status` — idempotent
5. Runs `_001_consolidate_master_data.py` if `master_project` table exists

---

## 8. Hierarchical Tables — parent_id Analysis

| Table | parent_id Default | NULL Count | =0 Count | Total | has is_active |
|-------|-------------------|------------|----------|-------|---------------|
| `Master.departments` | NULL (no DB default) | 0 | 4 | 4 | No |
| `Master.designations` | NULL (no DB default) | 0 | 2 | 2 | No |
| `Master.locations` | NULL (no DB default) | 0 | 0 | 0 | No |
| `Master.units` | NULL (no DB default) | 0 | 0 | 0 | No |

**Finding:** The DB has no default for `parent_id` (it's NULL-default at DB level), but all existing rows have `parent_id=0`. The ORM model sets `default=0` in Python, which is where the `0` values come from. The DB column itself is nullable with no default.

---

## 9. Extensions

Only default extensions: `plpgsql`, `pgcrypto`. **pgvector NOT installed.**

---

## 10. CHECK Constraints (meaningful ones)

| Table | Constraint | Definition |
|-------|-----------|------------|
| `Master.users` | `valid_role` | `role IN ('admin', 'drafter', 'reviewer')` |
| `public.jobs` | `valid_job_status` | `status IN ('queued','running','completed','failed','cancelled')` |

---

## 11. Document Chunks — Embedding Verification

- **Column type:** `double precision[]` (PostgreSQL ARRAY)
- **NOT pgvector** `vector(N)` type
- **pgvector extension:** NOT installed
- **Embedding model:** `text-embedding-3-small` (1536 dimensions) — confirmed in `backend/services/openai_client.py:18`
- **Current query method:** In-Python cosine similarity loop (`knowledge_base.py:248-291`)
- **Search already joins** through `knowledge_documents` for project/category scoping

---

## 12. Discrepancies vs TABLE_ANALYSIS.md

| Item | TABLE_ANALYSIS.md Says | Actual |
|------|----------------------|--------|
| EAV entities | Lists `Roles`, `Module`, `ModuleGroup`, `User`, `UserRole`, `RoleRight`, `Contractor`, `Contract`, `Activity`, etc. (18 types) | Only 5 types: `contractor`, `project_master`, `role`, `user`, `user_log` |
| Public duplicate tables | Lists `public.users`, `public.roles`, etc. as existing | Do NOT exist |
| `public.master_records` | Listed as existing | Does NOT exist |
| Entity naming | PascalCase (`Roles`, `Module`, etc.) | All lowercase (`role`, `user`, etc.) |
| `parent_id` default | Says "defaulting to 0" | DB has no default; Python ORM defaults to 0 |
| `Master.users` CHECK | Not documented | `valid_role`: role IN ('admin','drafter','reviewer') |

---

## 13. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| No proper Alembic setup (no env.py, no alembic.ini) | **HIGH** | Phase 0: Install and configure Alembic properly |
| 13 FK columns without indexes | **MEDIUM** | Phase 3: Add missing indexes |
| 5 soft FK columns without constraints | **MEDIUM** | Phase 3: Add FK constraints |
| 13 legacy empty tables to drop | **LOW** | Phase 2: Drop after verification |
| EAV data stored as JSON strings, not native JSONB | **LOW** | Phase 4: Address when extracting EAV entities |
| Duplicate unique constraint on `role_permissions` | **LOW** | Phase 3: Drop redundant constraint |
| `init_db()` runs schema mutations at startup | **MEDIUM** | Phase 0: Move to Alembic |
| 2 Alembic version heads | **LOW** | Phase 0: Resolve during Alembic setup |
| No pgvector | **EXPECTED** | Phase 5: Install and migrate |
| EAV entity types are fewer than expected — Phase 4 extraction is simpler | **POSITIVE** | Only need to extract `contractor`, `project_master` (5 entities total) |

---

## 14. Revised Phase Plan (based on actual findings)

### Phase 0 — Alembic Setup
- Create proper `alembic.ini` + `alembic/env.py`
- Baseline current schema as revision 1
- Remove schema-mutation logic from `init_db()` (keep data seeding)
- Resolve 2-version head

### Phase 1 — This Report (DONE)
- Full reconciliation audit completed
- No duplicate tables to merge (they don't exist)
- EAV vs canonical: no overlap, no merge needed

### Phase 2 — Legacy Cleanup
- Drop 13 empty `public.master_*` tables
- Drop duplicate unique constraint on `role_permissions`
- No data merge needed (EAV has no overlapping data with canonical tables)

### Phase 3 — Structural Fixes
- Add 13 missing FK indexes
- Add 21 missing filter indexes
- Add 5 FK constraints on soft-reference columns
- Add self-referencing FK on hierarchical `parent_id` columns (NULL default, not 0)
- Add `is_active BOOLEAN` columns to hierarchical tables
- Add partial index on `jobs.status` for active jobs

### Phase 4 — EAV Extraction
- Create normalized tables for `contractor`, `project_master` (and sub-types)
- NOTE: EAV is much simpler than expected — only 5 entity types, 14 rows total
- Many entities from original plan (`Contract`, `Activity`, `VariationOrder`, etc.) DON'T EXIST in EAV

### Phase 5 — pgvector
- Install pgvector extension
- Convert `document_chunks.embedding` from `double precision[]` to `vector(1536)`
- Add HNSW index
- Rewrite `search_similar_chunks()` to use SQL-side vector search

### Phase 6 — RBAC Cleanup
- Legacy `/common/*` RBAC endpoints already write to canonical tables (verified: zero EAV RBAC rows)
- Verify no code path still writes to EAV for RBAC
- Add remaining EAV entity types to CHECK constraint

### Phase 7 — audit_logs Partitioning
- Convert to PARTITION BY RANGE (created_at)
- Add automated partition creation mechanism
- Add DEFAULT partition as catch-all
