# CCM Architecture — Complete Analysis

> **Updated 2026-09-15.** The original analysis (2026-07-28) predates the "Phase 4" and "Phase 8" migrations
> (`backend/alembic/versions/510deff1ada4_...` through `f0a1b2c3d4e5_phase4j_deprecate_master_records.py`,
> and `8744280b2d28_phase8_remove_financial_and_project_structure_tables.py`, run 2026-07-29/30). Those
> migrations (a) extracted almost every Master/Admin entity out of the EAV `master_records` table into
> dedicated tables, and (b) **dropped** the commercial/PMO tables entirely (`activities`, `activity_groups`,
> `work_packages`, `variation_orders`, `monthly_breakups`, `estimation_months`, `reference_documents`).
> Sections 2, 3 (Flow 4), 4, 5, 7.14–7.15, and 15 below have been revised accordingly; everything about the
> CCM Core (letters/drafts/knowledge base/drafting sessions/jobs/webhooks) was re-verified and is unchanged.

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│   Port 5000  |  Base path: /master/  |  Proxies /api → :8001   │
│   MUI v9 + framer-motion + chart.js + recharts                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP (JSON) + WebSocket
┌──────────────────────▼──────────────────────────────────────────┐
│                    BACKEND (FastAPI + uvicorn)                   │
│   Port 8001 (local dev, per vite.config.js) / 8000 (Docker)    │
│   ~145 endpoints  |  async SQLAlchemy + asyncpg                │
│   Two parallel sub-apps: CCM Core + Master/Admin                 │
└───────┬──────────┬──────────┬──────────┬───────────────────────┘
        │          │          │          │
   ┌────▼───┐ ┌───▼────┐ ┌──▼───┐ ┌───▼────┐
   │PostgreSQL│ │OpenAI │ │Redis │ │Storage │
   │ :5432   │ │  API  │ │(opt) │ │(local/ │
   │ :5433   │ │       │ │      │ │  S3)   │
   │ pgvector│ │       │ │      │ │        │
   └─────────┘ └───────┘ └──────┘ └────────┘
