# CCM Database — Table-by-Table Analysis

> **Database:** PostgreSQL 15+ `ccm_db` (localhost:5432)
> **Schemas:** `Master` (admin/RBAC) + `public` (CCM core + legacy)
> **Total Tables:** 41 (10 in `Master`, 31 in `public`)
> **Last updated:** July 25, 2026

---

## Summary

| Category | Count | Schema | Status |
|----------|-------|--------|--------|
| **Active — Master/RBAC** | 10 | `Master` | In production |
| **Active — CCM Core** | 17 | `public` | In production |
| **Active — Utility** | 4 | `public` | In production |
| **Legacy (orphaned)** | 14 | `public` | Safe to drop (migration 002) |
| **Migration tracking** | 1 | `public` | Alembic internal |
| **Total** | **41** | | |

---

## Schema: `Master` (10 Tables)

### 1. `Master.users`

| | |
|---|---|
| **ORM Model** | `backend/models/user.py` → `User` |
| **Rows** | **4** |
| **Status** | Active — primary auth table |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `name` | VARCHAR(255) | Yes | Display name |
| `email` | VARCHAR(255) | No | Unique, login identifier |
| `hashed_password` | VARCHAR(255) | Yes | bcrypt hash, nullable for SSO users |
| `google_id` | VARCHAR(255) | Yes | Google OAuth subject |
| `azure_oid` | VARCHAR(255) | Yes, unique, indexed | Azure AD Object ID |
| `azure_tenant_id` | VARCHAR(255) | Yes | Azure AD tenant |
| `auth_provider` | VARCHAR(50) | No | `password`, `azure`, `google` |
| `role` | VARCHAR(20) | No | FK → `Master.roles.name`, default `drafter` |
| `is_active` | BOOLEAN | No | Default `true` |
| `failed_login_attempts` | INTEGER | No | Default `0` |
| `locked_until` | TIMESTAMPTZ | Yes | Account lockout expiry |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `updated_at` | TIMESTAMPTZ | No | Auto-updated |
| `last_login_at` | TIMESTAMPTZ | Yes | Last successful login |
| `last_login_ip` | INET | Yes | Last login IP address |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| POST | `/api/auth/login` | Email + password login |
| POST | `/api/auth/register` | Create new user |
| POST | `/common/getUserDetails` | OTP login / get user details |
| POST | `/common/saveUserDetails` | Save master user record |
| POST | `/common/deleteUserDetails` | Delete master user |
| POST | `/common/getUsers` | List master user directory |
| GET | `/api/users/me` | Get current user profile |

**Frontend Pages:**
- User Management panel (`/admin/users`)
- Login page (password + OTP + Azure AD SSO)
- Profile page

---

### 2. `Master.roles`

| | |
|---|---|
| **ORM Model** | `backend/models/role.py` → `Role` |
| **Rows** | **2** (`admin`, `drafter`) |
| **Status** | Active — seeded on startup |
| **PK** | `name` (VARCHAR(50)) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `name` | VARCHAR(50) | PK | Role name (`admin`, `drafter`) |
| `description` | TEXT | Yes | Human-readable description |
| `is_system` | BOOLEAN | No | Default `false`; system roles protected from deletion |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET | `/api/roles` | List roles with permission matrix |
| POST | `/api/roles` | Create role |
| PUT | `/api/roles/{name}` | Update role description |
| DELETE | `/api/roles/{name}` | Delete role |
| GET | `/common/getRoles` | Get master roles (legacy) |
| POST | `/common/saveRoles` | Save master role (legacy) |

**Frontend Pages:**
- Role Management panel (`/admin/roles`)

---

### 3. `Master.modules`

| | |
|---|---|
| **ORM Model** | `backend/models/module.py` → `Module` |
| **Rows** | **33** (13 CCM core + 20 master/admin) |
| **Status** | Active — seeded on startup |
| **PK** | `key` (VARCHAR(50)) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `key` | VARCHAR(50) | PK | Module identifier (e.g. `letters`, `departments`) |
| `label` | VARCHAR(100) | No | Human-readable label |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |

**Seeded modules (33):**

