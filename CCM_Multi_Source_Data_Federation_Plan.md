# Multi-Source Project Data Federation Plan for CCM AI Drafting

**Document type:** Architecture / planning only (no implementation)  
**Audience:** Product, engineering, IT/security  
**Grounded in:** Current CCM codebase under `Downloads/CCM` (FastAPI + React, PostgreSQL/pgvector RAG, existing SharePoint sync stub)

---

## Current-state baseline (from CCM analysis)

Before proposing new architecture, these facts from the codebase constrain the plan:

| Area | What exists today | Gap vs. federation goal |
|------|-------------------|-------------------------|
| RAG draft path | `drafting.py` → `search_similar_chunks(..., project_id=letter.project_id)` | Project scoping exists; **source federation does not** |
| KB pipeline | Upload → extract → word-chunk → embed → `document_chunks` | Manual upload only; **no clause-aware chunking** |
| SharePoint | `services/sharepoint_sync.py` + `sharepoint_sync_log` + worker task | Stub: static token, no delta API, **does not set `project_id` on ingest**, no ACL check, root-folder only |
| Project config | Dual model: `projects.sharepoint_site_id` (CCM) and `Master.project_master.project_data_source` (UI field labeled “SharePoint Link”) | No `source_type`, no credential store, no local/EDMS types |
| Access control | Module RBAC + `uploaded_by` filter on KB search for non-admins | **Not project membership**; Master `user_access_filters` unused by RAG |
| Sync | Polling-style SharePoint job | No webhooks, no local agent, no EDMS connectors |

**Implication:** Federation should extend the existing connector-shaped SharePoint path and the existing project-scoped vector index — not replace the RAG core.

---

## 1. Source abstraction layer design

### Recommended pattern

**Connector / Adapter pattern** behind a single **Project Source Gateway**.

```
Draft / Sync jobs
       │
       ▼
┌──────────────────────────┐
│  ProjectSourceGateway    │  resolve(project_id) → connector + config
└────────────┬─────────────┘
             │
    ┌────────┼────────┬────────────────┐
    ▼        ▼        ▼                ▼
 LocalFS   SharePoint  EdmsVendorA   ManualUpload
 Connector Connector   Connector     Connector
    │        │        │                │
    └────────┴────────┴────────────────┘
                     │
                     ▼
           NormalizedDocumentEvent
           → Ingestion Pipeline → KB (tagged project_id)
```

Connectors never talk to OpenAI or the vector store. They only produce a **normalized document event** that the existing ingestion path (`extract → chunk → embed → store`) consumes.

### Common connector interface (contract)

Every connector implements the same capability surface. Capabilities that a source cannot support return explicit `Unsupported` / degraded modes rather than silent no-ops.

| Method | Purpose | Required? |
|--------|---------|-----------|
| `health_check()` | Connectivity + auth validity | Yes |
| `list_documents(cursor?, filters?)` | Enumerate letters / contracts / attachments | Yes |
| `fetch_document(external_id)` | Bytes + content type | Yes |
| `fetch_metadata(external_id)` | Path, title, modified, size, doc type, checksum | Yes |
| `detect_changes(since_token)` → `(added, modified, deleted, next_token)` | Incremental sync | Preferred; poll fallback if absent |
| `check_user_permission(user_identity, external_id \| project_scope)` | Gate before content enters AI context | Yes for sources with ACLs; policy decision for local FS |
| `resolve_document_type(metadata)` | Map to CCM categories: `inbound_letter`, `outbound_letter`, `contract_volume`, `clause_pack`, `other` | Yes |
| `supports` flags | `{delta, webhooks, recursive_list, acl_query}` | Yes (capability discovery) |

### Normalized document event (canonical shape)

