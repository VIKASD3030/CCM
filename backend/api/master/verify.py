"""verifyDbConnection — served at root path (the frontend calls /verifyDbConnection)."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db

router = APIRouter(tags=["master-common"])


@router.get("/verifyDbConnection")
@router.get("/common/verifyDbConnection")
async def verify_db_connection(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "message": "Connection successful"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
