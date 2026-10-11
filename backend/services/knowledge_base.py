"""
Phase 1 — Knowledge Base Service.
Handles document upload, text extraction (with OCR for scans), chunking, embedding,
and search over a project's contract volumes and letters.
PostgreSQL 16 + pgvector for vector similarity; Postgres full-text search as the
keyword half of the hybrid ranker and as a fallback when embeddings are unavailable.
"""
import asyncio
import bisect
import hashlib
import io
import re
import uuid
import zipfile
from dataclasses import dataclass, field

import structlog

from backend.config import get_settings
from backend.models.document import KnowledgeDocument, DocumentChunk
from backend.models.audit import AuditEntry
from backend.services.webhook_service import dispatch_event
from backend.services.storage import storage_backend
from backend.services import openai_client
from backend.services import correspondence

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()
settings = get_settings()

# Project folders. A document's folder decides how it is chunked and how much
# of the drafting context it may take (see services/drafting.py).
DOCUMENT_TYPES = ("contract_volume", "outgoing_letter", "incoming_letter")
LETTER_TYPES = ("outgoing_letter", "incoming_letter")

CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
}
SUPPORTED_TYPES = tuple(CONTENT_TYPES)

# A scanned page has (almost) no text layer.
OCR_MIN_TEXT_CHARS = 25
MAX_OCR_PAGES = 120
OCR_CONCURRENCY = 3
OCR_PROMPT = (
    "Transcribe all the text on this scanned page exactly as written, in reading order. "
    "Keep reference numbers, dates, clause numbers and table rows. Include text from "
    "letterheads and stamps. Return only the text."
)

# Clause headings at the start of a line: "20.1 Notice of Claims",
# "Clause 20 ...", "Sub-Clause 20.1: ...", "Article 5 ...". A bare number needs a
# sub-level ("20.1") so ordinary numbered lists ("1. The ...") don't count.
_CLAUSE_HEADING_RE = re.compile(
    r"^[ \t]*(?:#+[ \t]*)?(?:\*\*)?"
    r"(?:(?:Sub-?Clause|Clause|Article)[ \t]+(\d{1,2}(?:\.\d{1,2}){0,3})"  # "Clause 20", "Article 5.1"
    r"|(\d{1,2}(?:\.\d{1,2}){1,3}))"                                       # bare "20.1" (not "1.")
    r"[ \t.:)\-]+[A-Za-z]",
    re.IGNORECASE | re.MULTILINE,
)
# Clause references anywhere in prose: "Clause 20.1", "Sub-Clause 8.4", "Cl. 14".
CLAUSE_REF_RE = re.compile(r"(?:Sub-?Clause|Clause|Cl\.?)\s+(\d{1,2}(?:\.\d{1,2}){0,3})", re.IGNORECASE)

_VOLUME_RE = re.compile(r"\bvol(?:ume)?[\s._-]*([ivx]{1,4}|\d{1,2})\b", re.IGNORECASE)
_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]


def _heading_no(m: re.Match) -> str:
    return m.group(1) or m.group(2)


def detect_volume_label(filename: str | None) -> str | None:
    """'Vol I - Conditions.pdf' -> 'Volume I'."""
    m = _VOLUME_RE.search(filename or "")
    if not m:
        return None
    v = m.group(1)
    return f"Volume {_ROMAN[int(v)] if v.isdigit() and int(v) < len(_ROMAN) else v.upper()}"


# ── Extraction ──────────────────────────────────────────────────────────────

@dataclass
class ExtractedDocument:
    text: str
    # Character offset where each page starts; empty when the format has no pages.
    page_starts: list[int] = field(default_factory=list)
    page_count: int | None = None
    ocr_pages: int = 0
    notes: list[str] = field(default_factory=list)


def page_at(offset: int, page_starts: list[int]) -> int | None:
    """1-based page containing character `offset`."""
    if not page_starts:
        return None
    return max(1, bisect.bisect_right(page_starts, offset))


def _tesseract_available() -> bool:
    import shutil
    return bool(shutil.which("tesseract"))


async def _ocr_pixmap_png(png: bytes, page_no: int, local_page=None) -> str:
    """OCR one rendered page: local Tesseract when installed, else the vision model."""
    if local_page is not None and _tesseract_available():
        try:
            def run() -> str:
                tp = local_page.get_textpage_ocr(language="eng", dpi=200, full=True)
                return local_page.get_text("text", textpage=tp)
            return (await asyncio.to_thread(run)).strip()
        except Exception as e:  # noqa: BLE001 — fall through to the vision model
            logger.warning("kb.local_ocr_failed", page=page_no, error=str(e))
    return (await openai_client.call_openai_vision_async(
        text=OCR_PROMPT, image_data=png, mime_type="image/png",
        temperature=0.0, max_output_tokens=4096,
    )).strip()