```text
NormalizedDocumentEvent:
  project_id          UUID          # CCM projects.id
  source_type         enum          # local_fs | sharepoint | edms | manual
  external_id         string        # stable ID in source system
  content_hash        string        # sha256 of bytes
  filename            string
  mime_type           string
  doc_category        enum          # letter_in | letter_out | contract | clause | other
  modified_at         datetime
  source_path         string        # UNC / Graph path / EDMS URI
  acl_snapshot        json?         # optional; for audit / re-check
  change_type         enum          # upsert | delete
  sync_cursor_hint    string?       # opaque token fragment for connector
  raw_bytes_ref       storage_key?  # after fetch into MinIO/S3 staging
```

### Design options for where connectors live

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. In-process adapters** (extend current `sharepoint_sync.py` style) | Connectors as Python modules in CCM backend / ARQ workers | Fastest; reuses jobs, logging, config | Couples CCM deploy to every EDMS SDK; secrets in app env |
| **B. Sidecar sync agents** per source class | Agents push NormalizedDocumentEvents into CCM ingest API | Isolates network drives / EDMS VPN; better for local FS | Ops overhead; more moving parts |
| **C. Hybrid (recommended starting point)** | SharePoint + Manual in-process; Local FS via site agent; EDMS in-process *if* API, else agent/export | Matches real constraints without big-bang | Two deployment modes to document |

**Decision needed:** A vs B vs C (see §9).

---

## 2. Project-to-source mapping

### Registry model

Introduce a first-class **project source binding** rather than overloading `sharepoint_site_id` or free-text `ProjectDataSource`.

Suggested logical tables (names illustrative):

**`project_sources`** (1:1 or 1:N per project if multiple libraries needed)

| Column | Notes |
|--------|-------|
| `id` | PK |
| `project_id` | FK → `projects.id` |
| `source_type` | `local_fs` \| `sharepoint` \| `edms` \| `manual` |
| `display_name` | e.g. “Contract volumes – SP library” |
| `connection_config` | Non-secret JSON: site URL, folder path, EDMS base URL, include globs, doc-type rules |
| `secret_ref` | Pointer into secret store (not the secret itself) |
| `sync_mode` | `webhook` \| `delta_poll` \| `full_poll` \| `manual_only` |
| `sync_cursor` | Opaque delta token / watermark |
| `last_sync_at`, `last_sync_status`, `last_error` | Operational |
| `is_active` | Soft disable without deleting mapping |
| `capability_flags` | Cached from connector `supports` |

**`project_source_credentials`** — *do not store raw secrets in Postgres plaintext.*

### Connection details by source type (non-secret vs secret)

| Source | Non-secret config | Secret |
|--------|-------------------|--------|
| Local FS | UNC/mount path, include/exclude patterns, agent_id | Agent registration token |
| SharePoint | tenant_id, site_id / site URL, drive_id, folder path, library name | App client secret or cert (prefer cert); optional per-site if using delegated |
| EDMS | vendor, base_url, project/workspace key, API version | API key / client credentials / mTLS cert |
| Manual | none | n/a |

### Credential storage options

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **1. Cloud/enterprise secret store** (Azure Key Vault / HashiCorp Vault / AWS Secrets Manager) + `secret_ref` | Industry standard; rotation; audit | Requires infra; IT dependency |
| **2. Encrypted column** (app KEK in env, envelope encryption in DB) | Works without Vault day-one | Key management still on CCM; weaker than Vault |
| **3. Env-level shared app credentials only** (current SharePoint token pattern) | Simple | Cannot isolate per-project tenants; current stub’s weakness |

**Recommendation for planning:** Option **1** for production; Option **2** acceptable interim for Phase 1 SharePoint app-only credentials shared across projects in one tenant.

### Dual project tables today

CCM currently has:

- `projects` — drives KB / SharePoint sync (`sharepoint_site_id`)
- `Master.project_master` — enterprise master UI (`project_data_source` text URL)

**Options:**