| Category | Modules |
|----------|---------|
| CCM Core | `users`, `roles`, `prompts`, `letters`, `knowledge`, `jobs`, `webhooks`, `review`, `projects`, `drafts`, `files`, `drafting_sessions`, `notifications` |
| Master/Admin | `departments`, `locations`, `designations`, `units`, `lookups`, `ui_modules`, `module_groups`, `projects_master`, `contractors`, `contracts`, `activities`, `variation_orders`, `monthly_breakup`, `auto_notifications`, `reference_documents`, `user_roles`, `role_rights`, `user_logs`, `error_logs`, `api_test` |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET | `/api/roles/modules` | List all modules (for permission matrix) |
| POST | `/common/getModules` | List UI modules (legacy) |
| POST | `/common/saveModuleDetails` | Save UI module (legacy) |
| POST | `/common/deleteModuleDetails` | Delete UI module (legacy) |

---

### 4. `Master.role_permissions`

| | |
|---|---|
| **ORM Model** | `backend/models/role_permission.py` → `RolePermission` |
| **Rows** | **41** |
| **Status** | Active — RBAC grant matrix |
| **PK** | `id` (UUID) |
| **Unique** | `(role_name, module_key)` |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `role_name` | VARCHAR(50) | No | FK → `Master.roles.name` (CASCADE) |
| `module_key` | VARCHAR(50) | No | FK → `Master.modules.key` (CASCADE) |
| `can_view` | BOOLEAN | No | Default `false` |
| `can_create` | BOOLEAN | No | Default `false` |
| `can_edit` | BOOLEAN | No | Default `false` |
| `can_delete` | BOOLEAN | No | Default `false` |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| PUT | `/api/roles/{name}/permissions` | Bulk upsert permissions |
| GET | `/common/getRoleRightDetails` | Get role rights (legacy EAV) |

**Frontend Pages:**
- Role Management panel — permission matrix grid

---

### 5. `Master.departments`

| | |
|---|---|
| **ORM Model** | `backend/models/department.py` → `Department` |
| **Rows** | **4** |
| **Status** | Active |
| **PK** | `id` (BIGINT, autoincrement) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | BIGINT | PK | Auto-increment |
| `code` | VARCHAR(100) | Yes | Department code |
| `name` | VARCHAR(255) | Yes | Department name |
| `parent_id` | BIGINT | Yes | Self-referencing parent (default `0`) |
| `level` | INTEGER | Yes | Hierarchy level (default `0`) |
| `remarks` | VARCHAR(1000) | Yes | Notes |
| `status` | VARCHAR(10) | Yes | `"1"` = active, `"9"` = soft-deleted |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET/POST | `/common/getDepartments` | List departments |
| POST | `/common/saveDepartmentDetails` | Upsert department |
| POST | `/common/saveDepartmentBulkDetails` | Bulk upsert |
| POST | `/common/deleteDepartmentDetails` | Delete department |

**Frontend Pages:**
- Department Management panel (`/admin/departments`)

---

### 6. `Master.designations`

| | |
|---|---|
| **ORM Model** | `backend/models/designation.py` → `Designation` |
| **Rows** | **2** |
| **Status** | Active |
| **PK** | `id` (BIGINT, autoincrement) |

**Columns:** Same structure as `departments` (id, code, name, parent_id, level, remarks, status).

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET/POST | `/common/getDesignations` | List designations |
| POST | `/common/saveDesignationDetails` | Upsert designation |
| POST | `/common/deleteDesignationDetails` | Delete designation |

---

### 7. `Master.locations`

| | |
|---|---|
| **ORM Model** | `backend/models/location.py` → `Location` |
| **Rows** | **0** |
| **Status** | Active (empty) |
| **PK** | `id` (BIGINT, autoincrement) |

**Columns:** Same structure as `departments` (no `code` column; id, name, parent_id, level, remarks, status).

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET | `/common/getLocations` | List locations |
| POST | `/common/saveLocationDetails` | Upsert location |
| POST | `/common/deleteLocationDetails` | Delete location |

---

### 8. `Master.units`

| | |
|---|---|
| **ORM Model** | `backend/models/unit.py` → `Unit` |
| **Rows** | **0** |
| **Status** | Active (empty) |
| **PK** | `id` (BIGINT, autoincrement) |