async def _extract_pdf(content: bytes) -> ExtractedDocument:
    import pymupdf

    # Read from memory: no temp file, so nothing is left open or locked (Windows).
    doc = pymupdf.open(stream=content, filetype="pdf")
    try:
        n = len(doc)
        texts: list[str] = [""] * n
        scanned: list[int] = []

        # Digital pages: markdown keeps headings and tables.
        markdown_pages: dict[int, str] = {}
        try:
            import pymupdf4llm
            chunks = pymupdf4llm.to_markdown(doc, page_chunks=True)
            for i, c in enumerate(chunks):
                markdown_pages[i] = c.get("text", "") if isinstance(c, dict) else str(c)
        except Exception as e:  # noqa: BLE001
            logger.warning("kb.pymupdf4llm_failed", error=str(e))

        for i in range(n):
            plain = doc[i].get_text("text") or ""
            if len(plain.strip()) < OCR_MIN_TEXT_CHARS and doc[i].get_images():
                scanned.append(i)
            else:
                page_text = (markdown_pages.get(i) or plain).strip()
                # The markdown converter ends each page with a "-----" rule.
                texts[i] = re.sub(r"\n+-{3,}\s*$", "", page_text).strip()

        notes: list[str] = []
        ocr_done = 0
        if scanned:
            to_read = scanned[:MAX_OCR_PAGES]
            if len(scanned) > MAX_OCR_PAGES:
                notes.append(f"Only the first {MAX_OCR_PAGES} scanned pages were read with OCR.")
            sem = asyncio.Semaphore(OCR_CONCURRENCY)
            errors: dict[int, str] = {}

            async def read(i: int) -> None:
                async with sem:
                    try:
                        png = doc[i].get_pixmap(dpi=170).tobytes("png")
                        texts[i] = await _ocr_pixmap_png(png, i + 1, local_page=doc[i])
                    except Exception as e:  # noqa: BLE001
                        errors[i] = str(e).splitlines()[0][:160]

            await asyncio.gather(*(read(i) for i in to_read))
            ocr_done = sum(1 for i in to_read if texts[i])
            failed = sorted(i + 1 for i in errors)
            if failed:
                listed = ", ".join(map(str, failed[:8])) + ("…" if len(failed) > 8 else "")
                notes.append(f"OCR could not read page(s) {listed}: {next(iter(errors.values()))}")
            if not any(t.strip() for t in texts):
                raise ValueError(
                    "This is a scanned document and its pages could not be read with OCR. "
                    + (notes[-1] if notes else "")
                )

        starts: list[int] = []
        parts: list[str] = []
        pos = 0
        for t in texts:
            starts.append(pos)
            parts.append(t)
            pos += len(t) + 2  # joined with a blank line
        return ExtractedDocument("\n\n".join(parts), starts, n, ocr_done, notes)
    finally:
        doc.close()


async def extract_document_from_bytes(content: bytes, file_type: str, filename: str = "") -> ExtractedDocument:
    """Extract text from a file's bytes. PDF (with OCR for scanned pages), DOCX, TXT, images."""
    file_type = file_type.lower()
    if file_type == "pdf":
        return await _extract_pdf(content)
    if file_type == "docx":
        import docx
        doc = docx.Document(io.BytesIO(content))
        parts = [paragraph.text for paragraph in doc.paragraphs]
        # Rate schedules and payment tables live in tables, not paragraphs.
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells]
                if any(cells):
                    parts.append(" | ".join(cells))
        return ExtractedDocument("\n".join(parts))
    if file_type == "txt":
        return ExtractedDocument(content.decode("utf-8", errors="replace"))
    if file_type in ("jpg", "jpeg", "png"):
        mime_type = "image/jpeg" if file_type in ("jpg", "jpeg") else "image/png"
        try:
            text_ = await openai_client.call_openai_vision_async(
                text=OCR_PROMPT, image_data=content, mime_type=mime_type,
                temperature=0.0, max_output_tokens=4096,
            )
        except Exception as e:  # noqa: BLE001
            raise ValueError(f"The image could not be read with OCR: {str(e).splitlines()[0][:160]}") from e
        return ExtractedDocument(text_.strip(), [0], 1, 1)
    raise ValueError(f"Unsupported file type: {file_type}. Supported types: {', '.join(SUPPORTED_TYPES)}")


async def extract_document_from_file(file_path: str, file_type: str) -> ExtractedDocument:
    with open(file_path, "rb") as fh:
        return await extract_document_from_bytes(fh.read(), file_type, file_path)


async def extract_text_from_file(file_path: str, file_type: str) -> str:
    return (await extract_document_from_file(file_path, file_type)).text


async def extract_text_from_bytes(content: bytes, file_type: str, filename: str) -> str:
    return (await extract_document_from_bytes(content, file_type, filename)).text


# ── Chunking ────────────────────────────────────────────────────────────────

_WORD_RE = re.compile(r"\S+")


def chunk_spans(text: str, chunk_size: int = None, overlap: int = None) -> list[tuple[str, int, int]]:
    """Overlapping word-window chunks as (chunk, start_offset, end_offset)."""
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap if overlap is not None else settings.chunk_overlap
    spans = [(m.start(), m.end()) for m in _WORD_RE.finditer(text)]
    n = len(spans)
    out: list[tuple[str, int, int]] = []
    start = 0
    while start < n:
        end = min(start + chunk_size, n)
        words = [text[a:b] for a, b in spans[start:end]]
        out.append((" ".join(words), spans[start][0], spans[end - 1][1]))
        if end >= n:
            break
        start = end - overlap
    return out


