# CCM — Correspondence Contract Management

AI-powered platform for drafting, reviewing, and managing professional correspondence responses. Uses GPT-4o with Retrieval-Augmented Generation (RAG) to produce context-aware draft replies from uploaded letters and a vector-indexed knowledge base.

---

## System Workflow

The entire lifecycle of a correspondence follows this pipeline:

```
Upload Letter
    │
    ▼
┌─────────────────────────────────────────┐
│  1. INTAKE & CLASSIFICATION             │
│  - Extract text (PDF/DOCX/TXT/Image)    │
│  - AI classifies: category, intent,     │
│    urgency, key entities                 │
│  - Auto-assign project (optional)       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. AI DRAFT GENERATION (RAG)           │
│  - Semantic search over knowledge base   │
│  - Build prompt with context chunks      │
│  - GPT-4o generates professional draft   │
│  - Tone control (Formal/Neutral/Apology) │
│  - Versioned drafts with context refs    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. REVIEW                              │
│  - Side-by-side original vs. draft      │
│  - Reviewer notes + inline comments     │
│  - Approve → KB feedback loop           │
│  - Reject → re-draft with feedback      │
│  - Send → mark as sent                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. NOTIFICATION & AUDIT                │
│  - Email notifications on state changes │
│  - Webhook dispatch (Slack/Teams/etc.)  │
│  - Full audit trail for every action    │
└─────────────────────────────────────────┘
```

Approved drafts are fed back into the knowledge base, creating a self-improving loop where future drafts benefit from past responses.

---

## Architecture

```
                         ┌──────────────────────┐
                         │   React Frontend     │
                         │  (Vite + MUI v9)     │
                         │  / ─── main CCM SPA  │
                         │  /master ── sub-app  │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │   FastAPI (Uvicorn)  │
                         │   Python 3.13        │
                         └──┬───┬───┬───┬───┬──┘
                            │   │   │   │   │
               ┌────────────┘   │   │   │   └────────────┐
               ▼                ▼   │   ▼                ▼
        ┌────────────┐  ┌────────┐ │ ┌────────┐  ┌────────────┐
        │ PostgreSQL  │  │ MinIO  │ │ │ ClamAV │  │ Prometheus │
        │ + pgvector  │  │  (S3)  │ │ │  AV    │  │  + Grafana │
        │ + PgBouncer │  └────────┘ │ └────────┘  └────────────┘
        └────────────┘              │
                          ┌─────────▼─────────┐
                          │  SMTP (optional)   │
                          └───────────────────┘
```

Redis is available for ARQ-based background job queuing but is **disabled by default**; jobs run inline when Redis is not configured.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.13, FastAPI 0.115, SQLAlchemy 2.0 (async), asyncpg |
| Frontend | React 18, Vite 7, MUI v9, Redux, react-router-dom v7 |
| Database | PostgreSQL 16 + pgvector (vector similarity search) |
| Connection Pool | PgBouncer (transaction mode) |
| AI | OpenAI GPT-4o (chat), text-embedding-3-small (embeddings) |
| Queue | ARQ / Redis (optional — inline execution fallback) |
| Auth | JWT (python-jose), bcrypt, Google OAuth, Azure AD OIDC |
| Storage | Local filesystem or S3/MinIO (aioboto3) |
| Email | SMTP via aiosmtplib + Jinja2 HTML templates |
| PDF/DOCX | PyMuPDF (pymupdf4llm), python-docx |
| Image OCR | OpenAI Vision API |
| Monitoring | Prometheus metrics + Grafana dashboards |
| Security | Rate limiting (slowapi), CSP headers, ClamAV virus scanning |
| Container | Docker, Docker Compose (7 services) |

---

## Quick Start (Docker)

### Prerequisites

- Docker + Docker Compose
- OpenAI API key

### Setup

```bash
# 1. Clone the repo
git clone <repo-url> && cd CCM

# 2. Copy env template and edit with your values
cp .env.example .env
# Set at minimum: AI__OPENAI_API_KEY and AUTH__SECRET_KEY (min 32 chars)

# 3. Start all services
docker compose up -d

# 4. Create an admin user
docker compose exec app python scripts/create_user.py admin@example.com "your-password" admin

# 5. Open the app
# Main CCM SPA:   http://localhost:8000/master/
# Master Data:    http://localhost:8000/master/
# Grafana:        http://localhost:3001
```

Services started: PostgreSQL (5433), PgBouncer (5432), MinIO (9000/9001), ClamAV (8080), App (8000), Prometheus (9090), Grafana (3001).

### Building the Frontend

The React frontend must be built before the Docker image is created:

```bash
cd frontend
npm install
npm run build    # outputs to frontend/build/
cd ..
docker compose up -d --build
```

The built SPA is served by FastAPI at `/master/`.

---

## Manual Setup (without Docker)

### Prerequisites

- Python 3.13+
- PostgreSQL 16+ with pgvector
- Node.js 18+ (for frontend build)

### Install