**Columns:** Same structure as `departments` (id, code, name, parent_id, level, remarks, status).

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET | `/common/getUnits` | List units |
| POST | `/common/saveUnitDetails` | Upsert unit |
| POST | `/common/SaveUnitBulkDetails` | Bulk upsert units |
| POST | `/common/deleteUnitDetails` | Delete unit |

---

### 9. `Master.lookups`

| | |
|---|---|
| **ORM Model** | `backend/models/lookup.py` → `Lookup` |
| **Rows** | **0** |
| **Status** | Active (empty) |
| **PK** | `id` (BIGINT, autoincrement) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | BIGINT | PK | Auto-increment |
| `lookup_type` | VARCHAR(100) | Yes | Category discriminator |
| `lookup_code` | VARCHAR(100) | Yes | Short code |
| `lookup_name` | VARCHAR(255) | Yes | Display name |
| `description` | VARCHAR(500) | Yes | Description |
| `status` | VARCHAR(10) | Yes | `"1"` = active |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| POST | `/common/getLookupDetails` | Get lookups by type |
| POST | `/common/saveLookupDetails` | Upsert lookup |
| POST | `/common/deleteLookupDetails` | Delete lookup |

---

### 10. `Master.master_records`

| | |
|---|---|
| **ORM Model** | `backend/models/master_record.py` → `MasterRecord` |
| **Rows** | **14** |
| **Status** | Active — EAV pattern table |
| **PK** | `id` (BIGINT, autoincrement) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | BIGINT | PK | Auto-increment |
| `entity` | VARCHAR(50) | No, indexed | Entity type discriminator |
| `data` | JSONB | No | Full PascalCase record stored verbatim |
| `status` | VARCHAR(10) | Yes | `"1"` = active, `"9"` = soft-deleted |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |

**Entity types stored (via `/common/*` endpoints):**

| Entity | API Endpoint | Description |
|--------|-------------|-------------|
| `Roles` | `/common/saveRoles` | Legacy roles (parallel to `Master.roles`) |
| `RoleRight` | `/common/saveRoleRightDetails` | Legacy role rights |
| `ModuleGroup` | `/common/saveModuleGroupDetails` | UI module groups |
| `Module` | `/common/saveModuleDetails` | UI modules (legacy) |
| `User` | `/common/saveUserDetails` | Master user directory records |
| `UserRole` | `/common/saveUserRoles` | User-role assignments |
| `Project` | `/common/saveProjectDetails` | Project master records |
| `ProjectDetails` | `/common/saveProjectDetailsData` | Project detail rows |
| `Contractor` | `/common/saveContractorDetails` | Contractor records |
| `Contract` | `/common/saveContractDetails` | Contract records |
| `Activity` | `/common/saveActivityDetails` | Activity records |
| `ActivityGroup` | `/common/saveActivityGroupDetails` | Activity groups |
| `VariationOrder` | `/common/saveVariationOrderData` | Variation orders |
| `MonthlyBreakup` | `/common/saveMonthlyBreakUpDetailsData` | Monthly breakup data |
| `ReferenceDocument` | `/common/saveDocuments` | Reference documents |
| `AutoNotification` | `/common/saveAutoNotificationDetails` | Auto notification rules |
| `UserLog` | `/common/saveUserLogDetails` | User activity logs |
| `ErrorLog` | `/common/getErrorLogs` | Error logs |

**Frontend Pages:**
- All master/admin panels under `/admin/*` (via `_helpers.py` → `mr_list`, `mr_save`, `mr_delete`)

---

## Schema: `public` — CCM Core Tables (17 Active)

### 11. `public.projects`