def chunk_text(text: str, chunk_size: int = None, overlap: int = None) -> list[str]:
    """Split text into overlapping chunks by word count."""
    return [c for c, _, _ in chunk_spans(text, chunk_size, overlap)]


def count_clauses(raw_text: str, document_type: str | None) -> int:
    if document_type != "contract_volume" or not raw_text:
        return 0
    return len({_heading_no(m) for m in _CLAUSE_HEADING_RE.finditer(raw_text)})


def build_chunks(raw_text: str, document_type: str | None) -> list[dict]:
    """Chunks as {clause_no, text, start, end}. Contract volumes are split along
    clause headings so a clause is never cut in half; everything else by word count."""
    if document_type != "contract_volume":
        return [{"clause_no": None, "text": c, "start": a, "end": b} for c, a, b in chunk_spans(raw_text)]

    headings = list(_CLAUSE_HEADING_RE.finditer(raw_text))
    if not headings:
        return [{"clause_no": None, "text": c, "start": a, "end": b} for c, a, b in chunk_spans(raw_text)]

    sections: list[tuple[str | None, int, int]] = []
    if raw_text[: headings[0].start()].strip():
        sections.append((None, 0, headings[0].start()))
    for i, m in enumerate(headings):
        end = headings[i + 1].start() if i + 1 < len(headings) else len(raw_text)
        sections.append((_heading_no(m), m.start(), end))

    out: list[dict] = []
    for clause_no, a, b in sections:
        body = raw_text[a:b]
        if not body.strip():
            continue
        if len(body.split()) <= settings.chunk_size:
            out.append({"clause_no": clause_no, "text": body.strip(), "start": a, "end": b})
        else:
            for piece, pa, pb in chunk_spans(body):
                out.append({"clause_no": clause_no, "text": piece, "start": a + pa, "end": a + pb})
    return out


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings in batches with error handling."""
    embeddings = []
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i: i + batch_size]
        try:
            batch_embeddings = await openai_client.generate_embedding_async(batch)
            for emb in batch_embeddings:
                embeddings.append(emb)
        except Exception as e:
            logger.error("kb.embedding_generation_failed", batch_start=i, error=str(e))
            embeddings.extend([None] * len(batch))

    return embeddings


# ── Indexing ────────────────────────────────────────────────────────────────

async def index_document_text(
    db: AsyncSession,
    doc: KnowledgeDocument,
    raw_text: str,
    page_starts: list[int] | None = None,
) -> int:
    """Chunk, embed and store `raw_text` for `doc`. Returns the chunk count.

    Chunks of paged documents (PDFs) record the pages they come from. If the
    embedding service is unavailable the chunks are still stored, so the
    document is searchable by keyword; `status_detail` says so.
    """
    pieces = build_chunks(raw_text, doc.document_type)
    if not pieces:
        doc.status = "failed"
        doc.chunk_count = 0
        doc.status_detail = "No readable text was found in this document."
        await db.flush()
        return 0

    embeddings = await generate_embeddings([p["text"] for p in pieces])

    existing = await db.execute(select(DocumentChunk).where(DocumentChunk.document_id == doc.id))
    for old in existing.scalars().all():
        await db.delete(old)

    for idx, (piece, embedding) in enumerate(zip(pieces, embeddings)):
        db.add(DocumentChunk(
            document_id=doc.id,
            chunk_index=idx,
            chunk_text=piece["text"],
            clause_no=piece["clause_no"],
            page_from=page_at(piece["start"], page_starts or []),
            page_to=page_at(max(piece["start"], piece["end"] - 1), page_starts or []),
            embedding=embedding,
            metadata_={
                "filename": doc.filename,
                "category": doc.category,
                "document_type": doc.document_type,
                "chunk_index": idx,
                "total_chunks": len(pieces),
            },
        ))

    doc.chunk_count = len(pieces)
    doc.clause_count = count_clauses(raw_text, doc.document_type)
    doc.status = "indexed"
    if all(e is None for e in embeddings):
        note = "Indexed for keyword search only: the embedding service was unavailable (check the API key), so similarity search can't use this document yet. Re-index it once the key works."
        doc.status_detail = f"{doc.status_detail} {note}".strip() if doc.status_detail else note
    await db.flush()
    return len(pieces)


async def process_document(db: AsyncSession, doc: KnowledgeDocument, content: bytes) -> int:
    """Read a stored document end to end: extract (OCR if scanned) -> metadata ->
    chunk -> embed. Sets page/OCR counts, correspondence metadata and status."""
    extracted = await extract_document_from_bytes(content, doc.file_type, doc.filename)
    doc.raw_text = extracted.text
    doc.page_count = extracted.page_count
    doc.ocr_pages = extracted.ocr_pages
    doc.status_detail = " ".join(extracted.notes) or None

    if doc.document_type in LETTER_TYPES:
        meta = correspondence.extract_metadata(extracted.text, doc.filename)
        # Explicit values (e.g. set when an approved reply is filed) win over guesses.
        doc.ref_no = doc.ref_no or meta["ref_no"]
        doc.doc_date = doc.doc_date or meta["doc_date"]
        doc.subject = doc.subject or meta["subject"]
        if not doc.referenced_refs:
            doc.referenced_refs = meta["referenced_refs"]
    elif doc.document_type == "contract_volume":
        doc.volume_label = doc.volume_label or detect_volume_label(doc.filename)

    return await index_document_text(db, doc, extracted.text, extracted.page_starts)


class DuplicateDocumentError(Exception):
    def __init__(self, existing: KnowledgeDocument):
        super().__init__(f"{existing.filename} is already in this project")
        self.existing = existing


async def find_duplicate(db: AsyncSession, project_id: str | None, checksum: str) -> KnowledgeDocument | None:
    if not project_id:
        return None
    return (await db.execute(
        select(KnowledgeDocument).where(
            KnowledgeDocument.project_id == project_id,
            KnowledgeDocument.checksum == checksum,
        ).limit(1)
    )).scalar_one_or_none()


async def init_document(
    db: AsyncSession,
    filename: str,
    content: bytes,
    file_type: str,
    category: str = "general",
    user_id: uuid.UUID = None,
    project_id: str | None = None,
    document_type: str | None = None,
    metadata: dict | None = None,
) -> KnowledgeDocument:
    """
    Create a document record and save the file to storage.
    Heavy work (OCR, chunking, embedding) happens in the background job.
    Raises DuplicateDocumentError if the same file is already in the project.
    """
    checksum = hashlib.sha256(content).hexdigest()
    duplicate = await find_duplicate(db, project_id, checksum)
    if duplicate:
        raise DuplicateDocumentError(duplicate)

    storage_key = f"kb/{uuid.uuid4()}/{filename}"
    await storage_backend.upload(content, storage_key, CONTENT_TYPES.get(file_type, "application/octet-stream"))

    meta = metadata or {}
    doc = KnowledgeDocument(
        filename=filename,
        file_type=file_type,
        category=category,
        status="processing",
        storage_path=storage_key,
        uploaded_by=user_id,
        project_id=project_id,
        document_type=document_type,
        checksum=checksum,
        ref_no=meta.get("ref_no"),
        doc_date=meta.get("doc_date"),
        subject=meta.get("subject"),
        referenced_refs=meta.get("referenced_refs"),
    )
    db.add(doc)
    await db.flush()

    logger.info("kb.document.initialized", document_id=str(doc.id), filename=filename)
    return doc


async def ingest_document(
    db: AsyncSession,
    filename: str,
    content: bytes,
    file_type: str,
    category: str = "general",
    user_id: uuid.UUID = None,
    project_id: str | None = None,
    document_type: str | None = None,
    metadata: dict | None = None,
) -> KnowledgeDocument:
    """
    Full ingestion pipeline in one call: store -> extract -> chunk -> embed.
    Dispatches webhook on completion.
    """
    doc = await init_document(
        db, filename, content, file_type, category, user_id,
        project_id=project_id, document_type=document_type, metadata=metadata,
    )
    try:
        chunk_total = await process_document(db, doc, content)
        if not chunk_total:
            return doc

        audit = AuditEntry(
            entity_type="document",
            entity_id=str(doc.id),
            action="uploaded_and_indexed",
            user_id=user_id,
            details={
                "filename": filename,
                "category": category,
                "document_type": document_type,
                "chunks": chunk_total,
            },
        )
        db.add(audit)

        await db.flush()
        logger.info("kb.document_ingested", filename=filename, chunks=chunk_total, user_id=str(user_id) if user_id else None)

        # Dispatch webhook (fire-and-forget)
        await dispatch_event("kb.document_added", {
            "document_id": str(doc.id),
            "filename": filename,
            "category": category,
            "chunks": chunk_total,
            "uploaded_by": str(user_id) if user_id else None,
        })

    except Exception as e:
        doc.status = "failed"
        doc.status_detail = str(e).splitlines()[0][:500]
        logger.error("kb.document_ingest_failed", filename=filename, error=str(e))
        raise

    return doc


async def import_zip(
    db: AsyncSession,
    content: bytes,
    project_id: str,
    document_type: str,
    user_id: uuid.UUID,
    max_files: int = 500,
    max_total_bytes: int = 500 * 1024 * 1024,
) -> dict:
    """Bulk import: every PDF/DOCX/TXT/image in a ZIP becomes a document in the
    project folder. Duplicates (same checksum) are skipped. Returns the created
    documents (still "processing") and what was skipped, so the caller can start
    their indexing jobs.
    """
    result: dict = {"created": [], "duplicates": [], "skipped": [], "errors": []}
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as e:
        raise ValueError("This file is not a valid ZIP archive") from e

    entries = [i for i in zf.infolist() if not i.is_dir()]
    if sum(i.file_size for i in entries) > max_total_bytes:
        raise ValueError("The ZIP is larger than 500 MB when unpacked")
    if len(entries) > max_files * 4:
        raise ValueError(f"The ZIP has too many entries ({len(entries)})")

    from backend.services.file_validator import validate_file

    for info in entries:
        name = info.filename.replace("\\", "/").split("/")[-1]
        if not name or name.startswith(".") or "__MACOSX" in info.filename:
            continue
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
        if ext not in SUPPORTED_TYPES:
            result["skipped"].append({"filename": name, "reason": f"Unsupported file type .{ext}" if ext else "No file extension"})
            continue
        if len(result["created"]) >= max_files:
            result["skipped"].append({"filename": name, "reason": f"Over the {max_files}-file limit"})
            continue
        try:
            data = zf.read(info)
            await validate_file(data, name)
            doc = await init_document(
                db, name, data, ext, document_type, user_id,
                project_id=project_id, document_type=document_type,
            )
            result["created"].append(doc)
        except DuplicateDocumentError as dup:
            result["duplicates"].append({"filename": name, "existing_id": str(dup.existing.id)})
        except Exception as e:  # noqa: BLE001 — one bad file must not stop the import
            result["errors"].append({"filename": name, "error": str(e).splitlines()[0][:200]})
    return result


async def get_document_file(db: AsyncSession, document_id: str) -> tuple[bytes, str, str] | None:
    """The original uploaded file: (bytes, content_type, filename)."""
    doc = await db.get(KnowledgeDocument, str(document_id))
    if not doc or not doc.storage_path:
        return None
    return (
        await storage_backend.download(doc.storage_path),
        CONTENT_TYPES.get(doc.file_type, "application/octet-stream"),
        doc.filename,
    )


# ── Search ──────────────────────────────────────────────────────────────────

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors. Kept as fallback."""
    import math
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# Whether this database has a usable pgvector `vector` type / `<=>` operator.
# Probed lazily on first search; None = unknown, True/False = probed result.
_pgvector_available: bool | None = None