| Option | Trade-off |
|--------|-----------|
| **Unify:** Master project creates/links a CCM `projects` row; source binding lives only on CCM side | Cleaner for AI pipeline; migration of IDs |
| **Bridge table:** `project_master.id` ↔ `projects.id` + keep master URL as display until binding wizard completes | Less disruptive; temporary dual write |
| **Keep dual write forever** | Avoid — already causing SharePoint URL vs site_id confusion |

---

## 3. Per-source connector plan

### 3.1 Local file system / network drives

#### Access options

| Option | How it works | Pros | Cons |
|--------|--------------|------|------|
| **Mounted network drive on sync host** | Backend/agent reads `\\fileserver\projects\{code}\...` | Familiar to ops | Availability, ACL opacity, no change events, path fragility |
| **Scheduled sync agent on-prem** | Lightweight agent on a jump host with drive access; pushes files/hashes to CCM ingest API | Keeps secrets/network inside corp; CCM cloud-friendly | Agent fleet management |
| **Mandatory upload / staging folder** | Project team drops exports into CCM “Inbox” (S3/MinIO) | Reliable for AI; clear ownership | Not “live” source of truth; human process |

#### Production risks (must be explicit to stakeholders)

- **Availability:** VPN flaps, DFS delays, locked Excel/Word files → stale or failed sync.
- **No API / no reliable delta:** Must rely on walk + mtime/size/hash; expensive and race-prone.
- **Permissions:** OS ACLs are hard to map to CCM users; agents often run as a service account that can see *more* than the drafter — **ACL enforcement must happen in CCM project membership**, not by trusting the mount.
- **Auditability:** Harder to prove what the model saw vs. what was on disk at time T.
- **Malware:** ClamAV already in stack — keep scanning on ingest.

**Planning stance:** Treat local FS as a **Phase 2–3** source with **agent + hash watermark** sync, and prefer **manual/staging** for projects that cannot justify agent ops.

### 3.2 SharePoint

Build on existing `sharepoint_sync.py`, but upgrade the design:

| Concern | Plan |
|---------|------|
| Auth | Microsoft Graph **app-only** (client credentials) with certificate preferred over long-lived static `SHAREPOINT_ACCESS_TOKEN` |
| List / fetch | Site → Drive → folder hierarchy (recursive); store Graph `item.id` as `external_id` |
| Incremental sync | **Delta query** (`/drives/{id}/root/delta`) persist `sync_cursor` on `project_sources` |
| Deletes | Delta delete markers → soft-delete or hard-delete KB docs + chunks |
| Permissions | Before indexing *or* before retrieval: use Graph permissions APIs / effective access for the **user’s Azure OID** (CCM already has Azure SSO JIT). Options below |
| Mapping UI | Replace free-text “SharePoint Link” with wizard: paste URL → resolve site/drive IDs → test connection → save binding |

#### SharePoint permission options

| Option | When enforced | Pros | Cons |
|--------|---------------|------|------|
| **Index-time filter** | Only ingest items the sync identity can read (app has Sites.Selected) | Simple | App identity ≠ user; over-ingests relative to users |
| **Query-time ACL check** | At draft time, filter retrieved chunk `external_id`s via Graph “can user read?” | Strongest fidelity | Latency, throttling, complexity |
| **Project membership proxy** | Trust CCM project membership as the ACL boundary; Sites.Selected limits library | Fits CCM multi-tenant project model | Weaker if SP ACLs finer than project |
| **Hybrid** | Sites.Selected + CCM project membership + optional per-doc deny list | Practical enterprise default | Not perfect SP fidelity |

**Decision needed:** ACL fidelity vs. latency (§9).

### 3.3 Custom EDMS

#### Minimum requirements to support a vendor natively

1. **REST (or well-documented SOAP) API** for list + download by document ID  
2. **Stable document IDs** and **last-modified** or version number  
3. **Auth:** OAuth2 client credentials, API key, or mTLS — documented  
4. **Change notification (preferred):** webhooks / event bus; else accept poll interval SLA  
5. **Permission API or group mapping** to CCM users (or agree project-membership proxy)