```bash
# 1. Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Linux/Mac

# 2. Install backend dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your database URL, Redis URL, API keys, etc.

# 4. Initialize database (creates tables + seeds RBAC roles)
python -m backend.cli db migrate

# 5. Create an admin user
PYTHONPATH=. python scripts/create_user.py admin@example.com "your-password" admin

# 6. Build the frontend
cd frontend
npm install && npm run build
cd ..

# 7. Start the server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000/master/

---

## Configuration

Key environment variables (see `.env.example` for all 90+ options):

| Variable | Description |
|----------|-------------|
| `DATABASE__URL` | PostgreSQL async connection URL (`postgresql+asyncpg://...`) |
| `DATABASE_DIRECT_URL` | Direct PostgreSQL URL for LISTEN/NOTIFY (bypasses PgBouncer) |
| `REDIS__URL` | Redis connection URL (omit to run without Redis) |
| `AI__OPENAI_API_KEY` | OpenAI API key |
| `AI__MODEL` | Model name (default: `gpt-4o`) |
| `AUTH__SECRET_KEY` | JWT signing key (min 32 chars) |
| `AUTH__GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `AUTH__GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `STORAGE__BACKEND` | `local` or `s3` |
| `APP_BASE_URL` | Base URL for email links and signed URLs |
| `ENABLE_VIRUS_SCAN` | Enable ClamAV scanning on uploads |
| `MASTER_AUTH_MODE` | `ccm`, `azure`, or `both` for the master sub-app |
| `SMTP_HOST` | SMTP server for email notifications |

---

## Project Structure

```
CCM/
├── backend/
│   ├── api/
│   │   ├── ccm/              # Core CCM route handlers
│   │   │   ├── auth.py       # Login, OAuth, password reset
│   │   │   ├── letters.py    # Letter CRUD + upload
│   │   │   ├── drafts.py     # AI draft generation
│   │   │   ├── review.py     # Approve/reject/send pipeline
│   │   │   ├── knowledge.py  # KB upload + semantic search
│   │   │   ├── drafting_sessions.py  # Chat-style drafting threads
│   │   │   ├── jobs.py       # Background job status
│   │   │   ├── webhooks.py   # Webhook management
│   │   │   ├── files.py      # File management
│   │   │   ├── projects.py   # Project-scoped data
│   │   │   ├── notifications.py  # User notifications
│   │   │   └── health.py     # Health checks + metrics
│   │   └── master/           # Master Data & Admin routes
│   │       ├── common.py     # CRUD for all master entities
│   │       ├── roles.py      # RBAC role management
│   │       ├── users.py      # User management
│   │       ├── modules.py    # Module management
│   │       └── ...           # 15+ route modules
│   ├── models/               # 21+ SQLAlchemy ORM models
│   ├── services/             # 16 service modules
│   │   ├── drafting.py       # RAG pipeline + GPT-4o calls
│   │   ├── knowledge_base.py # Embedding + semantic search
│   │   ├── letter_intake.py  # Text extraction + classification
│   │   ├── review.py         # Approval/rejection logic
│   │   ├── storage.py        # Local/S3 file storage
│   │   ├── job_queue.py      # ARQ or inline job execution
│   │   ├── email_service.py  # SMTP email dispatch
│   │   ├── webhook_service.py # Webhook delivery + HMAC
│   │   ├── openai_client.py  # OpenAI API wrapper
│   │   └── metrics.py        # Prometheus metric definitions
│   ├── templates/            # Jinja2 email templates
│   ├── sample_data/          # Demo documents and letters
│   ├── main.py               # FastAPI app entry point
│   ├── config.py             # Pydantic settings (nested .env)
│   ├── database.py           # Async SQLAlchemy engine + init
│   ├── cli.py                # Typer CLI (migrate, seed, worker)
│   ├── db_seed.py            # RBAC seed (roles, modules, permissions)
│   └── worker.py             # ARQ background worker
├── frontend/
│   ├── src/
│   │   ├── ccm/              # CCM views + API client
│   │   ├── master/           # Master data views (Projects, Users, Roles, etc.)
│   │   ├── authentication/   # Login page
│   │   ├── components/       # Shared React components
│   │   ├── redux/            # Redux store + slices
│   │   ├── routes.js         # All route definitions
│   │   └── app.js            # Root App component
│   ├── build/                # Production build output (served at /master/)
│   ├── package.json          # React 18, MUI v9, Redux, Vite 7
│   └── vite.config.js        # base: '/master/'
├── scripts/
│   └── create_user.py        # Admin user creation utility
├── grafana/                  # Pre-configured dashboards + provisioning
├── docs/                     # Design docs + screenshots
├── docker-compose.yml        # 7 services
├── Dockerfile                # Python 3.13-slim
├── prometheus.yml            # Scrape config for the app
├── requirements.txt          # Python dependencies
└── .env.example              # All environment variables
```

---

## Features

### AI Draft Generation (RAG)

1. User selects a letter and optional tone/category
2. System searches the knowledge base using cosine similarity over OpenAI `text-embedding-3-small` vectors stored in pgvector
3. Top-matching document chunks are injected into the prompt alongside the original letter
4. GPT-4o generates a professional draft response
5. Draft is stored with version number, context document references, and full audit trail
6. Drafts can be regenerated with feedback ("make it more formal", "add reference to clause 4.2")