_STOPWORDS = frozenset(
    "this that with from have been were will shall which their there than then them they your "
    "also such into upon under over only other more most some these those would could should "
    "about after before between because while where when whom whose letter please kindly regards "
    "dear sir madam subject reference refer regarding".split()
)


def significant_tokens(text_: str, limit: int = 30) -> list[str]:
    """Distinctive words of a query: the longest distinct non-stopword tokens."""
    seen: dict[str, None] = {}
    for tok in re.findall(r"[A-Za-z][A-Za-z0-9]{3,}|\d{3,}", text_ or ""):
        t = tok.lower()
        if t not in _STOPWORDS:
            seen.setdefault(t)
    return sorted(seen, key=len, reverse=True)[:limit]


def lexical_overlap(query_tokens: list[str], chunk_text_: str) -> float:
    """Share of the query's distinctive tokens that appear in the chunk (0..1)."""
    if not query_tokens:
        return 0.0
    hay = (chunk_text_ or "").lower()
    return sum(1 for t in query_tokens if t in hay) / len(query_tokens)


def _build_chunk_filters(
    category: str = None,
    project_id: str = None,
    user_id: uuid.UUID = None,
    user_role: str = None,
    document_type: str = None,
) -> tuple[list[str], dict]:
    """Shared WHERE clauses + params for the search implementations."""
    where_clauses = ["kd.status = 'indexed'"]
    params: dict = {}
    if project_id:
        where_clauses.append("kd.project_id = :project_id")
        params["project_id"] = str(project_id)
    if user_role != "admin" and user_id is not None:
        where_clauses.append("kd.uploaded_by = :user_id")
        params["user_id"] = str(user_id)
    if category:
        where_clauses.append("kd.category = :category")
        params["category"] = category
    if document_type:
        where_clauses.append("kd.document_type = :document_type")
        params["document_type"] = document_type
    return where_clauses, params