#### Per-vendor connector strategy

| Approach | Trade-off |
|----------|-----------|
| **One connector per vendor** (`EdmsAconexConnector`, `EdmsAsiteConnector`, …) | Best UX; cost scales with vendors |
| **Generic HTTP EDMS connector** driven by JSON mapping templates | Faster coverage; brittle for quirky APIs |
| **Vendor-supplied export** only | Lowest eng cost; weakest sync |

#### Fallback when no API

| Fallback | Description | Trade-off |
|----------|-------------|-----------|
| Scheduled export package | Nightly zip/CSV+PDF drop to S3 staging → Manual/Local connector | Stale by up to export interval |
| RPA / UI scrape | Generally **discourage** for production AI grounding | Fragile, ToS/security risk |
| Require IT API exposure | Gate “EDMS-connected” project status on API readiness | May block some projects; honest |

**Do not** promise uniform real-time sync across all EDMS vendors in Phase 1.

---

## 4. Ingestion & indexing pipeline

### Unified flow (source-agnostic)

```
Connector detect_changes / fetch
        │
        ▼
 Stage bytes → MinIO/S3 (existing storage_backend)
        │
        ▼
 Virus scan (ClamAV, existing)
        │
        ▼
 Text extraction (existing: PDF/DOCX/images via pymupdf / python-docx / vision)
        │
        ▼
 Structure-aware normalize (NEW: letters vs contracts)
        │
        ▼
 Chunking strategy by doc_category (NEW)
        │
        ▼
 Embeddings (existing: text-embedding-3-small)
        │
        ▼
 Upsert knowledge_documents + document_chunks
   metadata MUST include:
     project_id, source_type, external_id, content_hash,
     doc_category, clause_id?, clause_path?, source_path
        │
        ▼
 Update project_sources.sync_cursor + sync_log (generalize sharepoint_sync_log)
```

### Fixes required relative to current code

- SharePoint ingest today does **not** set `project_id` on `KnowledgeDocument` — federation is unsafe until every ingest path requires `project_id`.
- Non-admin KB search filters by `uploaded_by` — wrong for shared project corpora; replace with **project membership** checks.
- Word-based `chunk_text()` breaks contractual clause boundaries.

### Clause-preserving chunking (contracts)

**Problem:** Fixed word windows split mid-clause, so retrieval returns orphaned fragments without clause IDs.

**Proposed approach (options):**

| Option | Method | Pros | Cons |
|--------|--------|------|------|
| **A. Structure-first chunking** | Detect headings / numbering (`1.2.3`, `Clause 14.1`, Article patterns); one chunk per leaf clause; large clauses split with **overlap that repeats clause header + ID** | Preserves references | Needs parser tuning per contract style |
| **B. Hierarchical parent-child** | Parent = clause unit embedded lightly; children = sub-chunks; retrieve child, expand parent into prompt | Best quality | More complex retrieval |
| **C. Metadata-only clause tags** | Keep word chunks but regex-tag `clause_id` into `document_chunks.metadata` | Cheap | Still splits text awkwardly |
| **D. Hybrid (recommended)** | A for well-structured volumes; B when clause > token budget; C as fallback for poor OCR | Practical | Multiple code paths |

**Chunk metadata minimum for contracts:**

```text
clause_id, clause_title, parent_clause_id, volume_name,
page_start, page_end, source_type, external_id, project_id
```

**Letters:** Prefer whole-letter or section chunks (header / body / claims / deadlines) rather than clause logic.

### Vector storage

Keep **PostgreSQL + pgvector** (already in CCM). Always filter:

```sql
WHERE knowledge_documents.project_id = :project_id
  AND knowledge_documents.status = 'indexed'
  -- optional: doc_category IN (...)
```

Optional later: separate collections / partitions per project for scale — not required initially.

---

## 5. Sync strategy

### Per source type

