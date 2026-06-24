# CCM — Correspondence Contract Management

AI-powered platform for drafting, reviewing, and managing professional correspondence responses. Uses LLMs (GPT-4o) to generate context-aware draft replies from uploaded letters and knowledge base documents.

## Features

- **AI Drafting** — Generate professional correspondence drafts using GPT-4o with tone control (Formal/Neutral/Apologetic)
- **Knowledge Base** — Upload and index contracts, templates, and reference documents via RAG (pgvector embeddings)
- **Review Pipeline** — Side-by-side original/draft comparison with inline comments, approval/rejection workflow, and audit trail
- **Letter Management** — Inbox with status tracking (Draft, Pending Review, Approved, Sent) and priority flagging
- **Authentication** — Email/password login with JWT, Google OAuth, account lockout (5 failed attempts), password reset via email
- **Role-Based Access** — Admin, Drafter, and Reviewer roles
- **Webhook Notifications** — Slack/Teams/Zapier integration for pipeline events
- **API Keys** — Programmatic access with scoped permissions
- **Monitoring** — Prometheus metrics + Grafana dashboards

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────→│    Uvicorn   │────→│  PostgreSQL  │
│  (VanillaJS) │     │   (FastAPI)  │     │  (pgvector)  │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │                      │
                     ┌──────┴───────┐     ┌────────┴────────┐
                     │    Redis     │     │  MinIO (S3)    │
                     │  (Job Queue) │     │  (File Store)  │
                     └──────────────┘     └─────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.13, FastAPI, SQLAlchemy 2.0 (async), Alembic |
| Frontend | Vanilla JavaScript, HTML5, CSS3 (no frameworks) |
| Database | PostgreSQL 16 + pgvector |
| AI | OpenAI GPT-4o |
| Queue | ARQ (Redis-based async job queue) |
| Auth | JWT (python-jose), bcrypt, Google OAuth |
| Storage | Local filesystem or S3/MinIO |
| Monitoring | Prometheus + Grafana |
| Email | SMTP via aiosmtplib |
| Container | Docker, Docker Compose |

## Quick Start (Docker)

### Prerequisites

- Docker + Docker Compose
- OpenAI API key

### Setup

```bash
# 1. Clone the repo
git clone <repo-url> && cd ccm

# 2. Copy env template and edit with your values
cp .env.example .env
# Set AI__OPENAI_API_KEY and AUTH__SECRET_KEY (min 32 chars)

# 3. Start all services
docker compose up -d

# 4. Create an admin user
docker compose exec app python scripts/create_user.py admin@example.com "your-password" admin

# 5. Open the app
open http://localhost:8000
```

Services spin up: PostgreSQL (5433), PgBouncer (5432), Redis (6379), MinIO (9000/9001), ClamAV (8080), Prometheus (9090), Grafana (3001).

## Manual Setup (without Docker)

### Prerequisites

- Python 3.13+
- PostgreSQL 16+ with pgvector
- Redis 7+
- MinIO (optional, for S3 storage)

### Install

```bash
# 1. Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your database URL, Redis URL, API keys, etc.

# 4. Run database migrations
alembic upgrade head

# 5. Create an admin user
$env:PYTHONPATH = "C:\path\to\ccm"  # Windows
PYTHONPATH=. python scripts/create_user.py admin@example.com "your-password" admin

# 6. Start the server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000.

## Configuration

Key environment variables (see `.env.example` for all):

| Variable | Description |
|----------|-------------|
| `DATABASE__URL` | PostgreSQL connection URL |
| `REDIS__URL` | Redis connection URL |
| `AI__OPENAI_API_KEY` | OpenAI API key |
| `AUTH__SECRET_KEY` | JWT signing key (min 32 chars) |
| `AUTH__GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `AUTH__GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `AUTH__GOOGLE_ALLOWED_DOMAINS` | JSON list of allowed domains |
| `SMTP_HOST` | SMTP server for email notifications |
| `STORAGE__BACKEND` | `local` or `s3` |
| `APP_BASE_URL` | Base URL for email links |

## Project Structure

```
ccm/
├── backend/
│   ├── api/            # FastAPI route handlers
│   ├── models/         # SQLAlchemy ORM models
│   ├── services/       # Business logic (AI, storage, auth, email)
│   ├── templates/      # Email templates (Jinja2)
│   ├── alembic/        # Database migrations
│   ├── sample_data/    # Demo documents and letters
│   ├── main.py         # FastAPI app entry point
│   ├── config.py       # Pydantic settings
│   └── database.py     # Async SQLAlchemy engine
├── frontend/
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript modules
│   ├── index.html      # SPA entry point
│   └── login.html      # Standalone login page
├── scripts/
│   └── create_user.py  # Admin user creation utility
├── grafana/            # Grafana dashboards + provisioning
├── docker-compose.yml  # All services
├── Dockerfile          # App container
└── requirements.txt    # Python dependencies
```

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Email/password login |
| `POST /api/auth/login/json` | JSON login (for SPA) |
| `GET /api/auth/me` | Current user profile |
| `POST /api/auth/forgot-password` | Request password reset |
| `POST /api/auth/reset-password` | Reset password with token |
| `GET /api/auth/google` | Google OAuth redirect |
| `GET /api/letters` | List correspondence letters |
| `POST /api/letters` | Create new letter |
| `GET /api/drafts` | List AI-generated drafts |
| `POST /api/drafts/generate` | Generate draft from letter |
| `GET /api/review` | Review queue |
| `POST /api/knowledge/upload` | Upload KB document |
| `GET /api/knowledge/search` | Semantic search KB |
| `GET /api/health` | System health check |
| `GET /metrics` | Prometheus metrics |

## Login Page

The app serves a standalone login page at `/login` with three views:
- **Sign In** — Email/password with "Remember me" and Google OAuth button
- **Forgot Password** — Email input with rate-limited reset link
- **Reset Password** — New password + confirmation with validation

After successful login, the JWT is stored in `localStorage` and the page redirects to the SPA (`/`). The SPA's `requireAuth()` guard redirects unauthenticated users back to `/login`.

## License

MIT