_RESULT_COLUMNS = """
            dc.id AS chunk_id,
            dc.document_id,
            dc.chunk_text,
            dc.chunk_index,
            dc.clause_no,
            dc.page_from,
            dc.page_to,
            kd.document_type,
            kd.filename,
            kd.volume_label,
            kd.ref_no,
            kd.doc_date,
            dc.metadata"""


def _row_to_result(row, similarity: float) -> dict:
    return {
        "chunk_id": str(row.chunk_id),
        "document_id": str(row.document_id),
        "chunk_text": row.chunk_text,
        "chunk_index": row.chunk_index,
        "clause_no": row.clause_no,
        "page_from": row.page_from,
        "page_to": row.page_to,
        "document_type": row.document_type,
        "filename": row.filename,
        "volume_label": row.volume_label,
        "ref_no": row.ref_no,
        "doc_date": row.doc_date.isoformat() if row.doc_date else None,
        "similarity": round(float(similarity), 4),
        "metadata": row.metadata if row.metadata else {},
    }


async def search_similar_chunks(
    db: AsyncSession,
    query_text: str,
    top_k: int = 5,
    category: str = None,
    project_id: str = None,
    user_id: uuid.UUID = None,
    user_role: str = None,
    document_type: str = None,
    query_vec: list[float] | None = None,
) -> list[dict]:
    """
    Semantic search over indexed document chunks.

    Uses pgvector's native `<=>` cosine-distance operator when the database has
    the extension; otherwise falls back to fetching candidate chunks and scoring
    them with cosine similarity in Python. Scoped to project_id if provided — no
    cross-project retrieval by default. Pass `query_vec` to reuse an embedding
    across several searches.
    """
    global _pgvector_available

    if query_vec is None:
        query_embeddings = await generate_embeddings([query_text])
        if not query_embeddings or query_embeddings[0] is None:
            return []
        query_vec = query_embeddings[0]

    if _pgvector_available is not False:
        try:
            # Run inside a SAVEPOINT so a "type vector does not exist" failure
            # rolls back only this nested block, leaving the caller's outer
            # transaction (and its ORM identity map) intact.
            async with db.begin_nested():
                results = await _search_pgvector(
                    db, query_vec, top_k, category, project_id, user_id, user_role, document_type
                )
            _pgvector_available = True
            return results
        except Exception as e:  # noqa: BLE001 — any DB error here => no usable pgvector
            if _pgvector_available is None:
                logger.warning(
                    "kb.pgvector_unavailable_fallback_python",
                    error=str(e).splitlines()[0][:200],
                )
            _pgvector_available = False

    return await _search_python_cosine(
        db, query_vec, top_k, category, project_id, user_id, user_role, document_type
    )