| Source | Preferred | Fallback | Notes |
|--------|-----------|----------|-------|
| SharePoint | Graph **delta** on schedule (e.g. 5–15 min) + optional Graph change notifications | Full crawl weekly reconciliation | Fits existing ARQ `sharepoint_sync_task` |
| Local FS | Agent push on filesystem watcher **or** scheduled hash walk | Nightly full walk | Watcher unreliable on network shares — plan for hash walk |
| EDMS with webhooks | Event → CCM ingest webhook (HMAC, reuse webhook patterns) | Poll `modified_since` | Verify webhook authenticity |
| EDMS without events | Poll interval agreed per vendor (15–60 min) | Daily export drop | Document SLA per project |
| Manual | User upload triggers index job (existing) | n/a | Always available as safety net |

### Conflict handling

| Scenario | Policy options |
|----------|----------------|
| Same `external_id`, newer `modified_at` / hash | **Upsert** (replace chunks); keep version history optional |
| Same filename, different `external_id` | Treat as distinct docs; do not delete by filename alone (current SharePoint code deletes by filename — **risk**) |
| Source says deleted | Soft-delete KB doc (hide from retrieval) vs hard-delete; soft preferred for audit |
| Concurrent sync runs | Per-project sync lock (Redis/DB advisory lock) |
| User-edited CCM-only copy vs source | Source wins for federated docs; mark `origin=federated` immutable except by sync |

### Unreachable source

| Behavior | Description |
|----------|-------------|
| **Fail-open on draft with stale KB** | Draft proceeds on last successful index; banner: “Source unreachable; context as of T” | Fast; risk of outdated clauses |
| **Fail-closed** | Block draft generation if sync stale beyond SLA | Safest legally; UX friction |
| **Degraded** | Allow draft but require reviewer acknowledgment of staleness | Balanced |

**Recommendation for planning:** Degraded mode with configurable per-project SLA (e.g. warn at 24h, block at 7d for contract-critical projects).

### Observability

Generalize `sharepoint_sync_log` → `source_sync_runs` with `source_type`, counts, cursor, errors; surface on project stats UI (endpoint already sketches sync-logs).

---

## 6. Access control at query time

### Draft-time gate (before any retrieval)

```
User attaches letter + requests draft
        │
        ▼
(1) Resolve project_id for this letter
        │
        ▼
(2) Authorize: user ∈ project members (or RBAC admin)
        │
        ▼
(3) Load project_sources binding(s); ensure source status ≠ blocked
        │
        ▼
(4) Optional source ACL re-check (SharePoint/EDMS policy)
        │
        ▼
(5) search_similar_chunks(project_id=..., filters...)
        │
        ▼
(6) Generate draft with grounded context only
```

### (a) Which project does the letter belong to?

| Option | Mechanism | Pros | Cons |
|--------|-----------|------|------|
| **Explicit on upload** | Require `project_id` in `POST /api/letters/upload` | Clear, auditable | Extra UI step |
| **Infer from metadata** | Letterhead / project code / filename conventions / classifier entities | Fast UX | Error-prone; needs confidence threshold |
| **Infer from session** | Drafting session already has `project_id` | Natural in chat UI | Weak if letter uploaded outside session |
| **Hybrid (recommended)** | Require explicit project; optionally *pre-fill* from inference with user confirm | Safety + UX | Slightly more UI work |

Today `inbound_letters.project_id` is nullable — federation should make it **required** for AI draft generation.

### (b) Which data source?

Lookup `project_sources` where `project_id` + `is_active`. Multiple bindings (e.g. SP for letters + EDMS for contracts) → retrieve across all bindings **for that project only**, optionally weighted by `doc_category`.

### (c) User permission

| Layer | Role |
|-------|------|
| **CCM module RBAC** | Can user use drafts/knowledge modules? (existing) |
| **Project membership** | New (or wire `Master.user_access_filters` where `FilterType=project`) |
| **Source ACL** | Optional Graph/EDMS check per policy |