```

---

## 2. Two Parallel Sub-Applications

The backend runs **two independent but overlapping systems** in a single FastAPI app:

### A. CCM Core (`/api/*`)

The AI-powered construction correspondence management system. Uses dedicated normalized ORM tables. This is the "product."

### B. Master/Admin (`/common/*`)

An admin CRUD sub-app, originally ported from a vanilla JS application and originally backed by an EAV
`master_records` table. **That EAV table has since been fully extracted and deprecated** (migrations
`phase4` → `phase4j`, 2026-07-29): every Master/Admin entity now lives in its own dedicated table in the
`Master` schema (`contractors`, `contracts`, `common_roles`, `role_rights`, `ui_modules`, `module_groups`,
`project_master`, `project_details`, `user_directory`, `user_roles`, `user_access_filters`, `user_logs`,
`error_logs`, `auto_notifications`, `approver_roles`, plus the pre-existing `departments`, `designations`,
`locations`, `units`, `lookups`). There is no `master_records` model or table left in the codebase.

Separately, `phase8` (2026-07-30) **dropped** the PMO/commercial-tracking part of this sub-app entirely —
`activities`, `activity_groups`, `work_packages`, `variation_orders`, `monthly_breakups`,
`estimation_months`, and `reference_documents` no longer exist as tables, models, API routers, or routes.
Only their `.pyc` cache files remain under `backend/api/master/__pycache__/`. If the frontend still links to
these, those links are dead.

**They share one critical link:** the `Master.users` table (authentication). Both systems validate JWT tokens from the same user pool. Note `Master.users` (auth) is distinct from `Master.user_directory` (admin-panel user list) — see the "Important Distinctions" note in `MASTER_API_ROUTE_TO_TABLE_MAP.md`.

---

## 3. Complete Data Flow: End-to-End

### Flow 1: Letter Upload → AI Classification → Draft Generation → Review

```
USER clicks "Upload Letter" on frontend
  │
  ├─► POST /api/letters/upload  (letters.py)
  │     ├─► file_validator.validate_file()      → mime check, size check
  │     ├─► storage_backend.upload()            → saves file to /tmp/ccm-files/ or S3
  │     ├─► letter_intake.intake_letter()       → INSERT INTO inbound_letters
  │     │     (stores raw_text, filename, status="new")
  │     └─► job_queue.enqueue_job()             → INSERT INTO jobs (type="classify_letter")
  │           ├─► If Redis: ARQ queue → worker.py classifies in background
  │           └─► If no Redis: runs inline in same process
  │
  ├─► classify_letter_task (worker.py)
  │     ├─► openai_client.call_openai_async()   → GPT-4o classifies:
  │     │     category, intent, urgency, confidence, key_entities
  │     ├─► UPDATE inbound_letters SET category, urgency, status="classified"
  │     └─► webhook_service.dispatch("letter.uploaded")
  │
  ├─► User clicks "Generate Draft" on frontend
  │
  ├─► POST /api/drafts/generate/{letter_id}  (drafts.py)
  │     ├─► job_queue.enqueue_job()             → INSERT INTO jobs (type="generate_draft")
  │     └─► Returns 202 + job_id
  │
  ├─► generate_draft_task (worker.py)
  │     ├─► SELECT FROM inbound_letters WHERE id = letter_id
  │     ├─► knowledge_base.search_similar_chunks()
  │     │     ├─► SELECT FROM document_chunks (embedding cosine similarity)
  │     │     └─► Returns top-K relevant context chunks
  │     ├─► openai_client.call_openai_async()   → GPT-4o drafts with RAG context
  │     ├─► INSERT INTO draft_responses (draft_text, version=1, status="pending_review")
  │     ├─► UPDATE inbound_letters SET status="drafted"
  │     ├─► drafting_sessions.add_message()     → INSERT INTO drafting_messages
  │     └─► webhook_service.dispatch("draft.generated")
  │
  ├─► User clicks "Approve" on frontend
  │
  └─► POST /api/review/{draft_id}/approve  (review.py)
        ├─► UPDATE draft_responses SET status="approved"
        ├─► UPDATE inbound_letters SET status="approved"
        ├─► INSERT INTO audit_logs (action="approved", entity_type="draft", ...)
        ├─► knowledge_base.ingest_document()   → approved draft feeds BACK into KB
        │     (INSERT INTO knowledge_documents + document_chunks)
        └─► webhook_service.dispatch("draft.approved")
```

**Tables touched:** `inbound_letters` → `jobs` → `document_chunks` (read) → `draft_responses` → `drafting_messages` → `audit_logs` → `knowledge_documents` + `document_chunks` (write back)

---

### Flow 2: Knowledge Base Upload → Indexing → Semantic Search

```
USER uploads a document to KB
  │
  ├─► POST /api/knowledge/upload  (knowledge.py)
  │     ├─► validate_file() + storage_backend.upload()
  │     ├─► kb_service.init_document()          → INSERT INTO knowledge_documents
  │     └─► enqueue_job(type="index_kb_document")
  │
  ├─► index_kb_document_task (worker.py)
  │     ├─► storage_backend.download()          → gets raw file bytes
  │     ├─► extract_text_from_bytes()           → PDF/DOCX/image → raw_text
  │     ├─► chunk_text(raw_text, 500, 50)       → splits into overlapping chunks
  │     ├─► generate_embeddings(chunks)          → OpenAI text-embedding-3-small
  │     ├─► INSERT INTO document_chunks (chunk_text, embedding, chunk_index)
  │     └─► UPDATE knowledge_documents SET chunk_count, status="ready"
  │
  └─► Later, during draft generation:
        search_similar_chunks(query_embedding, project_id)
          ├─► SELECT all chunks for project
          ├─► In-Python cosine similarity (NOT pgvector)
          └─► Returns top matches with similarity scores
```

**Tables touched:** `knowledge_documents` → `document_chunks`

---

### Flow 3: AI Drafting Session (ChatGPT-style)

```
USER starts a new drafting session
  │
  ├─► POST /api/drafting-sessions  (drafting_sessions.py)
  │     └─► INSERT INTO drafting_sessions (title, letter_id, project_id, created_by)
  │
  ├─► User sends a message (with Project Letter Type prefix)
  │
  ├─► POST /api/drafting-sessions/{id}/messages  → INSERT INTO drafting_messages
  │
  └─► POST /api/drafts/generate/{letter_id}
        (same Flow 1 generation pipeline, but session messages are appended)
```

**Tables touched:** `drafting_sessions` → `drafting_messages` → (Flow 1 tables)

---

### Flow 4: Master/Admin CRUD (dedicated per-entity tables)

```
USER opens "Department Master" panel
  │
  ├─► GET /common/getDepartments
  │     └─► SELECT * FROM "Master".departments  → dedicated ORM model
  │
  ├─► User saves a department
  │
  └─► POST /common/saveDepartmentDetails
        └─► upsert_model(Department, body)       → INSERT/UPDATE "Master".departments

---

USER opens "Contractor Master" panel
  │
  ├─► GET /common/getContractors
  │     └─► SELECT * FROM "Master".contractors   → dedicated `Contractor` ORM model
  │
  ├─► User saves a contractor
  │
  └─► POST /common/saveContractorDetails
        └─► upsert_model(Contractor, body)        → INSERT/UPDATE "Master".contractors (soft delete via status)
```

**Key insight:** Every Master/Admin entity now uses a dedicated table (departments, designations, locations,
units, lookups, contractors, contracts, common_roles, role_rights, ui_modules, module_groups,
project_master, project_details, user_directory, user_roles, user_access_filters, user_logs, error_logs,
auto_notifications, approver_roles). The EAV `master_records` catch-all table has been fully extracted away
and no longer exists.

---

## 4. Complete Table Map

### Master Schema (24 tables) — "Who has access" + admin-panel master data

| Table | Purpose | Populated By |
|-------|---------|-------------|
| `Master.users` | Auth user accounts (email, password, role, Azure OID) | Auth API, Azure SSO JIT-provisioning |
| `Master.roles` | Auth RBAC role definitions (admin, drafter) | `db_seed.py` |
| `Master.modules` | Auth permission module keys | `db_seed.py` |
| `Master.role_permissions` | Auth role→module permission matrix | `db_seed.py` |
| `Master.departments` | Organizational departments (hierarchical) | `/common/saveDepartmentDetails` |
| `Master.designations` | Job designations (hierarchical) | `/common/saveDesignationDetails` |
| `Master.locations` | Project locations (hierarchical) | `/common/saveLocationDetails` |
| `Master.units` | Measurement units | `/common/saveUnitDetails` |
| `Master.lookups` | Generic lookup/reference data | `/common/saveLookupDetails` |
| `Master.contractors` | Contractor master | `/common/saveContractorDetails` |
| `Master.contracts` | Contract master | `/common/saveContractDetails` |
| `Master.common_roles` | Admin-panel role master (distinct from `Master.roles`) | `/common/saveRoles` |
| `Master.role_rights` | Admin-panel role rights | `/common/saveRoleRightDetails` |
| `Master.ui_modules` | Admin-editable UI menu modules (distinct from `Master.modules`) | `/common/saveModuleDetails` |
| `Master.module_groups` | UI menu module groups | `/common/saveModuleGroupDetails` |
| `Master.project_master` | Admin/master project list (distinct from `public.projects`) | `/common/saveProjectDetails` |
| `Master.project_details` | PMO/project detail rows | `/common/saveProjectDetailsData` |
| `Master.user_directory` | Admin-panel user directory (distinct from `Master.users`) | `/common/saveUserDetails` |
| `Master.user_roles` | User→role assignments | `/common/saveUserRoles` |
| `Master.user_access_filters` | Per-user business unit/line/project access filters | `/common/saveUserRoles` |
| `Master.user_logs` | Admin/session user activity logs | `/common/saveUserLogDetails` |
| `Master.error_logs` | Application error logs | logged internally |
| `Master.auto_notifications` | Auto-notification rule master | `/common/saveAutoNotificationDetails` |
| `Master.approver_roles` | Approver role list | (list-only currently) |

**Dropped (2026-07-30, `phase8` migration) — no longer exist:** `Master.master_records` (EAV catch-all),
`Master.estimation_months`, `Master.monthly_breakups`, `Master.variation_orders`, `Master.activities`,
`Master.activity_groups`, `Master.work_packages`, `Master.reference_documents`.

### Public Schema (31 tables) — "What the system does"

| Table | Purpose | Populated By |
|-------|---------|-------------|
| `projects` | CCM projects | Migration 001 + `/api/projects` |
| `inbound_letters` | Uploaded client letters | `letter_intake.py` |
| `draft_responses` | AI-generated draft letters | `drafting.py` |
| `knowledge_documents` | KB document metadata | `knowledge_base.py` |
| `document_chunks` | Text chunks + embeddings for RAG | `knowledge_base.py` |
| `drafting_sessions` | ChatGPT-style drafting threads | `drafting_sessions.py` |
| `drafting_messages` | Individual messages in sessions | `drafting_sessions.py` |
| `prompt_templates` | Reusable prompt chips | `drafting_sessions.py` (admin) |
| `jobs` | Background job tracking | `job_queue.py` |
| `audit_logs` | Approval/rejection audit trail | `review.py` |
| `files` | Uploaded file metadata | `file.py` API |
| `webhooks` | Registered webhook endpoints | `webhooks.py` API |
| `webhook_deliveries` | Webhook delivery logs | `webhook_service.py` |
| `email_notification_settings` | Per-user email preferences | `notifications.py` API |
| `revoked_tokens` | JWT refresh token blacklist | Auth (logout/refresh) |
| `password_reset_tokens` | Password reset tokens | Auth (forgot-password) |
| `sharepoint_sync_log` | SharePoint sync run history | `sharepoint_sync.py` |
| `alembic_version` | Alembic migration tracking | Alembic |

**Note:** the old pre-migration `public.master_*` PascalCase legacy tables (`master_department`,
`master_designation`, `master_user`, etc.) described in earlier versions of this doc as "not yet dropped"
**have been dropped** — see `phase2_drop_legacy_tables.py` (2026-07-27), which removed all 13 (they were
verified empty). They no longer exist.

---

## 5. Which Tables Are Actually Used

`Master.users`, `Master.roles`, `Master.modules`, `Master.role_permissions`, `Master.departments`,
`Master.designations`, `Master.locations`, `Master.units`, `Master.lookups`, `Master.contractors`,
`Master.contracts`, `Master.common_roles`, `Master.role_rights`, `Master.ui_modules`, `Master.module_groups`,
`Master.project_master`, `Master.project_details`, `Master.user_directory`, `Master.user_roles`,
`Master.user_access_filters`, `Master.user_logs`, `Master.error_logs`, `Master.auto_notifications`,
`Master.approver_roles`, `projects`, `inbound_letters`, `draft_responses`, `knowledge_documents`,
`document_chunks`, `drafting_sessions`, `drafting_messages`, `prompt_templates`, `jobs`, `audit_logs`,
`files`, `webhooks`, `webhook_deliveries`, `email_notification_settings`, `revoked_tokens`,
`password_reset_tokens`, `sharepoint_sync_log`

No orphaned/legacy tables remain — both the pre-migration `public.master_*` tables and the EAV
`master_records` table have been dropped, and the PMO/commercial tables were dropped outright in `phase8`
rather than migrated.

---

## 6. Foreign Key Dependency Graph

```
Master.roles (PK: name)
  ^--- Master.users.role
  ^--- Master.role_permissions.role_name (CASCADE)

Master.modules (PK: key)
  ^--- Master.role_permissions.module_key (CASCADE)

Master.users (PK: id)
  ^--- files.uploaded_by (SET NULL)
  ^--- jobs.created_by (SET NULL)
  ^--- webhooks.created_by (SET NULL)
  ^--- password_reset_tokens.user_id (CASCADE)
  ^--- email_notification_settings.user_id (CASCADE)
  ^--- audit_logs.user_id (SET NULL)

projects (PK: id)
  ^--- inbound_letters.project_id (SET NULL)
  ^--- draft_responses.project_id (SET NULL)
  ^--- knowledge_documents.project_id (SET NULL)
  ^--- drafting_sessions.project_id (SET NULL)
  ^--- sharepoint_sync_log.project_id (CASCADE)

inbound_letters (PK: id)
  ^--- draft_responses.letter_id (CASCADE)
  ^--- drafting_sessions.letter_id (SET NULL)

draft_responses (PK: id)
  (referenced by drafting_messages.draft_response_id as SOFT FK — no DB constraint)

knowledge_documents (PK: id)
  ^--- document_chunks.document_id (CASCADE)

drafting_sessions (PK: id)
  ^--- drafting_messages.session_id (CASCADE)

webhooks (PK: id)
  ^--- webhook_deliveries.webhook_id (CASCADE)
```

---

## 7. Complete API Endpoint Inventory (~145 endpoints; down from ~165 since §7.15/§7.16 shrank)

### 7.1 CCM Core Auth (`/api/auth`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | POST | `/api/auth/login` | OAuth2 form login (email+password). Returns JWT. |
| 2 | POST | `/api/auth/login/json` | JSON body login variant. |
| 3 | GET | `/api/auth/me` | Return current user profile. |
| 4 | POST | `/api/auth/refresh` | Refresh access token. |
| 5 | POST | `/api/auth/logout` | Revoke refresh token. |
| 6 | POST | `/api/auth/forgot-password` | Send password-reset email. |
| 7 | POST | `/api/auth/reset-password` | Reset password with token. |
| 8 | POST | `/api/auth/register` | Admin: create new user. |
| 9 | GET | `/api/auth/users` | Admin: list all users. |
| 10 | DELETE | `/api/auth/users/{user_id}` | Admin: delete user. |
| 11 | GET | `/api/auth/google` | Redirect to Google OAuth. |
| 12 | GET | `/api/auth/google/callback` | Google OAuth callback. |
| 13 | POST | `/api/auth/azure/login` | Azure AD SSO login. |

### 7.2 Knowledge Base (`/api/knowledge`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | POST | `/api/knowledge/upload` | Upload document for background indexing. |
| 2 | GET | `/api/knowledge/documents` | List all KB documents. |
| 3 | DELETE | `/api/knowledge/documents/{id}` | Delete document + chunks. |
| 4 | GET | `/api/knowledge/stats` | KB statistics. |
| 5 | POST | `/api/knowledge/search` | Semantic search across KB. |

### 7.3 Letters (`/api/letters`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | POST | `/api/letters/upload` | Upload client letter + classify. |
| 2 | GET | `/api/letters` | List letters with filters. |
| 3 | GET | `/api/letters/{letter_id}` | Get specific letter. |
| 4 | PUT | `/api/letters/{letter_id}/reclassify` | Override classification. |
| 5 | POST | `/api/letters/{letter_id}/classify` | Re-classify as background job. |

### 7.4 Drafts (`/api/drafts`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | POST | `/api/drafts` | Enqueue draft generation. |
| 2 | POST | `/api/drafts/generate/{letter_id}` | Generate AI draft for letter. |
| 3 | GET | `/api/drafts/{draft_id}` | Get specific draft. |
| 4 | PUT | `/api/drafts/{draft_id}` | Manually edit draft text. |
| 5 | POST | `/api/drafts/{draft_id}/regenerate` | Re-generate with feedback. |
| 6 | GET | `/api/drafts/letter/{letter_id}` | All draft versions for a letter. |

### 7.5 Review & Audit (`/api/review`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | POST | `/api/review/{draft_id}/approve` | Approve a draft. |
| 2 | POST | `/api/review/{draft_id}/reject` | Reject with feedback. |
| 3 | POST | `/api/review/{draft_id}/send` | Mark as sent. |
| 4 | POST | `/api/review/archive/{letter_id}` | Archive letter + drafts. |
| 5 | GET | `/api/review/audit` | Audit trail entries. |
| 6 | GET | `/api/review/dashboard/stats` | Dashboard statistics. |

### 7.6 Jobs (`/api/jobs`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/api/jobs/{job_id}` | Poll job status. |
| 2 | DELETE | `/api/jobs/{job_id}` | Cancel queued job. |
| 3 | WS | `/api/jobs/ws/{job_id}` | WebSocket for real-time job updates. |

### 7.7 Webhooks (`/api/webhooks`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | POST | `/api/webhooks` | Create webhook. |
| 2 | GET | `/api/webhooks` | List webhooks. |
| 3 | GET | `/api/webhooks/{webhook_id}` | Get specific webhook. |
| 4 | DELETE | `/api/webhooks/{webhook_id}` | Delete webhook. |
| 5 | GET | `/api/webhooks/{webhook_id}/deliveries` | Delivery logs. |
| 6 | POST | `/api/webhooks/{webhook_id}/test` | Send test ping. |

### 7.8 Notifications (`/api/users/me/notification-settings`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/api/users/me/notification-settings` | Get email preferences. |
| 2 | PATCH | `/api/users/me/notification-settings` | Update email preferences. |

### 7.9 Files (`/api/files`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/api/files/{file_id}/download` | Download a file. |

### 7.10 Projects (`/api/projects`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/api/projects` | List projects (CCM + Master merged). |
| 2 | POST | `/api/projects` | Create project. |
| 3 | GET | `/api/projects/{project_id}` | Get project details. |
| 4 | PUT | `/api/projects/{project_id}` | Update project. |
| 5 | DELETE | `/api/projects/{project_id}` | Soft-delete project. |
| 6 | GET | `/api/projects/{project_id}/sync-logs` | SharePoint sync logs. |
| 7 | GET | `/api/projects/{project_id}/stats` | Project statistics. |

### 7.11 Drafting Sessions (`/api/drafting-sessions`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/api/drafting-sessions/templates` | List prompt templates. |
| 2 | GET | `/api/drafting-sessions/search` | Search sessions. |
| 3 | GET | `/api/drafting-sessions` | List user sessions. |
| 4 | POST | `/api/drafting-sessions` | Create session. |
| 5 | GET | `/api/drafting-sessions/{session_id}` | Get session + messages. |
| 6 | PATCH | `/api/drafting-sessions/{session_id}/pin` | Toggle pin. |
| 7 | PATCH | `/api/drafting-sessions/{session_id}/title` | Rename session. |
| 8 | DELETE | `/api/drafting-sessions/{session_id}` | Delete session. |
| 9 | POST | `/api/drafting-sessions/{session_id}/messages` | Append message. |

### 7.12 Prompt Templates (`/api/prompts`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/api/prompts` | List all templates. |
| 2 | POST | `/api/prompts` | Create template. |
| 3 | GET | `/api/prompts/{template_id}` | Get template. |
| 4 | PUT | `/api/prompts/{template_id}` | Update template. |
| 5 | DELETE | `/api/prompts/{template_id}` | Soft-delete template. |
| 6 | POST | `/api/prompts/reorder` | Reorder templates. |

### 7.13 Master Roles & Permissions (`/api/roles`)

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/api/roles` | List roles with permission matrix. |
| 2 | GET | `/api/roles/modules` | List permission modules. |
| 3 | POST | `/api/roles` | Create role. |
| 4 | PUT | `/api/roles/{name}` | Update role description. |
| 5 | DELETE | `/api/roles/{name}` | Delete role. |
| 6 | PUT | `/api/roles/{name}/permissions` | Bulk upsert permissions. |

### 7.14 Master Common Reference Data (`/common`)

| # | Method | Path | Description | Table |
|---|--------|------|-------------|-------|
| 1 | POST | `/common/getLookupDetails` | Get lookups by type | `lookups` |
| 2 | GET | `/common/getLookupDetails` | Get lookup by ID | `lookups` |
| 3 | POST | `/common/saveLookupDetails` | Upsert lookup | `lookups` |
| 4 | POST | `/common/deleteLookupDetails` | Delete lookup | `lookups` |
| 5 | GET | `/common/getDepartments` | List departments | `departments` |
| 6 | POST | `/common/getDepartments` | List departments (POST) | `departments` |
| 7 | POST | `/common/saveDepartmentDetails` | Upsert department | `departments` |
| 8 | POST | `/common/saveDepartmentBulkDetails` | Bulk upsert departments | `departments` |
| 9 | POST | `/common/deleteDepartmentDetails` | Delete department | `departments` |
| 10 | GET | `/common/getLocations` | List locations | `locations` |
| 11 | POST | `/common/saveLocationDetails` | Upsert location | `locations` |
| 12 | POST | `/common/deleteLocationDetails` | Delete location | `locations` |
| 13 | GET | `/common/getDesignations` | List designations | `designations` |
| 14 | POST | `/common/getDesignations` | List designations (POST) | `designations` |
| 15 | POST | `/common/saveDesignationDetails` | Upsert designation | `designations` |
| 16 | POST | `/common/deleteDesignationDetails` | Delete designation | `designations` |
| 17 | GET | `/common/getUnits` | List units | `units` |
| 18 | POST | `/common/saveUnitDetails` | Upsert unit | `units` |
| 19 | POST | `/common/SaveUnitBulkDetails` | Bulk upsert units | `units` |
| 20 | POST | `/common/deleteUnitDetails` | Delete unit | `units` |

### 7.15 Master Roles, Modules, Users, Projects, Contractors, Contracts, Logs (`/common`)

Route→table mapping verified against `MASTER_API_ROUTE_TO_TABLE_MAP.md` (2026-09-10). The EAV `master_records`
table these all used to hit is gone — everything below is now a dedicated table, and the
activities/work-packages/variation-orders/monthly-breakups/estimation-months/reference-documents endpoints
that used to live in this section **no longer exist** (routers deleted in `phase8`, only stale `.pyc` files
remain under `backend/api/master/__pycache__/`).

| # | Method | Path | Description | Table |
|---|--------|------|-------------|-------|
| 1 | GET | `/common/getRoles` | Get admin-panel roles | `common_roles` |
| 2 | POST | `/common/saveRoles` | Save admin-panel role | `common_roles` |
| 3 | POST | `/common/deleteRoles` | Delete admin-panel role (soft) | `common_roles` |
| 4 | GET | `/common/getRoleRightDetails` | Get role rights | `role_rights` |
| 5 | POST | `/common/saveRoleRightDetails` | Save role rights | `role_rights` |
| 6 | POST | `/common/deleteRoleRightDetails` | Delete role right (soft) | `role_rights` |
| 7 | POST | `/common/getModules` | List UI menu modules | `ui_modules` |
| 8 | POST | `/common/saveModuleDetails` | Save UI menu module | `ui_modules` |
| 9 | POST | `/common/deleteModuleDetails` | Delete UI menu module (soft) | `ui_modules` |
| 10 | GET/POST | `/common/getModuleGroups` | Get module groups | `module_groups` |
| 11 | POST | `/common/saveModuleGroupDetails` | Save module group | `module_groups` |
| 12 | POST | `/common/deleteModuleGroupDetails` | Delete module group (soft) | `module_groups` |
| 13 | POST | `/common/getUsers` | List admin user directory | `user_directory` |
| 14 | POST | `/common/getUserDetails` | Get user details, or OTP login if `UserName` passed | `user_directory` (or `Master.users` for OTP) |
| 15 | POST | `/common/saveUserDetails` | Save admin directory user | `user_directory` |
| 16 | POST | `/common/deleteUserDetails` | Delete admin directory user (soft) | `user_directory` |
| 17 | GET/POST | `/common/getUserRights` | Get admin sidebar menu tree | None (static, `_menu.py`) |
| 18 | POST | `/common/GetUserAccessFilters` | Get raw user access filter rows | `user_access_filters` |
| 19 | GET | `/common/getUserRoles` | Get user roles + aggregated access filters | `user_roles` + `user_access_filters` |
| 20 | POST | `/common/saveUserRoles` (alias `saveUserRoleDetails`) | Save user role + replace filter rows | `user_roles` + `user_access_filters` |
| 21 | POST | `/common/deleteUserRoles` (alias `deleteUserRoleDetails`) | Delete user role + filter rows | `user_roles` + `user_access_filters` |
| 22 | GET | `/common/getApproverRoles` | List approver roles | `approver_roles` |
| 23 | POST | `/common/updateTourStatus` | Update onboarding status | None (stub) |
| 24 | GET/POST | `/common/getProjects` | List admin/master project list | `project_master` |
| 25 | POST | `/common/getProjectDetails` | Get project detail rows | `project_details` |
| 26 | POST | `/common/saveProjectDetails` | Save project master | `project_master` |
| 27 | POST | `/common/saveProjectDetailsData` | Save project detail | `project_details` |
| 28 | POST | `/common/deleteProjectDetails` | Delete project master (soft) | `project_master` |
| 29 | POST | `/common/deleteProjectDetailsData` | Delete project detail (soft) | `project_details` |
| 30 | GET | `/common/getContractors` | List contractors | `contractors` |
| 31 | POST | `/common/saveContractorDetails` | Save contractor | `contractors` |
| 32 | POST | `/common/deleteContractorDetails` | Delete contractor (soft) | `contractors` |
| 33 | POST | `/common/getContracts` | List contracts | `contracts` |
| 34 | POST | `/common/saveContractDetails` | Save contract | `contracts` |
| 35 | POST | `/common/deleteContractDetails` | Delete contract (soft) | `contracts` |
| 36 | GET | `/common/GetAutoNotification` | List auto notifications | `auto_notifications` |
| 37 | POST | `/common/saveAutoNotificationDetails` | Save auto notification | `auto_notifications` |
| 38 | POST | `/common/deleteAutoNotificationDetails` | Delete auto notification (soft) | `auto_notifications` |
| 39 | POST | `/common/getUserLogs` | List user logs | `user_logs` |
| 40 | POST | `/common/saveUserLogDetails` | Save user log | `user_logs` |
| 41 | POST | `/common/getErrorLogs` | List error logs | `error_logs` |
| 42 | POST | `/common/getTestApi` | Test echo endpoint | None |
| 43 | POST | `/common/isRecordExists` | Duplicate-check helper over relational master routes | None (helper) |
| 44 | POST | `/common/saveProjectAttachment` | Accept project file upload | None (stub — reads for size only) |
| 45 | POST | `/common/saveContractAttachment` | Accept contract file upload | None (stub) |
| 46 | POST | `/common/saveContractorAttachment` | Accept contractor file upload | None (stub) |
| 47 | POST | `/common/saveDocumentAttachment` | Accept document file upload | None (stub) |

**Removed entirely (no longer routed, table dropped):** `/common/getActivityGroup`, `saveActivityGroupDetails`,
`deleteActivityGroupDetails`, `getActivity`, `getSubActivity`, `saveActivityDetails`, `saveActivityBulkDetails`,
`deleteActivityDetails`, `getWorkPackage`, `getVariationOrderDetails`, `saveVariationOrderData`,
`deleteVariationOrderData`, `getMonthlyBreakUpDetailsData`, `saveMonthlyBreakUpDetailsData`,
`deleteMontlyBreakUpDetailsData`, `getEstimationMonths`, `getDocuments`, `saveDocuments`, `deleteDocuments`.

### 7.16 Health, Metrics & Misc

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/health` | Deep health check (DB, pgvector, Redis, storage, OpenAI) |
| 2 | GET | `/api/metrics` | Prometheus metrics endpoint |
| 3 | GET | `/verifyDbConnection` | Verify database connection |
| 4 | POST | `/email/sendEmail` | Send email (stub/placeholder) |

---

## 8. Services Layer — What Each Service Does

| Service | File | Purpose | DB Tables | External APIs |
|---------|------|---------|-----------|---------------|
| `openai_client` | `openai_client.py` | Shared async OpenAI client with retry/backoff | None | OpenAI (GPT-4o, embeddings) |
| `knowledge_base` | `knowledge_base.py` | Document upload, text extraction, chunking, embedding, semantic search | `knowledge_documents`, `document_chunks`, `audit_logs` | OpenAI (embeddings), Storage |
| `letter_intake` | `letter_intake.py` | Upload client letters, classify with AI, extract metadata | `inbound_letters`, `audit_logs`, `projects` | OpenAI (classification) |
| `drafting` | `drafting.py` | RAG-based draft generation with KB context retrieval | `inbound_letters`, `draft_responses`, `audit_logs` | OpenAI (drafting), KB service |
| `review` | `review.py` | Approve/reject/send/archive workflow + audit trail | `draft_responses`, `inbound_letters`, `audit_logs`, `users`, `email_notification_settings`, `knowledge_documents`, `document_chunks` | Webhooks, Email, KB service |
| `drafting_sessions` | `drafting_sessions.py` | ChatGPT-style session + message management | `drafting_sessions`, `drafting_messages`, `prompt_templates`, `draft_responses` | None |
| `job_queue` | `job_queue.py` | Background job management with ARQ + pg_notify | `jobs` | Redis (optional), PostgreSQL LISTEN/NOTIFY |
| `webhook_service` | `webhook_service.py` | Dispatch events to registered webhooks | `webhooks`, `webhook_deliveries` | httpx (webhook POST) |
| `email_service` | `email_service.py` | Send HTML emails via SMTP | None | SMTP (aiosmtplib) |
| `storage` | `storage.py` | Pluggable file storage (local/S3) | None | S3/MinIO (aioboto3) |
| `file_validator` | `file_validator.py` | MIME validation, size limits, SHA-256 checksum | None | None |
| `sharepoint_sync` | `sharepoint_sync.py` | Pull files from SharePoint via Graph API | `projects`, `sharepoint_sync_log`, `knowledge_documents`, `document_chunks` | Microsoft Graph API |
| `metrics` | `metrics.py` | Prometheus metric definitions | None | None |
| `worker` | `worker.py` | ARQ background task definitions (6 tasks) | All tables (via services) | All services |

---

## 9. Worker Background Tasks

| Task | Service | DB Tables | Trigger |
|------|---------|-----------|---------|
| `classify_letter_task` | `letter_intake.classify_letter()` | `inbound_letters`, `jobs` | Letter upload |
| `generate_draft_task` | `drafting.generate_draft()` | `inbound_letters`, `draft_responses`, `audit_logs`, `drafting_messages`, `jobs` | Draft generation request |
| `index_kb_document_task` | `knowledge_base.*` | `knowledge_documents`, `document_chunks`, `jobs` | KB document upload |
| `send_email_task` | `email_service.EmailService()` | None | Review workflow events |
| `deliver_webhook_task` | `webhook_service.deliver_webhook()` | `webhooks`, `webhook_deliveries` | All webhook events |
| `sharepoint_sync_task` | `sharepoint_sync.*` | `projects`, `sharepoint_sync_log`, `knowledge_documents`, `document_chunks` | Scheduled / manual |

---

## 10. Webhook Events Dispatched

| Event | Dispatched By | When |
|-------|---------------|------|
| `letter.uploaded` | `letter_intake.py` | Letter classified |
| `kb.document_added` | `knowledge_base.py` | KB document indexed |
| `draft.generated` | `drafting.py` | Draft generated |
| `draft.approved` | `review.py` | Draft approved |
| `draft.rejected` | `review.py` | Draft rejected |
| `test.ping` | `webhook_service.py` | Test webhook delivery |

---

## 11. Database Migrations

The project moved from numbered migrations to a phased Alembic chain under `backend/alembic/versions/`.
All of the below have run:

| Phase | File (prefix) | Purpose |
|-------|------|---------|
| baseline | `20260725_000_baseline.py` | Initial schema baseline |
| 2 | `9ce0a4ace0dd_phase2_drop_legacy_tables.py` | Drop the 13 empty pre-migration `public.master_*` PascalCase tables |
| 3 | `022407ca7fbe_phase3_structural_fixes_indexes_fks.py` | Structural fixes, indexes, FKs |
| 4 → 4j | `510deff1ada4_...` through `f0a1b2c3d4e5_phase4j_deprecate_master_records.py` | Extract contractors, activities, contracts, common_roles, modules, logs, reference_documents, project/user-directory entities, and remaining EAV rows out of `master_records`, then deprecate/drop that table |
| 5 | `a1b2c3d4e5f6_phase5_pgvector.py` | Enable pgvector |
| 6 | `b2c3d4e5f6a7_phase6_rbac_consolidation.py` | RBAC consolidation |
| 7 | `c3d4e5f6a7b8_phase7_audit_logs_partitioning.py` | Audit log partitioning |
| 8 | `8744280b2d28_phase8_remove_financial_and_project_structure_tables.py` | **Drop** `activities`, `activity_groups`, `work_packages`, `variation_orders`, `monthly_breakups`, `estimation_months`, `reference_documents` — this scope was cut, not migrated |

---

## 12. Database Seed Data

Called idempotently from `init_db()` on every startup.

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full system access |
| `drafter` | Creates letters, drafts, and knowledge base entries |

### Modules (28 total, per `backend/db_seed.py`)

**CCM core (13):** `users`, `roles`, `prompts`, `letters`, `knowledge`, `jobs`, `webhooks`, `review`, `projects`, `drafts`, `files`, `drafting_sessions`, `notifications`

**Master/Admin (15):** `departments`, `locations`, `designations`, `units`, `lookups`, `ui_modules`, `module_groups`, `projects_master`, `contractors`, `contracts`, `auto_notifications`, `user_roles`, `role_rights`, `user_logs`, `error_logs`, `api_test`

`activities`, `variation_orders`, `monthly_breakup`, and `reference_documents` modules **no longer exist**
(dropped from the seed along with their tables/routers in `phase8`).

### Permissions

- **admin**: Full CRUD on all 28 modules
- **drafter**: Selective (letters, knowledge, drafts, files, sessions, projects, jobs, notifications)

---

## 13. External Integrations

| Integration | Config | Status | Used By |
|-------------|--------|--------|---------|
| **OpenAI API** | `AI__OPENAI_API_KEY` | ✅ OK (verified via `/health`, ~1.3s latency) | Classification, drafting, embeddings, vision |
| **Redis** | `REDIS__URL` (empty) | Disabled, inline fallback | Background job queue |
| **SMTP** | `SMTP_HOST/USER/PASSWORD` env vars | Unconfigured | Email notifications |
| **S3/MinIO** | `STORAGE__BACKEND=s3` | Using local storage | File persistence |
| **SharePoint** | Azure AD + Graph API | Not configured | Document sync |
| **Azure AD SSO** | `AUTH__AZURE_*` | Partially configured | Enterprise login |
| **Google OAuth** | `AUTH__GOOGLE_*` | Not configured | Google sign-in |
| **Prometheus** | `ENABLE_METRICS` | Available at `/api/metrics` | Observability |
| **ClamAV** | `CLAMAV_URL` | Config-only, not implemented | Virus scanning |

---

## 14. Middleware Stack

| # | Middleware | Purpose |
|---|-----------|---------|
| 1 | Security Headers | HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP |
| 2 | Metrics | Prometheus `http_requests_total` counter + `http_request_duration_seconds` histogram |
| 3 | CORS | Configurable allowed origins, credentials=True |
| 4 | Rate Limiting | 100/minute per user via slowapi |

---

## 15. Architectural Observations

1. **Dual RBAC systems**: The CCM core uses a dedicated `role_permissions` table (`require_permission()` in deps.py), while the Master sub-app has a parallel MasterRecord-backed role/rights system (`common_roles.py`). They are independent.

2. **MasterRecord EAV pattern**: Nearly all master endpoints store data in a single `master_records` table with an `entity` discriminator column and a JSONB `data` column. This makes the admin sub-app entirely self-contained and removable without touching CCM tables. Soft-delete is done by setting `status="9"`.

3. **File upload stubs**: The master attachment endpoints (`attachments.py`) accept files but only read them for size — they do not persist to storage. This is a placeholder/stub. The CCM-side `files.py` and `letters.py` use the real `storage_backend`.

4. **Auth flow**: The master sub-app has a bridge `auth.py` that tries CCM JWT first, then falls back to Azure AD token validation + JIT provisioning. The OTP login path in `users.py/getUserDetails` is unauthenticated and mints a JWT for the frontend to use.

5. **Background jobs**: When Redis is unavailable, jobs run inline in the same process via `_run_job_inline()`. This means letter classification and draft generation are synchronous when Redis is off.

6. **RAG search is in-Python**: `search_similar_chunks()` loads all embeddings into Python and computes cosine similarity client-side, rather than using pgvector's native vector operators. This will not scale well with large document sets.

7. **Soft FK pattern**: `created_by` columns on `InboundLetter`, `KnowledgeDocument`, and `DraftingMessage.draft_response_id` store UUIDs that logically reference other tables but have **no declared ForeignKey constraint**.

8. **Hierarchical master data**: `Department`, `Designation`, `Unit`, and `Location` all share the same structural pattern (id, code, name, parent_id, level, remarks, status) with self-referencing `parent_id` columns that are **not** declared as foreign keys.

9. **Audit partitioning intent**: `AuditEntry` (audit_logs) is designed for future RANGE partitioning by `created_at` (monthly), as noted in its docstring.

10. **Dual data systems**: There are two parallel systems for storing master data — the dedicated ORM models (departments, locations, etc.) AND the `master_records` EAV table. The legacy `master_*` tables were consolidated into the dedicated models via migration 001, but the EAV system persists for entities that don't have dedicated models.
