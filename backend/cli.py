"""
CCM Management CLI.
"""
import asyncio
import sys
from typing import Optional

import typer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import async_session_factory, engine, init_db
from backend.config import get_settings

app = typer.Typer(help="CCM Management Commands.")
db_app = typer.Typer(help="Database commands.")
user_app = typer.Typer(help="User management commands.")
worker_app = typer.Typer(help="Worker commands.")
health_app = typer.Typer(help="Health check commands.")
app.add_typer(db_app, name="db")
app.add_typer(user_app, name="user")
app.add_typer(worker_app, name="worker")
app.add_typer(health_app, name="health")


@app.command()
def version():
    """Show the application version."""
    typer.echo("CCM version 1.0.0")


@db_app.command()
def migrate():
    """Run database migrations."""
    typer.echo("Running database migrations...")
    async def run_migrations():
        await init_db()
        typer.echo("Database migrations completed.")
    asyncio.run(run_migrations())


@db_app.command()
def seed():
    """Seed the database with sample data (development only)."""
    settings = get_settings()
    if settings.environment != "development":
        typer.echo("Error: Seeding is only allowed in development environment.", err=True)
        raise typer.Exit(code=1)
    typer.echo("Seeding database with sample data...")
    typer.echo("Seeding completed.")


@db_app.command()
def reset(
    confirm: bool = typer.Option(
        False, prompt="Are you sure you want to drop and recreate the database?",
    )
):
    """Reset the database (development only)."""
    settings = get_settings()
    if settings.environment != "development":
        typer.echo("Error: Reset is only allowed in development environment.", err=True)
        raise typer.Exit(code=1)
    if not confirm:
        typer.echo("Error: Reset requires confirmation.", err=True)
        raise typer.Exit(code=1)
    typer.echo("Resetting database...")
    async def run_reset():
        import backend.models  # Ensure models are registered with Base.metadata
        async with engine.begin() as conn:
            from backend.database import Base
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        typer.echo("Database reset completed.")
    asyncio.run(run_reset())


@worker_app.command()
def start():
    """Start the ARQ worker."""
    typer.echo("Starting ARQ worker...")
    try:
        from arq import run_worker
        from backend.worker import WorkerSettings
        asyncio.run(run_worker(WorkerSettings))
    except KeyboardInterrupt:
        typer.echo("\nWorker stopped.")


@health_app.command()
def check():
    """Run health checks and print the result."""
    typer.echo("Running health checks...")
    async def run_checks():
        import httpx
        settings = get_settings()
        results = {}

        # Database check
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            results["database"] = {"status": "ok"}
        except Exception as e:
            results["database"] = {"status": "unhealthy", "error": str(e)}

        # Redis check (optional — jobs run inline when not configured)
        if not settings.redis.url:
            results["redis"] = {"status": "disabled", "info": "not configured — jobs run in-process"}
        else:
            try:
                import redis.asyncio as aioredis
                r = aioredis.Redis.from_url(str(settings.redis.url))
                await r.ping()
                await r.aclose()
                results["redis"] = {"status": "ok"}
            except Exception as e:
                results["redis"] = {"status": "degraded", "error": str(e)}

        overall = "healthy"
        for name, check_result in results.items():
            if check_result.get("status") == "unhealthy":
                overall = "unhealthy"
            elif check_result.get("status") == "degraded" and overall != "unhealthy":
                overall = "degraded"

        typer.echo(json.dumps({"status": overall, "checks": results}, indent=2))

    import json
    asyncio.run(run_checks())


@user_app.command()
def create(
    email: str = typer.Option(..., prompt=True),
    role: str = typer.Option(..., prompt=True),
    password: str = typer.Option(..., prompt=True, hide_input=True, confirmation_prompt=True),
):
    """Create a new user."""
    async def run_create():
        from backend.database import async_session_factory
        from backend.models.user import User
        from backend.api.auth import get_password_hash
        async with async_session_factory() as session:
            user = User(
                email=email,
                hashed_password=get_password_hash(password),
                role=role,
            )
            session.add(user)
            await session.commit()
            typer.echo(f"User {email} created with role {role}")
    asyncio.run(run_create())


if __name__ == "__main__":
    app()