async def _search_pgvector(
    db: AsyncSession,
    query_vec: list[float],
    top_k: int,
    category: str,
    project_id: str,
    user_id: uuid.UUID,
    user_role: str,
    document_type: str = None,
) -> list[dict]:
    """Native pgvector search path."""
    where_clauses, params = _build_chunk_filters(category, project_id, user_id, user_role, document_type)
    params["query_embedding"] = "[" + ",".join(str(v) for v in query_vec) + "]"
    params["top_k"] = top_k
    where_sql = " AND ".join(where_clauses)

    # NOTE: CAST(:param AS vector), not :param::vector — SQLAlchemy's text()
    # bind-param parser ignores a :name immediately followed by "::" (a Postgres
    # cast), leaving the literal ":query_embedding" to reach asyncpg and blow up
    # with `syntax error at or near ":"`.
    sql = text(f"""
        SELECT {_RESULT_COLUMNS},
            (dc.embedding <=> CAST(:query_embedding AS vector)) AS distance
        FROM document_chunks dc
        JOIN knowledge_documents kd ON dc.document_id = kd.id
        WHERE {where_sql}
            AND dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> CAST(:query_embedding AS vector)
        LIMIT :top_k
    """)

    result = await db.execute(sql, params)
    return [_row_to_result(row, 1.0 - float(row.distance)) for row in result.fetchall()]


async def _search_python_cosine(
    db: AsyncSession,
    query_vec: list[float],
    top_k: int,
    category: str,
    project_id: str,
    user_id: uuid.UUID,
    user_role: str,
    document_type: str = None,
) -> list[dict]:
    """Fallback: pull candidate chunks and rank by cosine similarity in Python.

    Used when the database has no pgvector extension. `embedding` is a
    ``double precision[]`` column, returned by asyncpg as a plain list.
    """
    where_clauses, params = _build_chunk_filters(category, project_id, user_id, user_role, document_type)
    where_sql = " AND ".join(where_clauses)

    sql = text(f"""
        SELECT {_RESULT_COLUMNS},
            dc.embedding AS embedding
        FROM document_chunks dc
        JOIN knowledge_documents kd ON dc.document_id = kd.id
        WHERE {where_sql}
            AND dc.embedding IS NOT NULL
    """)

    rows = (await db.execute(sql, params)).fetchall()

    scored = []
    for row in rows:
        emb = row.embedding
        if not emb:
            continue
        scored.append((cosine_similarity(query_vec, list(emb)), row))
    scored.sort(key=lambda t: t[0], reverse=True)

    return [_row_to_result(row, sim) for sim, row in scored[:top_k]]


async def search_lexical(
    db: AsyncSession,
    query_text: str,
    top_k: int = 5,
    category: str = None,
    project_id: str = None,
    user_id: uuid.UUID = None,
    user_role: str = None,
    document_type: str = None,
) -> list[dict]:
    """Keyword search (Postgres full-text). Works without embeddings."""
    tokens = significant_tokens(query_text)
    if not tokens:
        return []
    where_clauses, params = _build_chunk_filters(category, project_id, user_id, user_role, document_type)
    params["tsq"] = " | ".join(tokens)
    params["top_k"] = top_k
    where_sql = " AND ".join(where_clauses)
    sql = text(f"""
        SELECT {_RESULT_COLUMNS},
            ts_rank(to_tsvector('simple', dc.chunk_text), q.query, 32) AS rank
        FROM document_chunks dc
        JOIN knowledge_documents kd ON dc.document_id = kd.id,
             to_tsquery('simple', :tsq) AS q(query)
        WHERE {where_sql}
            AND to_tsvector('simple', dc.chunk_text) @@ q.query
        ORDER BY rank DESC
        LIMIT :top_k
    """)
    rows = (await db.execute(sql, params)).fetchall()
    return [_row_to_result(row, row.rank) for row in rows]