| | |
|---|---|
| **ORM Model** | `backend/models/project.py` → `Project` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `name` | VARCHAR(255) | No | Project name |
| `sharepoint_site_id` | VARCHAR(500) | Yes | SharePoint integration |
| `status` | VARCHAR(50) | No | Default `"active"` |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `project_metadata` | JSONB | Yes | Free-form enterprise metadata |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/{id}` | Get project |
| PUT | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project |

**FK References:**
- `inbound_letters.project_id` → `projects.id`
- `draft_responses.project_id` → `projects.id`
- `drafting_sessions.project_id` → `projects.id`
- `knowledge_documents.project_id` → `projects.id`
- `sharepoint_sync_log.project_id` → `projects.id`

**Frontend Pages:**
- Project Management panel (`/admin/projects-master`)
- CCM Letters panel (project filter)

---

### 12. `public.inbound_letters`

| | |
|---|---|
| **ORM Model** | `backend/models/letter.py` → `InboundLetter` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `filename` | VARCHAR(500) | No | Original filename |
| `raw_text` | TEXT | No | Full letter text |
| `intent` | TEXT | Yes | AI-extracted intent |
| `category` | VARCHAR(100) | Yes | AI classification category |
| `urgency` | VARCHAR(20) | Yes | AI-classified urgency level |
| `confidence_score` | FLOAT | Yes | AI classification confidence |
| `key_entities` | JSONB | Yes | AI-extracted entities |
| `status` | VARCHAR(50) | No | `new`, `classified`, `drafted`, `reviewed`, `sent` |
| `received_at` | TIMESTAMPTZ | No | Default `now()` |
| `project_id` | UUID | Yes | FK → `projects.id` |
| `created_by` | UUID | Yes | Soft FK (no constraint) |
| `updated_at` | TIMESTAMPTZ | No | Auto-updated |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET | `/api/letters` | List letters |
| POST | `/api/letters/upload` | Upload + classify letter |
| GET | `/api/letters/{id}` | Get letter details |
| DELETE | `/api/letters/{id}` | Delete letter |

**FK References:**
- `draft_responses.letter_id` → `inbound_letters.id` (CASCADE)
- `drafting_sessions.letter_id` → `inbound_letters.id` (SET NULL)

**Services:** `letter_intake.py` (upload + classification), `drafting.py` (uses letter text)

---

### 13. `public.draft_responses`

| | |
|---|---|
| **ORM Model** | `backend/models/draft.py` → `DraftResponse` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `letter_id` | UUID | No | FK → `inbound_letters.id` (CASCADE) |
| `draft_text` | TEXT | No | AI-generated draft content |
| `version` | INTEGER | No | Default `1`, incremented on regenerate |
| `status` | VARCHAR(50) | No | `pending_review`, `approved`, `rejected`, `sent` |
| `reviewer_notes` | TEXT | Yes | Reviewer comments |
| `feedback` | TEXT | Yes | Feedback for regeneration |
| `context_documents` | JSONB | Yes | KB documents used in RAG |
| `edited_by` | UUID | Yes | Soft FK |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `updated_at` | TIMESTAMPTZ | No | Auto-updated |
| `project_id` | UUID | Yes | FK → `projects.id` |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| POST | `/api/drafts/generate` | Generate draft for a letter |
| GET | `/api/drafts/{id}` | Get draft |
| PUT | `/api/drafts/{id}` | Edit draft |
| POST | `/api/review/{id}/approve` | Approve draft |
| POST | `/api/review/{id}/reject` | Reject draft |
| POST | `/api/review/{id}/send` | Send approved draft |

**Services:** `drafting.py` (generation), `review.py` (workflow)

---

### 14. `public.knowledge_documents`

| | |
|---|---|
| **ORM Model** | `backend/models/document.py` → `KnowledgeDocument` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `filename` | VARCHAR(500) | No | Original filename |
| `file_type` | VARCHAR(50) | No | MIME type or extension |
| `category` | VARCHAR(100) | No | `contract`, `letter`, `template`, `general` |
| `storage_path` | VARCHAR(500) | Yes | File storage path |
| `raw_text` | TEXT | Yes | Extracted text content |
| `chunk_count` | INTEGER | No | Default `0`, set after indexing |
| `status` | VARCHAR(50) | No | `processing`, `indexed`, `failed` |
| `uploaded_by` | UUID | Yes | Soft FK |
| `uploaded_at` | TIMESTAMPTZ | No | Default `now()` |
| `project_id` | UUID | Yes | FK → `projects.id` |
| `updated_at` | TIMESTAMPTZ | No | Auto-updated |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET | `/api/knowledge` | List KB documents |
| POST | `/api/knowledge/upload` | Upload + index document |
| GET | `/api/knowledge/{id}` | Get document details |
| DELETE | `/api/knowledge/{id}` | Delete document |

**Services:** `knowledge_base.py` (upload, extract, chunk, embed, search)

---

### 15. `public.document_chunks`

| | |
|---|---|
| **ORM Model** | `backend/models/document.py` → `DocumentChunk` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `document_id` | UUID | No | FK → `knowledge_documents.id` (CASCADE) |
| `chunk_index` | INTEGER | No | Position within document |
| `chunk_text` | TEXT | No | Text chunk content |
| `embedding` | FLOAT[] | Yes | Vector embedding (OpenAI `text-embedding-3-small`) |
| `metadata` | JSONB | Yes | Chunk metadata (page, section, etc.) |

**Services:** `knowledge_base.py` (created during indexing, queried during RAG search)

**Note:** `embedding` column stores raw float arrays. RAG search loads all embeddings into Python for cosine similarity (not using pgvector operators).

---

### 16. `public.drafting_sessions`

| | |
|---|---|
| **ORM Model** | `backend/models/drafting_session.py` → `DraftingSession` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `title` | VARCHAR(500) | No | Session title |
| `letter_id` | UUID | Yes | FK → `inbound_letters.id` (SET NULL) |
| `project_id` | UUID | Yes | FK → `projects.id` (SET NULL) |
| `is_pinned` | BOOLEAN | No | Default `false` |
| `created_by` | UUID | Yes | Soft FK |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `updated_at` | TIMESTAMPTZ | No | Auto-updated |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET | `/api/drafting-sessions` | List user sessions |
| POST | `/api/drafting-sessions` | Create session |
| GET | `/api/drafting-sessions/{id}` | Get session + messages |
| PATCH | `/api/drafting-sessions/{id}/pin` | Toggle pin |
| PATCH | `/api/drafting-sessions/{id}/title` | Rename session |
| DELETE | `/api/drafting-sessions/{id}` | Delete session |
| POST | `/api/drafting-sessions/{id}/messages` | Append message |

**Frontend:** AI Drafting panel — ChatGPT-style conversation UI

---

### 17. `public.drafting_messages`

| | |
|---|---|
| **ORM Model** | `backend/models/drafting_message.py` → `DraftingMessage` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `session_id` | UUID | No | FK → `drafting_sessions.id` (CASCADE) |
| `role` | VARCHAR(20) | No | `user` or `assistant` |
| `content` | TEXT | No | Message text |
| `draft_response_id` | UUID | Yes | Soft FK (no constraint) to `draft_responses.id` |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |

---

### 18. `public.prompt_templates`

| | |
|---|---|
| **ORM Model** | `backend/models/prompt_template.py` → `PromptTemplate` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `label` | VARCHAR(200) | No | Display label |
| `icon` | VARCHAR(50) | No | Icon class (default `ti-sparkles`) |
| `prompt_text` | TEXT | No | Prompt content |
| `display_order` | INTEGER | No | Sort order (default `0`) |
| `is_active` | BOOLEAN | No | Default `true` |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET | `/api/prompts` | List all templates |
| POST | `/api/prompts` | Create template |
| PUT | `/api/prompts/{id}` | Update template |
| DELETE | `/api/prompts/{id}` | Soft-delete template |
| POST | `/api/prompts/reorder` | Reorder templates |

**Note:** Currently unused by frontend — the AI Drafting panel uses hardcoded `LETTER_TYPE_PROMPTS` in `ai-drafting.js` instead.

---

## Schema: `public` — Utility Tables (4 Active)

### 19. `public.jobs`

| | |
|---|---|
| **ORM Model** | `backend/models/job.py` → `Job` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `job_type` | VARCHAR(100) | No | Task type (e.g. `classify_letter`, `generate_draft`) |
| `status` | VARCHAR(20) | No | `queued`, `running`, `completed`, `failed`, `cancelled` |
| `payload` | JSONB | No | Task arguments |
| `result` | JSONB | Yes | Task result |
| `error_message` | TEXT | Yes | Error details |
| `attempts` | INTEGER | No | Default `0` |
| `max_attempts` | INTEGER | No | Default `3` |
| `created_by` | UUID | No | FK → `Master.users.id` (SET NULL) |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `started_at` | TIMESTAMPTZ | Yes | When processing began |
| `completed_at` | TIMESTAMPTZ | Yes | When finished |
| `worker_id` | VARCHAR(100) | Yes | Worker identifier |
| `priority` | INTEGER | No | Default `0` (higher = more urgent) |

**Services:** `job_queue.py` (enqueue, process, track); runs inline when Redis unavailable

---

### 20. `public.audit_logs`

| | |
|---|---|
| **ORM Model** | `backend/models/audit.py` → `AuditEntry` |
| **Rows** | **0** |
| **Status** | Active (designed for future RANGE partitioning by `created_at`) |
| **PK** | `id` (BIGSERIAL) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | BIGSERIAL | PK | Auto-increment |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `user_id` | UUID | Yes | FK → `Master.users.id` (SET NULL) |
| `action` | TEXT | No | Action description |
| `entity_type` | VARCHAR(100) | No | Entity type (e.g. `letter`, `draft`) |
| `entity_id` | UUID | No | Entity UUID |
| `before_state` | JSONB | Yes | State before change |
| `after_state` | JSONB | Yes | State after change |
| `ip_address` | INET | Yes | Client IP |
| `user_agent` | TEXT | Yes | Browser user agent |
| `request_id` | UUID | Yes | Correlation ID |
| `details` | JSONB | Yes | Additional context |

**Services:** Written by `letter_intake.py`, `drafting.py`, `review.py`, `knowledge_base.py`

---

### 21. `public.files`

| | |
|---|---|
| **ORM Model** | `backend/models/file.py` → `FileRecord` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `original_filename` | VARCHAR(500) | No | Original name |
| `storage_key` | VARCHAR(500) | No, unique | Storage path/key |
| `content_type` | VARCHAR(100) | No | MIME type |
| `size_bytes` | BIGINT | No | File size |
| `checksum_sha256` | VARCHAR(64) | No | SHA-256 hex hash |
| `storage_backend` | VARCHAR(20) | No | `local` or `s3` |
| `uploaded_by` | UUID | No | FK → `Master.users.id` (SET NULL) |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `deleted_at` | TIMESTAMPTZ | Yes | Soft delete timestamp |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET | `/api/files` | List files |
| POST | `/api/files/upload` | Upload file |
| GET | `/api/files/{id}` | Get file metadata |
| DELETE | `/api/files/{id}` | Soft-delete file |

---

### 22. `public.email_notification_settings`

| | |
|---|---|
| **ORM Model** | `backend/models/email_notification.py` → `EmailNotificationSetting` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `user_id` (UUID, FK) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `user_id` | UUID | PK, FK | → `Master.users.id` (CASCADE) |
| `on_review_needed` | BOOLEAN | No | Default `true` |
| `on_draft_approved` | BOOLEAN | No | Default `true` |
| `on_draft_rejected` | BOOLEAN | No | Default `true` |
| `on_letter_assigned` | BOOLEAN | No | Default `true` |
| `updated_at` | TIMESTAMPTZ | No | Auto-updated |

**Services:** Read by `review.py` to determine email recipients

---

## Schema: `public` — Auth & Security Tables (3 Active)

### 23. `public.revoked_tokens`

| | |
|---|---|
| **ORM Model** | `backend/models/revoked_token.py` → `RevokedToken` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `jti` | UUID | No, unique | JWT ID claim |
| `expires_at` | TIMESTAMPTZ | No | Token expiry |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |

**Services:** Checked during JWT refresh token validation

---

### 24. `public.password_reset_tokens`

| | |
|---|---|
| **ORM Model** | `backend/models/password_reset.py` → `PasswordResetToken` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `user_id` | UUID | No | FK → `Master.users.id` (CASCADE) |
| `token_hash` | VARCHAR(255) | No | Hashed reset token |
| `expires_at` | TIMESTAMPTZ | No | Token expiry |
| `used` | BOOLEAN | No | Default `false` |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |

---

### 25. `public.webhooks`

| | |
|---|---|
| **ORM Model** | `backend/models/webhook.py` → `Webhook` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `url` | VARCHAR(500) | No | Webhook target URL |
| `secret` | TEXT | No | Encrypted signing secret |
| `events` | VARCHAR(50)[] | No | Array of subscribed events |
| `is_active` | BOOLEAN | No | Default `true` |
| `created_by` | UUID | No | FK → `Master.users.id` (SET NULL) |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `last_triggered_at` | TIMESTAMPTZ | Yes | Last delivery timestamp |
| `failure_count` | INTEGER | No | Default `0` |

**API Endpoints:**

| Method | Endpoint | Operation |
|--------|----------|-----------|
| GET | `/api/webhooks` | List webhooks |
| POST | `/api/webhooks` | Create webhook |
| PUT | `/api/webhooks/{id}` | Update webhook |
| DELETE | `/api/webhooks/{id}` | Delete webhook |
| POST | `/api/webhooks/{id}/test` | Test webhook |

---

### 26. `public.webhook_deliveries`

| | |
|---|---|
| **ORM Model** | `backend/models/webhook.py` → `WebhookDelivery` |
| **Rows** | **0** |
| **Status** | Active |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `webhook_id` | UUID | No | FK → `webhooks.id` (CASCADE) |
| `event` | VARCHAR(50) | No | Event name |
| `payload` | JSONB | No | Full event payload |
| `response_status` | INTEGER | Yes | HTTP response code |
| `response_body` | TEXT | Yes | Response body |
| `duration_ms` | INTEGER | Yes | Request duration |
| `delivered_at` | TIMESTAMPTZ | No | Default `now()` |
| `success` | BOOLEAN | No | Delivery success flag |

---

### 27. `public.sharepoint_sync_log`

| | |
|---|---|
| **ORM Model** | `backend/models/sharepoint_sync.py` → `SharePointSyncLog` |
| **Rows** | **0** |
| **Status** | Active (SharePoint integration not configured) |
| **PK** | `id` (UUID) |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | PK | `uuid.uuid4` default |
| `project_id` | UUID | No | FK → `projects.id` (CASCADE) |
| `sync_status` | VARCHAR(50) | No | `running`, `completed`, `failed` |
| `files_synced` | INTEGER | Yes | Count of synced files |
| `files_deleted` | INTEGER | Yes | Count of deleted files |
| `error_message` | TEXT | Yes | Error details |
| `last_synced_at` | TIMESTAMPTZ | No | Default `now()` |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |

**Services:** `sharepoint_sync.py` (Microsoft Graph API integration)

---

## Schema: `public` — Legacy/Orphaned Tables (14)

> These tables are remnants of the old master-data schema. Data was migrated to `Master` schema tables via migration 001. **All are empty (0 rows)** and safe to drop via migration 002.

| # | Table | Replaced By | Notes |
|---|-------|-------------|-------|
| 28 | `master_department` | `Master.departments` | Legacy department records |
| 29 | `master_designation` | `Master.designations` | Legacy designation records |
| 30 | `master_location` | `Master.locations` | Legacy location records |
| 31 | `master_unit` | `Master.units` | Legacy unit records |
| 32 | `master_lookup` | `Master.lookups` | Legacy lookup records |
| 33 | `master_module` | `Master.modules` + `Master.master_records` | Legacy UI module records |
| 34 | `master_module_group` | `Master.master_records` (entity=`ModuleGroup`) | Legacy module group records |
| 35 | `master_project` | `Master.master_records` (entity=`Project`) | Legacy project records |
| 36 | `master_project_details` | `Master.master_records` (entity=`ProjectDetails`) | Legacy project detail records |
| 37 | `master_role` | `Master.roles` | Legacy role records |
| 38 | `master_role_right` | `Master.role_permissions` + `Master.master_records` | Legacy role right records |
| 39 | `master_user` | `Master.users` | Legacy user records |
| 40 | `master_user_role` | `Master.master_records` (entity=`UserRole`) | Legacy user-role assignments |

**Migration:** `_002_drop_master_tables.py` (not yet run)

---

### 41. `public.alembic_version`

| | |
|---|---|
| **ORM Model** | None (Alembic internal) |
| **Rows** | **2** |
| **Status** | System — do not modify |

**Columns:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `version_num` | VARCHAR(32) | PK | Migration version hash |

---

## Cross-Reference: Table → API → Frontend

### Master Schema Tables

| Table | API Router | Frontend Panel |
|-------|-----------|----------------|
| `Master.users` | `auth.py`, `users.py` | Login, User Management |
| `Master.roles` | `_001_roles.py`, `users.py` | Role Management |
| `Master.modules` | `_001_roles.py`, `modules.py` | Module Management |
| `Master.role_permissions` | `_001_roles.py` | Role Management (matrix) |
| `Master.departments` | `common.py` | Department Management |
| `Master.designations` | `common.py` | Designation Management |
| `Master.locations` | `common.py` | Location Management |
| `Master.units` | `common.py` | Unit Management |
| `Master.lookups` | `common.py` | Lookup Management |
| `Master.master_records` | All `_helpers.py` consumers | All EAV-backed panels |

### CCM Core Tables

| Table | API Router | Service Layer | Frontend Panel |
|-------|-----------|---------------|----------------|
| `projects` | `projects.py` | — | Projects |
| `inbound_letters` | `letters.py` | `letter_intake.py` | Letters |
| `draft_responses` | `drafts.py`, `review.py` | `drafting.py`, `review.py` | Drafts, Review |
| `knowledge_documents` | `knowledge.py` | `knowledge_base.py` | Knowledge Base |
| `document_chunks` | — (internal) | `knowledge_base.py` | — |
| `drafting_sessions` | `drafting_sessions.py` | `drafting_sessions.py` | AI Drafting |
| `drafting_messages` | `drafting_sessions.py` | `drafting_sessions.py` | AI Drafting |
| `prompt_templates` | `prompts.py` | — | AI Drafting (unused) |
| `jobs` | `metrics.py` | `job_queue.py` | Metrics |
| `audit_logs` | — (write-only) | Multiple services | — |
| `files` | `files.py` | `storage.py` | Files |
| `email_notification_settings` | — (internal) | `review.py` | — |
| `revoked_tokens` | `auth.py` | — | — |
| `password_reset_tokens` | `auth.py` | — | — |
| `webhooks` | `webhooks.py` | `webhook_service.py` | Webhooks |
| `webhook_deliveries` | `webhooks.py` | `webhook_service.py` | Webhooks (log) |
| `sharepoint_sync_log` | — (internal) | `sharepoint_sync.py` | — |

---

## Architectural Notes

1. **Dual data systems**: Two parallel mechanisms store master data — dedicated ORM models (`departments`, `locations`, `designations`, `units`, `lookups`) AND the `master_records` EAV table. Entities with dedicated tables use those; entities without dedicated tables (contractors, contracts, activities, etc.) use the EAV pattern.

2. **Soft FK pattern**: `created_by` and `edited_by` columns on `inbound_letters`, `knowledge_documents`, `drafting_messages`, and `draft_responses` store UUIDs referencing other tables but have **no declared ForeignKey constraint**.

3. **Hierarchical master data**: `Department`, `Designation`, `Unit`, and `Location` share the same structure (id, code, name, parent_id, level, remarks, status) with self-referencing `parent_id` columns that are **not** declared as foreign keys.

4. **RAG search is in-Python**: `search_similar_chunks()` loads all embeddings into Python memory and computes cosine similarity client-side rather than using pgvector's native vector operators. Will not scale with large document sets.

5. **Audit partitioning intent**: `AuditEntry` (audit_logs) is designed for future RANGE partitioning by `created_at` (monthly), as noted in its docstring.

6. **Background jobs**: When Redis is unavailable, jobs run inline in the same process via `_run_job_inline()`. Letter classification and draft generation are synchronous in this mode.

7. **File upload stubs**: Master attachment endpoints accept files but only read them for size — they do not persist to storage. The CCM-side `files.py` and `letters.py` use the real `storage_backend`.

8. **Hardcoded prompts**: The AI Drafting panel uses 36 hardcoded prompts in `ai-drafting.js` (`LETTER_TYPE_PROMPTS`) rather than the `prompt_templates` database table, which remains empty.
