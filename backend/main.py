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

# API routers
from backend.api.auth import router as auth_router
from backend.api.knowledge import router as knowledge_router
from backend.api.letters import router as letters_router
from backend.api.drafts import router as drafts_router
from backend.api.review import router as review_router
from backend.api.jobs import router as jobs_router
from backend.api.webhooks import router as webhooks_router
from backend.api.notifications import router as notifications_router
from backend.api.files import router as files_router
from backend.api.health import router as health_router

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
allowed_origins = settings.allowed_origins or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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

# Serve frontend static files
app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")


@app.get("/")
async def serve_frontend():
    """Serve the main frontend HTML."""
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.get("/login")
async def serve_login():
    """Serve the login page."""
    return FileResponse(str(FRONTEND_DIR / "login.html"))


@app.get("/forgot-password")
async def serve_forgot_password():
    """Serve the forgot-password page."""
    return FileResponse(str(FRONTEND_DIR / "login.html"))


@app.get("/reset-password")
async def serve_reset_password():
    """Serve the reset-password page (same SPA)."""
    return FileResponse(str(FRONTEND_DIR / "login.html"))
