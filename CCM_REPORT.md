# CCM — Correspondence Contract Management: Comprehensive Report

## 1. Overview

**CCM** is a **production-grade, AI-powered web application** for drafting, reviewing, and managing professional correspondence responses. Built with **Python FastAPI** (backend) and **Vanilla JavaScript** (frontend SPA), it uses Large Language Models (GPT-4o/GPT-5.5 via a Knower API proxy) to generate context-aware draft replies to client letters, backed by **Retrieval-Augmented Generation (RAG)** with vector search over a PostgreSQL/pgvector knowledge base.

---

## 2. Architecture

```
Frontend (Vanilla JS SPA) → FastAPI Backend (Uvicorn) → PostgreSQL 16 + pgvector
                                                            ↕
                                              ARQ Worker (Redis job queue)
                                              MinIO/S3 (file storage)
                                              PgBouncer (connection pooling)
                                              ClamAV (virus scanning)
                                              Prometheus + Grafana (monitoring)
                                              SMTP (email notifications)
```

The backend follows a **layered architecture**: API routers → Service layer (business logic) → Data layer (SQLAlchemy ORM, 18 models) → Background workers (ARQ/Redis).

---

## 3. Key Features

| Feature | Details |
|---------|---------|
| **AI Drafting** | GPT-4o/5.5 with RAG, tone control, category-specific prompts, versioning, regeneration with feedback |
| **Knowledge Base** | Upload PDF/DOCX/TXT/JPG/PNG → text extraction → chunking → embeddings (OpenAI text-embedding-3-small) → semantic cosine-similarity search |
| **Letter Management** | Intake + AI classification (category, intent, urgency, entities) → status lifecycle (new → classified → drafted → pending_review → approved → sent → archived) |
| **Review Pipeline** | Side-by-side comparison, approve/reject with notes, audit trail, email notifications, feedback loop to KB |
| **Auth & RBAC** | JWT (access + refresh), Google OAuth, bcrypt passwords, account lockout after 5 failed attempts, roles: admin / drafter / reviewer |
| **Drafting Sessions** | ChatGPT-style conversational interface with message history, pin/rename/search, template prompts, source document panel |
| **Webhooks** | HMAC-SHA256 signed, auto-disable after 10 consecutive failures, delivery history |
| **Projects** | Project-scoped knowledge base/letters/drafts, SharePoint sync log |
| **Monitoring** | Prometheus metrics (request counts, job durations, DB pool usage), pre-configured Grafana dashboard |
| **Security** | Rate limiting, CORS, security headers, file validation (magic bytes + MIME), ClamAV scanning, JWT revocation |
| **Background Jobs** | ARQ/Redis: classify letters, generate drafts, index KB docs, send emails, deliver webhooks, sync SharePoint |

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
│   ├── api/                     # 13 route modules (auth, letters, drafts, review, knowledge, etc.)
│   ├── models/                  # 18 SQLAlchemy ORM models
│   ├── services/                # 17 service modules (business logic)
│   ├── templates/email/         # 5 Jinja2 email templates
│   └── alembic/                 # DB migrations
├── frontend/
│   ├── index.html               # SPA entry point
│   ├── login.html               # Standalone login
│   ├── css/                     # styles.css + login.css
│   └── js/                      # api.js, app.js, drafting.js, login.js, letters.js, review.js, knowledge.js, settings.js
├── docker-compose.yml           # 8 services (postgres+pgvector, pgbouncer, redis, minio, clamav, app, prometheus, grafana)
├── Dockerfile                   # Python 3.13-slim
├── requirements.txt             # 24 pinned Python packages
├── prometheus.yml               # Prometheus scrape config
├── alembic.ini                  # Migration config
└── grafana/                     # Pre-configured dashboards + datasources
```

---

## 5. Technologies

**Backend:** Python 3.13+, FastAPI 0.115, SQLAlchemy 2.0 (async), asyncpg, pgvector, Alembic, OpenAI 1.57, ARQ, Redis, python-jose (JWT), passlib/bcrypt, httpx, aioboto3 (S3), pymupdf (PDF), python-docx (DOCX), Pillow, python-magic, prometheus-client, slowapi, structlog

**Frontend:** Vanilla JS, HTML5/CSS3, Tabler Icons, Google Fonts (Inter)

**Infrastructure:** Docker Compose, PostgreSQL 16 + pgvector, PgBouncer, Redis 7, MinIO/S3, ClamAV, Prometheus, Grafana

---

## 6. Role-Based Access

| Role | Permissions |
|------|------------|
| **Admin** | Full access — users, webhooks, audit trail, approve/reject, upload, draft |
| **Drafter** | Upload letters, generate/edit drafts, upload KB documents |
| **Reviewer** | View letters, approve/reject drafts, send/archive |

---

## 7. Configuration (`.env`)

90+ environment variables across 11 sections: `DATABASE__*`, `REDIS__*`, `STORAGE__*`, `AI__*`, `AUTH__*`, `SMTP__*`, file upload limits, rate limiting, webhook secrets, etc. Loaded via **pydantic-settings** with nested delimiter `__`.

---

## 8. Key Data Flows

**Letter Intake:** Upload → validate → extract text → AI classify (category, intent, urgency, entities) → store in DB → enqueue background job → dispatch webhook

**Draft Generation (RAG):** Select letter → enqueue job → fetch letter + semantically search KB → build prompt (system + category instructions + letter + context) → call LLM → store draft with version + context refs → notify frontend

**Review Pipeline:** Review draft → approve (feeds response back to KB, updates status, triggers webhook + email) / reject (with feedback, resets status for re-drafting)

---

**Bottom line:** CCM is a fully containerized, production-ready SaaS platform for AI-assisted correspondence management with a complete human-in-the-loop pipeline, vector-based RAG, role-based access, webhook integrations, and comprehensive monitoring — all running on a Docker Compose stack of 8 services.
