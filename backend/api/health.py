"""
Enhanced health check endpoint.
Checks all 5 dependencies: database, pgvector, redis, storage, OpenAI API.
"""
import time
from ipaddress import ip_address, ip_network

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import text

from backend.config import get_settings
from backend.database import engine
from backend.services.storage import storage_backend
from backend.services.metrics import get_metrics as generate_metrics

router = APIRouter(tags=["Health"])
settings = get_settings()

START_TIME = time.time()


@router.get("/health")
async def health_check():
    """Deep health check across all dependencies.
    
    Returns:
        status: healthy | degraded | unhealthy
        checks: per-service check results with latency
    """
    overall = "healthy"
    checks = {}

    # Database check
    try:
        start = time.monotonic()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency_ms = int((time.monotonic() - start) * 1000)
        checks["database"] = {"status": "ok", "latency_ms": latency_ms}
    except Exception as e:
        checks["database"] = {"status": "unhealthy", "error": str(e)}
        overall = "unhealthy"

    # pgvector check (virtual check, falls back to native array if extension is missing)
    try:
        start = time.monotonic()
        async with engine.connect() as conn:
            result = await conn.execute(
                text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
            )
            row = result.fetchone()
        latency_ms = int((time.monotonic() - start) * 1000)
        checks["pgvector"] = {
            "status": "ok",
            "extension_version": row[0] if row else None,
            "latency_ms": latency_ms,
            "info": "using postgres pgvector extension" if row else "using native array fallback",
        }
    except Exception as e:
        checks["pgvector"] = {
            "status": "ok",
            "error": str(e),
            "info": "using native array fallback",
        }

    # Redis check (optional — jobs run inline when not configured)
    if not settings.redis.url:
        checks["redis"] = {"status": "disabled", "info": "not configured — jobs run in-process"}
    else:
        try:
            start = time.monotonic()
            import redis.asyncio as aioredis
            r = aioredis.Redis.from_url(str(settings.redis.url))
            await r.ping()
            await r.aclose()
            latency_ms = int((time.monotonic() - start) * 1000)
            checks["redis"] = {"status": "ok", "latency_ms": latency_ms}
        except Exception as e:
            checks["redis"] = {"status": "degraded", "error": str(e)}
            if overall == "healthy":
                overall = "degraded"

    # Storage check
    try:
        start = time.monotonic()
        storage_ok = await storage_backend.health_check()
        latency_ms = int((time.monotonic() - start) * 1000)
        checks["storage"] = {
            "status": "ok" if storage_ok else "degraded",
            "backend": settings.storage.backend,
            "latency_ms": latency_ms,
        }
        if not storage_ok and overall == "healthy":
            overall = "degraded"
    except Exception as e:
        checks["storage"] = {"status": "degraded", "error": str(e)}
        if overall == "healthy":
            overall = "degraded"

    # OpenAI API check (lightweight)
    try:
        start = time.monotonic()
        from backend.services.openai_client import get_client
        client = get_client()
        # List models as a lightweight health check
        await client.models.list()
        latency_ms = int((time.monotonic() - start) * 1000)
        checks["openai_api"] = {"status": "ok", "latency_ms": latency_ms}
    except Exception as e:
        checks["openai_api"] = {"status": "degraded", "error": str(e)}
        if overall == "healthy":
            overall = "degraded"

    return {
        "status": overall,
        "checks": checks,
        "version": "1.0.0",
        "uptime_seconds": int(time.time() - START_TIME),
    }


@router.get("/api/metrics")
async def metrics_endpoint(request: Request):
    """Prometheus metrics endpoint.
    Access can be restricted with METRICS_ALLOWED_CIDR.
    """
    if not settings.enable_metrics:
        raise HTTPException(status_code=404, detail="Metrics are disabled.")

    allowed_cidr = settings.metrics_allowed_cidr
    if allowed_cidr:
        client_host = request.client.host if request.client else ""
        if not client_host:
            raise HTTPException(status_code=403, detail="Metrics access denied.")
        try:
            allowed_network = ip_network(allowed_cidr, strict=False)
        except ValueError:
            raise HTTPException(status_code=500, detail="Invalid METRICS_ALLOWED_CIDR configuration.")
        try:
            client_ip = ip_address(client_host)
        except ValueError:
            raise HTTPException(status_code=403, detail="Metrics access denied.")
        if client_ip not in allowed_network:
            raise HTTPException(status_code=403, detail="Metrics access denied.")

    metrics_data = await generate_metrics()
    from fastapi.responses import Response as FastResponse
    return FastResponse(
        content=metrics_data,
        media_type="text/plain; version=0.0.4",
    )