Replace KB `uploaded_by == user_id` scoping for project corpora — that model assumes personal uploads, not shared project memory.

---

## 7. Migration path / phased rollout

### Phase 0 — Foundations (prerequisite)

- Project source registry + secret_ref pattern  
- Force `project_id` on ingest + draft retrieval  
- Project membership authorization for RAG  
- Fix SharePoint ingest to tag `project_id`; stop filename-only deletion  
- Manual upload remains fully supported  

**Exit criteria:** No cross-project leakage in retrieval tests; every indexed doc has `project_id` + `source_type`.

### Phase 1 — SharePoint first (recommended first connector)

**Why first:** Partial connector exists; Graph is standardized; many projects already paste SP links in Project Master UI.

- Proper app-only auth + delta sync  
- Binding wizard from Project Master “Data Source”  
- Sync logs + degraded draft behavior  
- Onboard pilot projects with clean SP libraries  

**Fallback for non-SP projects:** Manual KB upload / staging inbox.

### Phase 2 — Manual + staging formalized as a source type

- `source_type=manual` explicit  
- Optional “project inbox” folder in MinIO with watch/index  
- Onboard projects blocked on EDMS/local with clear interim UX  

### Phase 3 — Local FS via on-prem agent

- Only for projects that sign off on risk register (§3.1)  
- Hash-based sync + ClamAV  

### Phase 4 — EDMS connectors (vendor-by-vendor)

- Prioritize by project volume × API readiness  
- Non-API EDMS stay on export → staging  

### Incremental onboarding playbook (per project)

1. Create/link CCM project + membership  
2. Choose source type; run connection test  
3. Initial full crawl → index  
4. Enable scheduled sync  
5. Pilot 5–10 draft generations with reviewer scoring  
6. Mark project `federation_status=connected`  

### Fallback when source not connected

| Behavior | Recommendation |
|----------|----------------|
| Allow drafts on manually uploaded KB only | **Yes** — default |
| Block drafts until source connected | Optional strict mode per org |
| Show UI badge “Context: Manual only / Federated / Stale” | **Yes** |

---

## 8. Multi-project users

### Disambiguation options

| Option | How | Pros | Cons |
|--------|-----|------|------|
| **1. Explicit project selection (required)** | Dropdown / project switcher before draft | Zero ambiguity; simplest security | Extra click; users may pick wrong project |
| **2. Infer from attached letter** | Metadata, project code, prior letters, classifier | Smooth UX | Mis-inference → wrong contract grounding (high severity) |
| **3. Infer from active workspace** | Last-selected project sticky in UI | Low friction | Stale context if user switches mentally |
| **4. Soft infer + hard confirm** | System proposes project; user confirms if multi-project or confidence < threshold | Best balance | Needs confidence UX |
| **5. Search union of all user projects** | Retrieve across all memberships | “Helpful” | **Unacceptable** for CCM — cross-project leakage / wrong T&Cs |

**Recommendation for planning:** **Option 4** (or strict **Option 1** if legal prefers). Never Option 5.

### Trade-off summary

- **Safety-critical domain (contracts):** bias toward explicit selection.  
- **High-volume correspondence:** bias toward infer-and-confirm.  
- Multi-project admins: always explicit.

Wire this into upload + drafting-session creation (`project_id` already exists on sessions).

---

## 9. Risks & open questions

### Decisions required before implementation