async def search_hybrid(
    db: AsyncSession,
    query_text: str,
    top_k: int = 5,
    category: str = None,
    project_id: str = None,
    user_id: uuid.UUID = None,
    user_role: str = None,
    document_type: str = None,
    query_vec: list[float] | None = None,
    use_vector: bool = True,
) -> list[dict]:
    """Vector similarity plus keyword rank, merged. Each result gets a `score`
    (0.65 vector + 0.35 keyword when a query embedding exists, else keyword only);
    `similarity` stays the vector similarity (or the keyword rank when there is none)."""
    fetch = max(top_k * 3, 10)
    vec_hits: list[dict] = []
    if use_vector:
        vec_hits = await search_similar_chunks(
            db, query_text, top_k=fetch, category=category, project_id=project_id,
            user_id=user_id, user_role=user_role, document_type=document_type, query_vec=query_vec,
        )
    lex_hits = await search_lexical(
        db, query_text, top_k=fetch, category=category, project_id=project_id,
        user_id=user_id, user_role=user_role, document_type=document_type,
    )
    merged: dict[str, dict] = {}
    for h in vec_hits:
        merged[h["chunk_id"]] = {**h, "_vec": h["similarity"], "_lex": 0.0}
    for h in lex_hits:
        if h["chunk_id"] in merged:
            merged[h["chunk_id"]]["_lex"] = h["similarity"]
        else:
            merged[h["chunk_id"]] = {**h, "_vec": 0.0, "_lex": h["similarity"]}
    for h in merged.values():
        h["score"] = round(0.65 * h["_vec"] + 0.35 * h["_lex"], 4) if vec_hits else round(h["_lex"], 4)
        h.pop("_vec"); h.pop("_lex")
    return sorted(merged.values(), key=lambda h: h["score"], reverse=True)[:top_k]


async def fetch_clause_chunks(
    db: AsyncSession,
    project_id: str,
    clause_nos: list[str],
    limit: int = 6,
    query_text: str = "",
) -> list[dict]:
    """Exact lookup: contract chunks of `project_id` whose clause_no is one of
    `clause_nos` (clauses the incoming letter names explicitly).

    Clause numbers repeat across a project's documents (Scope of Works 2.8 is not
    the Conditions' 2.8). When several documents match, the chunk that best
    overlaps the letter's wording wins; the other documents are reported in
    `also_in` so the reviewer sees the ambiguity instead of a silent pick.
    """
    if not project_id or not clause_nos:
        return []
    rows = (await db.execute(
        select(DocumentChunk, KnowledgeDocument)
        .join(KnowledgeDocument, DocumentChunk.document_id == KnowledgeDocument.id)
        .where(
            KnowledgeDocument.project_id == project_id,
            KnowledgeDocument.document_type == "contract_volume",
            KnowledgeDocument.status == "indexed",
            DocumentChunk.clause_no.in_(clause_nos),
        )
        .order_by(DocumentChunk.clause_no, DocumentChunk.chunk_index)
    )).all()

    tokens = significant_tokens(query_text)
    by_clause: dict[str, list[tuple[float, DocumentChunk, KnowledgeDocument]]] = {}
    for chunk, doc in rows:
        by_clause.setdefault(chunk.clause_no, []).append((lexical_overlap(tokens, chunk.chunk_text), chunk, doc))

    out: list[dict] = []
    for clause_no in clause_nos:
        candidates = sorted(by_clause.get(clause_no, []), key=lambda t: t[0], reverse=True)
        if not candidates:
            continue
        best_score, chunk, doc = candidates[0]
        other_docs = {d.filename for s, c, d in candidates[1:] if d.id != doc.id}
        out.append({
            "chunk_id": str(chunk.id),
            "document_id": str(chunk.document_id),
            "chunk_text": chunk.chunk_text,
            "chunk_index": chunk.chunk_index,
            "clause_no": chunk.clause_no,
            "page_from": chunk.page_from,
            "page_to": chunk.page_to,
            "document_type": doc.document_type,
            "filename": doc.filename,
            "volume_label": doc.volume_label,
            "ref_no": doc.ref_no,
            "doc_date": doc.doc_date.isoformat() if doc.doc_date else None,
            "similarity": 1.0,
            "score": 1.0,
            "exact": True,
            "also_in": sorted(other_docs),
            "metadata": chunk.metadata_ or {},
        })
    return out[:limit]


async def get_chunk_detail(db: AsyncSession, chunk_id: str) -> dict | None:
    """Full text of one chunk with its document, for the "Full clause text" view."""
    chunk = await db.get(DocumentChunk, str(chunk_id))
    if not chunk:
        return None
    doc = await db.get(KnowledgeDocument, chunk.document_id)
    return {
        "chunk": {
            "id": str(chunk.id),
            "text": chunk.chunk_text,
            "clause_no": chunk.clause_no,
            "page_from": chunk.page_from,
            "page_to": chunk.page_to,
        },
        "document": doc.to_dict() if doc else None,
        "project_id": str(doc.project_id) if doc and doc.project_id else None,
    }


