# CCM Architecture — Complete Analysis

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│   Port 5000  |  Base path: /master/  |  Proxies /api → :8000   │
│   MUI v9 + framer-motion + chart.js + recharts                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP (JSON) + WebSocket
┌──────────────────────▼──────────────────────────────────────────┐
│                    BACKEND (FastAPI + uvicorn)                   │
│   Port 8000  |  ~165 endpoints  |  async SQLAlchemy + asyncpg   │
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

A legacy admin CRUD sub-app ported from a vanilla JS application. Uses the **EAV pattern** — almost everything stored in a single `master_records` table with an `entity` discriminator and JSONB `data` column.

**They share one critical link:** the `Master.users` table (authentication). Both systems validate JWT tokens from the same user pool.

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

### Flow 4: Master/Admin CRUD (EAV Pattern)

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
  │     └─► mr_list(db, entity="contractor")     → SELECT FROM "Master".master_records
  │           WHERE entity='contractor'           → single JSONB row per contractor
  │
  ├─► User saves a contractor
  │
  └─► POST /common/saveContractorDetails
        └─► mr_save(db, entity="contractor")     → INSERT/UPDATE "Master".master_records
              (stores full PascalCase JSON in data JSONB column)
```

**Key insight:** Some master entities use dedicated tables (departments, designations, locations, units, lookups). Most others use the EAV `master_records` table.

---

## 4. Complete Table Map (41 Tables)

### Master Schema (10 tables) — "Who has access"

| Table | Purpose | Populated By |
|-------|---------|-------------|
| `Master.users` | User accounts (email, password, role, Azure OID) | Auth API, Azure SSO JIT-provisioning |
| `Master.roles` | RBAC role definitions (admin, drafter) | `db_seed.py` |
| `Master.modules` | Permission module keys (32 modules) | `db_seed.py` |
| `Master.role_permissions` | Role→Module permission matrix | `db_seed.py` |
| `Master.departments` | Organizational departments (hierarchical) | `/common/saveDepartmentDetails` |
| `Master.designations` | Job designations (hierarchical) | `/common/saveDesignationDetails` |
| `Master.locations` | Project locations (hierarchical) | `/common/saveLocationDetails` |
| `Master.units` | Measurement units | `/common/saveUnitDetails` |
| `Master.lookups` | Generic lookup/reference data | `/common/saveLookupDetails` |
| `Master.master_records` | **EAV catch-all** for everything else | ~20 different `/common/*` endpoints |

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
| `alembic_version` | Alembic migration tracking | Alembic (legacy) |
| `master_department` | **Legacy** pre-migration data | Migration 001 (source) |
| `master_designation` | **Legacy** pre-migration data | Migration 001 (source) |
| `master_location` | **Legacy** pre-migration data | Migration 001 (source) |
| `master_unit` | **Legacy** pre-migration data | Migration 001 (source) |
| `master_lookup` | **Legacy** pre-migration data | Migration 001 (source) |
| `master_module` | **Legacy** pre-migration data | Migration 001 (source) |
| `master_module_group` | **Legacy** pre-migration data | Never migrated (orphan) |
| `master_project` | **Legacy** pre-migration data | Migration 001 (source) |
| `master_project_details` | **Legacy** pre-migration data | Never migrated (orphan) |
| `master_role` | **Legacy** pre-migration data | Migration 001 (source) |
| `master_role_right` | **Legacy** pre-migration data | Never migrated (orphan) |
| `master_user` | **Legacy** pre-migration data | Never migrated (orphan) |
| `master_user_role` | **Legacy** pre-migration data | Never migrated (orphan) |

---

## 5. Which Tables Are Actually Used vs. Orphaned

### Actively Used (27 tables)

`Master.users`, `Master.roles`, `Master.modules`, `Master.role_permissions`, `Master.departments`, `Master.designations`, `Master.locations`, `Master.units`, `Master.lookups`, `Master.master_records`, `projects`, `inbound_letters`, `draft_responses`, `knowledge_documents`, `document_chunks`, `drafting_sessions`, `drafting_messages`, `prompt_templates`, `jobs`, `audit_logs`, `files`, `webhooks`, `webhook_deliveries`, `email_notification_settings`, `revoked_tokens`, `password_reset_tokens`, `sharepoint_sync_log`

### Legacy/Orphaned (14 tables) — Safe to Drop After Migration 002

`master_department`, `master_designation`, `master_location`, `master_unit`, `master_lookup`, `master_module`, `master_module_group`, `master_project`, `master_project_details`, `master_role`, `master_role_right`, `master_user`, `master_user_role`, `alembic_version`

These are the old pre-migration tables. Migration 001 copied their data into the consolidated schema. Migration 002 (`_002_drop_master_tables.py`) will DROP them all but has **not been run yet**.

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

## 7. Complete API Endpoint Inventory (~165 endpoints)

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

### 7.15 Master Roles, Modules, Users, Projects, etc. (`/common`)

| # | Method | Path | Description | Table |
|---|--------|------|-------------|-------|
| 1 | GET | `/common/getRoles` | Get master roles | `master_records` |
| 2 | POST | `/common/saveRoles` | Save master role | `master_records` |
| 3 | POST | `/common/deleteRoles` | Delete master role | `master_records` |
| 4 | GET | `/common/getRoleRightDetails` | Get role rights | `master_records` |
| 5 | POST | `/common/saveRoleRightDetails` | Save role rights | `master_records` |
| 6 | POST | `/common/deleteRoleRightDetails` | Delete role right | `master_records` |
| 7 | POST | `/common/getModules` | List UI modules | `master_records` |
| 8 | POST | `/common/saveModuleDetails` | Save UI module | `master_records` |
| 9 | POST | `/common/deleteModuleDetails` | Delete UI module | `master_records` |
| 10 | GET | `/common/getModuleGroups` | Get module groups | `master_records` |
| 11 | POST | `/common/getModuleGroups` | Get module groups (POST) | `master_records` |
| 12 | POST | `/common/saveModuleGroupDetails` | Save module group | `master_records` |
| 13 | POST | `/common/deleteModuleGroupDetails` | Delete module group | `master_records` |
| 14 | POST | `/common/getUsers` | List master user directory | `master_records` |
| 15 | POST | `/common/getUserDetails` | Get user details / OTP login | `master_records`, `users` |
| 16 | POST | `/common/saveUserDetails` | Save master user record | `master_records` |
| 17 | POST | `/common/deleteUserDetails` | Delete master user | `master_records` |
| 18 | POST | `/common/getUserRights` | Get admin sidebar menu tree | None (static) |
| 19 | GET | `/common/getUserRights` | Same (GET variant) | None (static) |
| 20 | POST | `/common/GetUserAccessFilters` | Get user access filters | `master_records` |
| 21 | GET | `/common/getUserRoles` | Get user roles | `master_records` |
| 22 | POST | `/common/saveUserRoles` | Save user role assignment | `master_records` |
| 23 | POST | `/common/deleteUserRoles` | Delete user role assignment | `master_records` |
| 24 | GET | `/common/getApproverRoles` | Get approver roles | `master_records` |
| 25 | POST | `/common/updateTourStatus` | Update onboarding status | None (stub) |
| 26 | POST | `/common/getProjects` | List project masters | `master_records` |
| 27 | GET | `/common/getProjects` | List project masters (GET) | `master_records` |
| 28 | POST | `/common/getProjectDetails` | Get project detail rows | `master_records` |
| 29 | POST | `/common/saveProjectDetails` | Save project master | `master_records` |
| 30 | POST | `/common/saveProjectDetailsData` | Save project detail | `master_records` |
| 31 | POST | `/common/deleteProjectDetails` | Delete project master | `master_records` |
| 32 | POST | `/common/deleteProjectDetailsData` | Delete project detail | `master_records` |
| 33 | GET | `/common/getContractors` | List contractors | `master_records` |
| 34 | POST | `/common/saveContractorDetails` | Save contractor | `master_records` |
| 35 | POST | `/common/deleteContractorDetails` | Delete contractor | `master_records` |
| 36 | POST | `/common/getContracts` | List contracts | `master_records` |
| 37 | POST | `/common/saveContractDetails` | Save contract | `master_records` |
| 38 | POST | `/common/deleteContractDetails` | Delete contract | `master_records` |
| 39 | GET | `/common/getActivityGroup` | Get activity groups | `master_records` |
| 40 | POST | `/common/saveActivityGroupDetails` | Save activity group | `master_records` |
| 41 | POST | `/common/deleteActivityGroupDetails` | Delete activity group | `master_records` |
| 42 | GET | `/common/getActivity` | Get activities | `master_records` |
| 43 | GET | `/common/getSubActivity` | Get sub-activities | `master_records` |
| 44 | POST | `/common/saveActivityDetails` | Save activity | `master_records` |
| 45 | POST | `/common/saveActivityBulkDetails` | Bulk save activities | `master_records` |
| 46 | POST | `/common/deleteActivityDetails` | Delete activity | `master_records` |
| 47 | GET | `/common/getWorkPackage` | Get work packages | `master_records` |
| 48 | GET | `/common/getVariationOrderDetails` | List variation orders | `master_records` |
| 49 | POST | `/common/saveVariationOrderData` | Save variation order | `master_records` |
| 50 | POST | `/common/deleteVariationOrderData` | Delete variation order | `master_records` |
| 51 | POST | `/common/getMonthlyBreakUpDetailsData` | List monthly breakups | `master_records` |
| 52 | POST | `/common/saveMonthlyBreakUpDetailsData` | Save monthly breakup | `master_records` |
| 53 | POST | `/common/deleteMontlyBreakUpDetailsData` | Delete monthly breakup | `master_records` |
| 54 | GET | `/common/getEstimationMonths` | List estimation months | `master_records` |
| 55 | GET | `/common/GetAutoNotification` | List auto notifications | `master_records` |
| 56 | POST | `/common/saveAutoNotificationDetails` | Save auto notification | `master_records` |
| 57 | POST | `/common/deleteAutoNotificationDetails` | Delete auto notification | `master_records` |
| 58 | POST | `/common/getUserLogs` | List user logs | `master_records` |
| 59 | POST | `/common/saveUserLogDetails` | Save user log | `master_records` |
| 60 | POST | `/common/getErrorLogs` | List error logs | `master_records` |
| 61 | POST | `/common/getTestApi` | Test echo endpoint | None |
| 62 | POST | `/common/isRecordExists` | Check record exists | `master_records` |
| 63 | GET | `/common/getDocuments` | List reference documents | `master_records` |
| 64 | POST | `/common/saveDocuments` | Save reference document | `master_records` |
| 65 | POST | `/common/deleteDocuments` | Delete reference document | `master_records` |
| 66 | POST | `/common/saveProjectAttachment` | Accept project file upload | None (stub) |
| 67 | POST | `/common/saveContractAttachment` | Accept contract file upload | None (stub) |
| 68 | POST | `/common/saveContractorAttachment` | Accept contractor file upload | None (stub) |
| 69 | POST | `/common/saveDocumentAttachment` | Accept document file upload | None (stub) |

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

| Migration | File | Purpose | Status |
|-----------|------|---------|--------|
| 001 | `_001_consolidate_master_data.py` | Copy legacy `master_*` tables into consolidated schema | ✅ Run |
| 002 | `_002_drop_master_tables.py` | Drop legacy `master_*` tables after verification | ⏳ Not run |
| 003 | `_003_move_master_to_schema.py` | Move admin tables from `public` to `Master` schema | ✅ Run |

---

## 12. Database Seed Data

Called idempotently from `init_db()` on every startup.

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full system access |
| `drafter` | Creates letters, drafts, and knowledge base entries |

### Modules (32 total)

**CCM core:** `users`, `roles`, `prompts`, `letters`, `knowledge`, `jobs`, `webhooks`, `review`, `projects`, `drafts`, `files`, `drafting_sessions`, `notifications`

**Master/Admin:** `departments`, `locations`, `designations`, `units`, `lookups`, `ui_modules`, `module_groups`, `projects_master`, `contractors`, `contracts`, `activities`, `variation_orders`, `monthly_breakup`, `auto_notifications`, `reference_documents`, `user_roles`, `role_rights`, `user_logs`, `error_logs`, `api_test`

### Permissions

- **admin**: Full CRUD on all 32 modules
- **drafter**: Selective (letters, knowledge, drafts, files, sessions, projects, jobs, notifications)

---

## 13. External Integrations

| Integration | Config | Status | Used By |
|-------------|--------|--------|---------|
| **OpenAI API** | `AI__OPENAI_API_KEY` | ⚠️ Failing (corporate SSL proxy) | Classification, drafting, embeddings, vision |
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
