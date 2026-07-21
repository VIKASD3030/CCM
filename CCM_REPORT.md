# CCM — Correspondence Contract Management: Comprehensive Report

## 1. Overview

**CCM** is a **production-grade, AI-powered web application** for drafting, reviewing, and managing professional correspondence responses. Built with **Python FastAPI** (backend) and **Vanilla JavaScript** (frontend SPA), it uses Large Language Models (GPT-4o via OpenAI) to generate context-aware draft replies to client letters, backed by **Retrieval-Augmented Generation (RAG)** with vector search over a PostgreSQL/pgvector knowledge base.

---

## 2. Architecture

```
Frontend (Vanilla JS SPA) → FastAPI Backend (Uvicorn) → PostgreSQL 16 + pgvector
                                                            ↕
                                              ARQ Worker (Redis, optional — jobs run inline)
                                              MinIO/S3 (file storage)
                                              PgBouncer (connection pooling)
                                              ClamAV (virus scanning, optional)
                                              Prometheus + Grafana (monitoring)
                                              SMTP (email notifications)
```

The backend follows a **layered architecture**: API routers → Service layer (business logic) → Data layer (SQLAlchemy ORM, 21 models) → Background workers (ARQ/Redis optional — runs inline when Redis is not configured).

---

## 3. Key Features

| Feature | Details |
|---------|---------|
| **AI Drafting** | GPT-4o (OpenAI direct) with RAG, tone control, category-specific prompts, versioning, regeneration with feedback |
| **Knowledge Base** | Upload PDF/DOCX/TXT/JPG/PNG → text extraction → chunking → embeddings (OpenAI text-embedding-3-small) → semantic cosine-similarity search |
| **Letter Management** | Intake + AI classification (category, intent, urgency, entities) → status lifecycle (new → classified → drafted → pending_review → approved → sent → archived) |
| **Review Pipeline** | Side-by-side comparison, approve/reject with notes, audit trail, email notifications, feedback loop to KB |
| **Auth & RBAC** | JWT (access + refresh with JTI revocation), Google OAuth, bcrypt passwords, account lockout after 5 failed attempts, dynamic RBAC with 3 system roles (admin / drafter / reviewer) + custom roles, per-module permission matrix (view/create/edit/delete) managed via Settings UI or `/api/roles` admin API |
| **Drafting Sessions** | ChatGPT-style conversational interface with message history, pin/rename/search, template prompts, source document panel |
| **Webhooks** | HMAC-SHA256 signed, auto-disable after 10 consecutive failures, delivery history |
| **Projects** | Project-scoped knowledge base/letters/drafts, SharePoint sync log |
| **Monitoring** | Prometheus metrics (request counts, job durations, DB pool usage), pre-configured Grafana dashboard |
| **Security** | Rate limiting, CORS (no wildcard fallback), CSP headers, file validation (magic bytes + MIME), ClamAV scanning, refresh token JTI revocation, production config validation |
| **Master Data Management** | React-based sub-app at `/master` with Project Setup (projects, departments, locations, units, designations, lookups) and User Access Setup (roles, role rights, module groups, modules, users, user roles) — original source-faithful tables with `master_*` prefix, accessible via CCM JWT auth |
| **Background Jobs** | ARQ/Redis (optional — runs inline when Redis not configured): classify letters, generate drafts, index KB docs, send emails, deliver webhooks, sync SharePoint |

---

## 4. Directory Structure

```
CCM/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── config.py                # Pydantic settings (.env)
│   ├── database.py              # Async SQLAlchemy engine
│   ├── worker.py                # ARQ background worker
│   ├── cli.py                   # Typer CLI (migrate, seed, users, worker)
│   ├── api/                     # 13 route modules (auth, roles, letters, drafts, review, knowledge, etc.)
│   ├── models/                  # 21 SQLAlchemy ORM models
│   ├── services/                # 16 service modules (business logic)
│   ├── templates/email/         # 5 Jinja2 email templates
│   ├── db_seed.py               # RBAC seed (system roles, modules, permissions)
│   └── models/master/           # 13 master-data SQLAlchemy models
├── frontend/
│   ├── index.html               # SPA entry point
│   ├── login.html               # Standalone login
│   ├── css/                     # styles.css + login.css
│   └── js/                      # api.js, app.js, drafting.js, login.js, letters.js, review.js, knowledge.js, settings.js
├── frontend-master/             # Progress Management React sub-app (Project Setup + User Access Setup)
│   ├── src/                     # Original React source, routes trimmed to 2 modules
│   └── vite.config.js           # base: '/master/'
├── docker-compose.yml           # 7 services (postgres+pgvector, pgbouncer, minio, clamav, app, prometheus, grafana — Redis optional/commented out)
├── Dockerfile                   # Python 3.13-slim
├── requirements.txt             # 23 pinned Python packages (alembic removed)
├── prometheus.yml               # Prometheus scrape config
└── grafana/                     # Pre-configured dashboards + datasources
```