async def get_folder_summary(db: AsyncSession, project_ids: list[str]) -> dict:
    """Per project and folder: document totals, indexed counts, clause totals,
    plus contract chunk coverage ("_chunks", "_chunks_with_clause")."""
    if not project_ids:
        return {}
    ids = [str(p) for p in project_ids]
    out: dict = {
        pid: {
            **{t: {"total": 0, "indexed": 0, "failed": 0, "clauses": 0} for t in DOCUMENT_TYPES},
            "_chunks": 0,
            "_chunks_with_clause": 0,
        }
        for pid in ids
    }

    rows = (await db.execute(
        select(
            KnowledgeDocument.project_id,
            KnowledgeDocument.document_type,
            KnowledgeDocument.status,
            func.count(),
            func.coalesce(func.sum(KnowledgeDocument.clause_count), 0),
        )
        .where(KnowledgeDocument.project_id.in_(ids))
        .group_by(KnowledgeDocument.project_id, KnowledgeDocument.document_type, KnowledgeDocument.status)
    )).all()
    for pid, dtype, status, n, clauses in rows:
        if dtype not in DOCUMENT_TYPES:
            continue
        bucket = out[str(pid)][dtype]
        bucket["total"] += n
        bucket["clauses"] += int(clauses or 0)
        if status == "indexed":
            bucket["indexed"] += n
        elif status == "failed":
            bucket["failed"] += n

    chunk_rows = (await db.execute(
        select(
            KnowledgeDocument.project_id,
            func.count(DocumentChunk.id),
            func.count(DocumentChunk.clause_no),
        )
        .join(DocumentChunk, DocumentChunk.document_id == KnowledgeDocument.id)
        .where(
            KnowledgeDocument.project_id.in_(ids),
            KnowledgeDocument.document_type == "contract_volume",
        )
        .group_by(KnowledgeDocument.project_id)
    )).all()
    for pid, total, with_clause in chunk_rows:
        out[str(pid)]["_chunks"] = total
        out[str(pid)]["_chunks_with_clause"] = with_clause
    return out


async def get_all_documents(
    db: AsyncSession,
    user_id: uuid.UUID = None,
    user_role: str = None,
    skip: int = 0,
    limit: int = 50,
    project_id: str = None,
    document_type: str = None,
) -> tuple[list[dict], int]:
    """List knowledge base documents with pagination and row-level security.

    Scoped to a project, every document in it is listed: project folders are
    shared by the whole project team, not private to the uploader.
    """
    count_stmt = select(func.count()).select_from(KnowledgeDocument)
    base_stmt = select(KnowledgeDocument)

    if project_id:
        count_stmt = count_stmt.where(KnowledgeDocument.project_id == project_id)
        base_stmt = base_stmt.where(KnowledgeDocument.project_id == project_id)
    elif user_role != "admin" and user_id is not None:
        count_stmt = count_stmt.where(KnowledgeDocument.uploaded_by == user_id)
        base_stmt = base_stmt.where(KnowledgeDocument.uploaded_by == user_id)

    if document_type:
        count_stmt = count_stmt.where(KnowledgeDocument.document_type == document_type)
        base_stmt = base_stmt.where(KnowledgeDocument.document_type == document_type)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    stmt = base_stmt.order_by(KnowledgeDocument.uploaded_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    documents = result.scalars().all()
    return [doc.to_dict() for doc in documents], total


async def get_document_stats(
    db: AsyncSession,
    user_id: uuid.UUID = None,
    user_role: str = None,
) -> dict:
    """Get knowledge base statistics with row-level security."""
    doc_count_stmt = select(func.count()).select_from(KnowledgeDocument)
    chunk_count_stmt = select(func.count()).select_from(DocumentChunk)
    indexed_count_stmt = (
        select(func.count())
        .select_from(KnowledgeDocument)
        .where(KnowledgeDocument.status == "indexed")
    )
    category_stmt = (
        select(KnowledgeDocument.category, func.count())
        .group_by(KnowledgeDocument.category)
    )
    type_stmt = (
        select(KnowledgeDocument.document_type, func.count())
        .group_by(KnowledgeDocument.document_type)
    )

    if user_role != "admin" and user_id is not None:
        doc_count_stmt = doc_count_stmt.where(KnowledgeDocument.uploaded_by == user_id)
        chunk_count_stmt = chunk_count_stmt.join(KnowledgeDocument).where(KnowledgeDocument.uploaded_by == user_id)
        indexed_count_stmt = indexed_count_stmt.where(KnowledgeDocument.uploaded_by == user_id)
        category_stmt = category_stmt.where(KnowledgeDocument.uploaded_by == user_id)
        type_stmt = type_stmt.where(KnowledgeDocument.uploaded_by == user_id)

    doc_count = await db.execute(doc_count_stmt)
    chunk_count = await db.execute(chunk_count_stmt)
    indexed_count = await db.execute(indexed_count_stmt)
    category_result = await db.execute(category_stmt)
    type_result = await db.execute(type_stmt)

    return {
        "total_documents": doc_count.scalar() or 0,
        "total_chunks": chunk_count.scalar() or 0,
        "indexed_documents": indexed_count.scalar() or 0,
        "categories": {row[0]: row[1] for row in category_result.all()},
        "document_types": {(row[0] or "unfiled"): row[1] for row in type_result.all()},
    }


async def delete_document(
    db: AsyncSession,
    document_id,
    user_id: uuid.UUID = None,
    user_role: str = None,
) -> bool:
    """Delete a document and all its chunks with row-level security."""
    doc = await db.get(KnowledgeDocument, str(document_id))
    if not doc:
        return False

    if user_role not in ["admin"] and user_id is not None:
        if doc.uploaded_by != user_id:
            return False

    await db.delete(doc)

    audit = AuditEntry(
        entity_type="document",
        entity_id=str(document_id),
        action="deleted",
        user_id=user_id,
        details={"filename": doc.filename},
    )
    db.add(audit)
    await db.flush()
    return True
