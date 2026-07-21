"""
CCM — Correspondence Contract Management Tool
FastAPI application entry point.
"""
import os
import time
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.database import init_db
from backend.config import get_settings
from backend.api.limiter import limiter
from backend.services.metrics import (
    http_requests_total,
    http_request_duration_seconds,
    db_pool_checked_out,
)

# API routers — core CCM
from backend.api.ccm.auth import router as auth_router
from backend.api.ccm.knowledge import router as knowledge_router
from backend.api.ccm.letters import router as letters_router
from backend.api.ccm.drafts import router as drafts_router
from backend.api.ccm.review import router as review_router
from backend.api.ccm.jobs import router as jobs_router
from backend.api.ccm.webhooks import router as webhooks_router
from backend.api.ccm.notifications import router as notifications_router
from backend.api.ccm.files import router as files_router
from backend.api.ccm.health import router as health_router
from backend.api.ccm.projects import router as projects_router
from backend.api.ccm.drafting_sessions import router as drafting_sessions_router, prompts_router

# API routers — MASTER / ADMIN sub-app
from backend.api.master.roles import router as roles_router
from backend.api.master.common import router as master_common_router
from backend.api.master.common_roles import router as common_roles_router
from backend.api.master.verify import router as verify_router
from backend.api.master.modules import router as modules_router
from backend.api.master.users import router as users_router
from backend.api.master.projects_master import router as projects_master_router
from backend.api.master.contractors import router as contractors_router
from backend.api.master.contracts import router as contracts_router
from backend.api.master.activities import router as activities_router
from backend.api.master.variation_orders import router as variation_orders_router
from backend.api.master.monthly_breakup import router as monthly_breakup_router
from backend.api.master.notifications_auto import router as notifications_auto_router
from backend.api.master.logs import router as logs_router
from backend.api.master.misc import router as misc_router
from backend.api.master.attachments import router as attachments_router
from backend.api.master.email import router as email_router

# Ensure all models are imported so Base.metadata knows about them
import backend.models  # noqa: F401

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-30s | %(levelname)-7s | %(message)s",
)
logger = structlog.get_logger(__name__)

settings = get_settings()

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting CCM application...")
    await init_db()
    logger.info("Database initialized with pgvector extension")

    import asyncio
    app.state.metrics_task = asyncio.create_task(_update_gauges())

    yield
    if hasattr(app.state, "metrics_task"):
        app.state.metrics_task.cancel()
    logger.info("Shutting down CCM application")


async def _update_gauges():
    """Periodically update Prometheus gauges."""
    import asyncio
    from backend.database import engine
    while True:
        try:
            pool = engine.pool
            if pool:
                db_pool_checked_out.set(pool.checkedout())
        except Exception:
            pass
        await asyncio.sleep(15)


