"""Phase 5: pgvector migration — convert embeddings to vector type, create HNSW index

Revision ID: a1b2c3d4e5f6
Revises: 022407ca7fbe
Create Date: 2026-07-27

Steps:
  1. Install pgvector extension (skip gracefully if not installed)
  2. Convert document_chunks.embedding from double precision[] to vector(1536)
  3. Create HNSW index for fast approximate nearest neighbor search

NOTE: pgvector extension files must be installed in PostgreSQL before running.
      https://github.com/andreiramani/pgvector_pgsql_windows/releases
      document_chunks is currently empty (0 rows) — safe conversion.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '022407ca7fbe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIM = 1536  # text-embedding-3-small dimension


def _pgvector_available() -> bool:
    """Check if pgvector extension is available in the database."""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_available_extensions WHERE name = 'vector'"
    ))
    return result.scalar() is not None


def upgrade() -> None:
    if not _pgvector_available():
        op.execute("DO $$ BEGIN RAISE NOTICE 'pgvector not available — skipping Phase 5'; END $$;")
        return

    # Step 1: Install pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Step 2: Convert embedding column from ARRAY to vector(1536)
    op.execute(f"""
        ALTER TABLE public.document_chunks
        DROP COLUMN IF EXISTS embedding
    """)

    op.execute(f"""
        ALTER TABLE public.document_chunks
        ADD COLUMN embedding vector({EMBEDDING_DIM})
    """)

    # Step 3: Create HNSW index for fast ANN search
    # cosine distance operator: vector_cosine_ops
    # m=16 (connections per layer), ef_construction=64 (build quality)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding_hnsw
        ON public.document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)


def downgrade() -> None:
    if not _pgvector_available():
        return

    # Drop HNSW index
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_embedding_hnsw")

    # Convert back to ARRAY(Float)
    op.execute("""
        ALTER TABLE public.document_chunks
        DROP COLUMN IF EXISTS embedding
    """)
    op.execute("""
        ALTER TABLE public.document_chunks
        ADD COLUMN embedding double precision[]
    """)