### Knowledge Base

- **Upload**: PDF, DOCX, TXT, JPG, PNG
- **Processing**: Text extraction (PyMuPDF / python-docx / OpenAI Vision) → chunking (500 words, 50 overlap) → embedding (OpenAI text-embedding-3-small, batches of 100)
- **Search**: In-memory cosine similarity over stored float vectors
- **Scope**: Project-scoped for data isolation

### Letter Intake & Classification

- Upload triggers text extraction and AI classification
- Extracts: category (dispute, renewal, amendment, complaint, etc.), intent, urgency, confidence score, key entities (names, dates, contract numbers, amounts)
- Optional AI project prediction
- Manual reclassification by admins

### Review Pipeline

| Action | Result |
|--------|--------|
| **Approve** | Draft marked approved, response fed back into KB, webhook + email notifications |
| **Reject** | Letter reset for re-drafting, feedback sent to drafter |
| **Send** | Approved draft marked as sent |
| **Archive** | Letter + all drafts archived |

Full audit trail on every state transition.

### Authentication & RBAC

- JWT access tokens (15 min) + refresh tokens (7 days) with JTI revocation
- Email/password with bcrypt hashing, account lockout after 5 failed attempts (15 min)
- Google OAuth with domain restriction
- Azure AD OIDC with JIT user provisioning
- Dynamic RBAC: 3 system roles (Admin / Drafter / Reviewer) + unlimited custom roles
- Per-module permission matrix: view / create / edit / delete across 30+ modules
- Permissions resolved per-request from database via `require_permission()` dependency

### Master Data Management

React sub-app served at `/master/` providing:

| Module Group | Entities |
|-------------|----------|
| **Project Setup** | Projects, Contractors, Contracts, Activity Groups, Activities, Variation Orders, Monthly Breakups, Departments, Locations, Units, Designations, Lookups |
| **User Access** | Users, Roles, Role Rights, User Roles, Module Groups, Modules |
| **System** | Auto Notifications, Reference Documents, User Logs, User Errors |

Uses MUI v9 DataGrid with CRUD operations through the `/common/*` API, authenticated with CCM JWT.

### Webhooks

- HMAC-SHA256 signed payloads
- Events: `letter.uploaded`, `draft.generated`, `draft.approved`, `draft.rejected`, `kb.document_added`, `test.ping`
- Auto-disable after 10 consecutive failures
- Full delivery history with response status, body, and duration

### Monitoring

Prometheus collects metrics every 15s; Grafana displays a pre-configured dashboard at `http://localhost:3001`:

- HTTP request rate and latency (p95)
- Background jobs: queued vs. completed
- Draft generation duration
- Webhook dispatch success/failure
- Active letters by status
- DB connection pool usage
- Email send counts

---

## API Overview

### Core CCM Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Email/password login |
| `POST /api/auth/login/json` | JSON login (for SPA) |
| `GET /api/auth/me` | Current user profile |
| `POST /api/auth/forgot-password` | Request password reset |
| `POST /api/auth/reset-password` | Reset password with token |
| `GET /api/auth/google` | Google OAuth redirect |
| `GET /api/letters` | List correspondence letters |
| `POST /api/letters` | Create / upload new letter |
| `GET /api/drafts` | List AI-generated drafts |
| `POST /api/drafts/generate` | Generate draft from letter (RAG) |
| `GET /api/review` | Review queue |
| `POST /api/knowledge/upload` | Upload KB document |
| `GET /api/knowledge/search` | Semantic search over KB |
| `GET /api/projects` | List projects |
| `GET /api/files` | File management |
| `GET /api/jobs` | Background job status |
| `GET /api/webhooks` | Webhook management |
| `GET /api/notifications` | User notifications |
| `GET /api/health` | System health check |
| `GET /metrics` | Prometheus metrics |

### Master Data Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET/POST /common/departments` | Department CRUD |
| `GET/POST /common/locations` | Location CRUD |
| `GET/POST /common/designations` | Designation CRUD |
| `GET/POST /common/units` | Unit CRUD |
| `GET/POST /common/lookups` | Lookup CRUD |
| `GET/POST /api/roles` | Role management |
| `GET/POST /api/modules` | Module management |
| `GET/POST /api/users` | User management |
| `GET/POST /api/projects-master` | Project master CRUD |
| `GET/POST /api/contractors` | Contractor CRUD |
| `GET/POST /api/contracts` | Contract CRUD |
| `GET/POST /api/activities` | Activity CRUD |
| `GET/POST /api/variation-orders` | Variation order CRUD |
| `GET/POST /api/monthly-breakups` | Monthly breakup CRUD |

---

## CLI Commands

```bash
# Database management
python -m backend.cli db migrate      # Create tables + seed RBAC
python -m backend.cli db seed         # Seed sample data (dev only)
python -m backend.cli db reset        # Drop + recreate all tables

# User management
python scripts/create_user.py <email> <password> [role]

# Background worker
python -m backend.cli worker start    # Start ARQ worker (requires Redis)

# Health checks
python -m backend.cli health check
```

---

## License

MIT