1. **Connector deployment model:** in-process vs sidecar agents vs hybrid (§1)?  
2. **Secret store:** Vault/Key Vault vs encrypted DB columns vs shared app credentials (§2)?  
3. **Unify `projects` vs `project_master`:** bridge vs merge (§2)?  
4. **SharePoint ACL fidelity:** project-membership proxy vs query-time Graph checks (§3.2)?  
5. **Local FS in production:** allowed with agent, staging-only, or out of scope (§3.1)?  
6. **EDMS inventory:** which vendors, which have APIs, who funds per-vendor connectors (§3.3)?  
7. **Staleness policy:** warn vs block when source unreachable (§5)?  
8. **Clause chunking investment:** structure-first vs hybrid vs postpone (§4)?  
9. **Project membership source of truth:** new CCM table vs existing `user_access_filters` (§6)?  
10. **Multi-project UX:** mandatory select vs infer-and-confirm (§8)?  
11. **IT capacity:** who builds/maintains on-prem agents and EDMS credentials rotation?  
12. **Compliance:** is storing document text + embeddings in CCM’s Postgres acceptable for all source systems’ data residency policies?  
13. **Sites.Selected admin process:** is there an IT runbook to grant the CCM app access per SharePoint site?  
14. **Tolerance for filename-based identity:** migrate to `external_id` as sole identity key?

### Technical risks (observed in current CCM)

| Risk | Severity | Note |
|------|----------|------|
| SharePoint ingest omits `project_id` | **Critical** | Cross-project / unscoped KB pollution |
| Delete-by-filename on sync | High | Can wipe unrelated docs |
| `uploaded_by` filter on search | High | Breaks shared project KB; wrong security model |
| Static Graph token | High | Rotation / blast radius |
| Dual SharePoint fields (site_id vs URL text) | Medium | Onboarding confusion |
| Word chunking on contracts | Medium | Weak clause citation quality |
| Nullable `letter.project_id` | Medium | Ungrounded drafts |

### Organizational risks

- Underestimating **N EDMS connectors** as N projects of work  
- Political resistance to agents on network shares  
- Expectation that federation means **zero** manual upload — unrealistic in Phase 1–2  

---

## Architecture diagram (target)

```
┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────┐
│ Local Agent │  │ Microsoft    │  │ EDMS APIs   │  │ Manual UI  │
│ (optional)  │  │ Graph / SP   │  │ (per vendor)│  │ Upload     │
└──────┬──────┘  └──────┬───────┘  └──────┬──────┘  └─────┬──────┘
       │                │                 │               │
       └────────────────┴────────┬────────┴───────────────┘
                                 ▼
                    ProjectSourceGateway + Connectors
                                 │
                                 ▼
                    Normalize → Scan → Extract → Clause-aware Chunk
                                 │
                                 ▼
                    PostgreSQL knowledge_documents / document_chunks
                    (pgvector, mandatory project_id + source metadata)
                                 │
                                 ▼
              Draft request → Resolve project → AuthZ → Scoped RAG → LLM
```

---

## Suggested decision checklist (for stakeholders)

- [ ] Approve **hybrid connector** deployment (in-process SP + manual; agents for local)  
- [ ] Approve **SharePoint-first** Phase 1  
- [ ] Choose secret store approach  
- [ ] Choose ACL model for SharePoint  
- [ ] Choose multi-project disambiguation UX  
- [ ] Choose stale-source draft policy  
- [ ] Produce EDMS vendor inventory + API readiness  
- [ ] Confirm local FS risk acceptance or staging-only  

---

## Appendix — Mapping plan sections to CCM code touchpoints (for later implementation)

| Plan area | Existing artifacts |
|-----------|-------------------|
| Gateway / connectors | Extend `services/sharepoint_sync.py`; new package `services/connectors/` |
| Registry | New models alongside `models/project.py`; evolve UI field in `project-master.js` |
| Ingest | `services/knowledge_base.py` (`ingest_document`, `chunk_text`, `search_similar_chunks`) |
| Jobs | `worker.py` (`sharepoint_sync_task` → generalize) |
| Draft gate | `services/drafting.py`, `api/ccm/letters.py`, drafting sessions |
| Sync logs | Generalize `models/sharepoint_sync.py` |
| AuthZ | RBAC + new project membership; reconsider `uploaded_by` filter |

---

*End of plan. No implementation code included per request.*