app = FastAPI(
    title="CCM — Correspondence Contract Management",
    description="AI-powered tool for drafting responses to client correspondence",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limit handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Custom 429 response with Retry-After header."""
    retry_after = getattr(exc, "retry_after", 60)
    return JSONResponse(
        status_code=429,
        content={"error": "rate_limit_exceeded", "retry_after_seconds": retry_after},
        headers={"Retry-After": str(retry_after)},
    )


# Security headers middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # CSP: everything is same-origin. script-src allows 'unsafe-inline' because
    # the frontend renders onclick="..." handlers in templated HTML (app.js,
    # drafting.js, etc.) — tightening that further means refactoring those to
    # addEventListener first. Still blocks any *externally* injected/loaded script.
    # MSAL popup auth + Systra logo/CDN are allowed for the master sub-app.
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https://systra.com; "
        "font-src 'self'; "
        "connect-src 'self' https://login.microsoftonline.com; "
        "frame-src 'self' https://login.microsoftonline.com; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    response.headers["Content-Security-Policy"] = csp
    return response


# Metrics middleware
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.monotonic()
    response = await call_next(request)
    duration = time.monotonic() - start_time
    path = request.url.path
    method = request.method
    status_code = response.status_code
    http_requests_total.labels(method=method, path=path, status_code=status_code).inc()
    http_request_duration_seconds.labels(path=path).observe(duration)
    return response


# CORS
# Never fall back to "*" here: allow_credentials=True + a wildcard origin is
# rejected by browsers anyway (and is a misconfiguration if it weren't), since
# it would let any site read authenticated responses. Require explicit origins.
if not settings.allowed_origins:
    if settings.environment == "production":
        raise RuntimeError("ALLOWED_ORIGINS must be set in production — refusing to start with no allowed CORS origins.")
    logger.warning("cors.no_allowed_origins_configured", info="Set ALLOWED_ORIGINS in .env for cross-origin frontend access.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(auth_router)
app.include_router(knowledge_router)
app.include_router(letters_router)
app.include_router(drafts_router)
app.include_router(review_router)
app.include_router(jobs_router)
app.include_router(webhooks_router)
app.include_router(notifications_router)
app.include_router(files_router)
app.include_router(health_router)
app.include_router(projects_router)
app.include_router(drafting_sessions_router)
app.include_router(prompts_router)
app.include_router(roles_router)
app.include_router(master_common_router)
app.include_router(common_roles_router)
app.include_router(verify_router)
app.include_router(modules_router)
app.include_router(users_router)
app.include_router(projects_master_router)
app.include_router(contractors_router)
app.include_router(contracts_router)
app.include_router(activities_router)
app.include_router(variation_orders_router)
app.include_router(monthly_breakup_router)
app.include_router(notifications_auto_router)
app.include_router(logs_router)
app.include_router(misc_router)
app.include_router(attachments_router)
app.include_router(email_router)

# Serve frontend static files (legacy vanilla assets — only if present)
if (FRONTEND_DIR / "css").exists():
    app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
if (FRONTEND_DIR / "js").exists():
    app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")

# Master sub-app static files and SPA fallback
MASTER_DIR = BASE_DIR / "frontend" / "build"
if MASTER_DIR.exists():
    app.mount("/master/assets", StaticFiles(directory=str(MASTER_DIR / "assets")), name="master_assets")
    app.mount("/static", StaticFiles(directory=str(MASTER_DIR)), name="build_static")

    @app.get("/systra_logo.svg")
    async def serve_systra_logo():
        logo = MASTER_DIR / "systra_logo.svg"
        if logo.exists():
            return FileResponse(str(logo), media_type="image/svg+xml")
        return JSONResponse({"error": "Logo not found"}, status_code=404)

    @app.get("/master/env.js")
    async def serve_master_env_js():
        env_js = MASTER_DIR / "env.js"
        if env_js.exists():
            return FileResponse(str(env_js), media_type="application/javascript")
        return JSONResponse({"error": "env.js not found"}, status_code=404)

    @app.get("/master/{path:path}")
    async def serve_master_spa():
        return FileResponse(str(MASTER_DIR / "index.html"))


@app.get("/")
async def serve_frontend():
    """Serve the main frontend HTML."""
    build_index = FRONTEND_DIR / "build" / "index.html"
    if build_index.exists():
        return FileResponse(str(build_index))
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.get("/login")
async def serve_login():
    """Serve the login page."""
    build_index = FRONTEND_DIR / "build" / "index.html"
    if build_index.exists():
        return FileResponse(str(build_index))
    return FileResponse(str(FRONTEND_DIR / "login.html"))


@app.get("/forgot-password")
async def serve_forgot_password():
    """Serve the forgot-password page."""
    build_index = FRONTEND_DIR / "build" / "index.html"
    if build_index.exists():
        return FileResponse(str(build_index))
    return FileResponse(str(FRONTEND_DIR / "login.html"))


@app.get("/reset-password")
async def serve_reset_password():
    """Serve the reset-password page (same SPA)."""
    build_index = FRONTEND_DIR / "build" / "index.html"
    if build_index.exists():
        return FileResponse(str(build_index))
    return FileResponse(str(FRONTEND_DIR / "login.html"))