---

## 5. Technologies

**Backend:** Python 3.13+, FastAPI 0.115, SQLAlchemy 2.0 (async), asyncpg, pgvector, OpenAI 1.57+ (direct), ARQ, Redis (optional), python-jose (JWT), passlib/bcrypt, httpx, aioboto3 (S3), pymupdf (PDF), python-docx (DOCX), Pillow, python-magic, prometheus-client, slowapi, structlog

**Frontend:** Vanilla JS, HTML5/CSS3, Tabler Icons, Google Fonts (Inter) — plus React 18 sub-app for master data management

**Infrastructure:** Docker Compose, PostgreSQL 16 + pgvector, PgBouncer, Redis 7 (optional), MinIO/S3, ClamAV, Prometheus, Grafana

---

## 6. Role-Based Access

CCM ships with **3 system roles** (protected from deletion) but supports **fully dynamic RBAC** — admins can create custom roles and tune per-module permissions at runtime via the Settings UI or the `/api/roles` admin API. Permissions are stored in a dedicated `role_permissions` table with a granular **view / create / edit / delete** matrix across 13 modules.

| System Role | Default Scope |
|-------------|---------------|
| **Admin** | Full access to all 13 modules (users, roles, prompts, letters, knowledge, jobs, webhooks, review, projects, drafts, files, drafting_sessions, notifications) |
| **Drafter** | Upload letters, manage knowledge base, generate/edit drafts, manage files & drafting sessions; read-only on projects, jobs, and notifications |
| **Reviewer** | View letters, approve/reject/send drafts with reviewer notes, read-only access to knowledge, drafts, files, and other modules |

Custom roles can be created, edited, and deleted from the Settings → Roles & Permissions panel. System roles display a fixed (uneditable) permission matrix.

---

## 7. Configuration (`.env`)

90+ environment variables across 11 sections: `DATABASE__*`, `REDIS__*` (optional — omit to run without Redis), `STORAGE__*`, `AI__*`, `AUTH__*`, `SMTP__*`, file upload limits, rate limiting, webhook secrets, etc. Loaded via **pydantic-settings** with nested delimiter `__`. Production validation enforces non-placeholder secrets, explicit CORS origins, and debug=false.

---

## 8. Key Data Flows

**Letter Intake:** Upload → validate → extract text → AI classify (category, intent, urgency, entities) → store in DB → enqueue background job (or inline if Redis absent) → dispatch webhook

**Draft Generation (RAG):** Select letter → enqueue job (or inline) → fetch letter + semantically search KB → build prompt (system + category instructions + letter + context) → call OpenAI → store draft with version + context refs → notify frontend

**API Authorization:** Every protected endpoint resolves the caller's role from the JWT, looks up the corresponding `role_permissions` row for the target module, and enforces the required action (view/create/edit/delete) against the database — making access control fully dynamic and auditable.

**Master Data CRUD (Project Setup / User Access):** React sub-app at `/master` calls `/common/*` endpoints with CCM JWT. Save/delete operations return refreshed list arrays. Data stored in `master_*` tables alongside CCM's existing schema. Access controlled by CCM's `require_permission()` via the same JWT.

**Review Pipeline:** Review draft → approve (feeds response back to KB, updates status, triggers webhook + email) / reject (with feedback, resets status for re-drafting)

---

**Bottom line:** CCM is a fully containerized, production-ready SaaS platform for AI-assisted correspondence management with a complete human-in-the-loop pipeline, vector-based RAG, dynamic role-based access with granular per-module permissions, webhook integrations, comprehensive monitoring, and a React-based master data sub-app for Project Setup & User Access Setup — all running on a Docker Compose stack of 7 services (with optional Redis for background queues).
