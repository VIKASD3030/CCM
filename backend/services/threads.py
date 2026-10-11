"""
Letter threads — which of our replies answers an incoming letter, and which
earlier letters it refers to. Built on the references extracted at intake
(services/correspondence.py); everything is scoped to one project.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.document import KnowledgeDocument
from backend.models.letter import InboundLetter
from backend.services import correspondence


def _doc_brief(d: KnowledgeDocument) -> dict:
    return {
        "id": str(d.id),
        "filename": d.filename,
        "document_type": d.document_type,
        "ref_no": d.ref_no,
        "doc_date": d.doc_date,
        "subject": d.subject,
        "referenced_refs": d.referenced_refs or [],
        "status": d.status,
    }


def _public(d: dict) -> dict:
    return {**d, "doc_date": d["doc_date"].isoformat() if d.get("doc_date") else None}


async def _project_letters_docs(db: AsyncSession, project_ids: list) -> dict[str, list[dict]]:
    """Outgoing and incoming letter documents per project."""
    if not project_ids:
        return {}
    rows = (await db.execute(
        select(KnowledgeDocument).where(
            KnowledgeDocument.project_id.in_(project_ids),
            KnowledgeDocument.document_type.in_(("outgoing_letter", "incoming_letter")),
        )
    )).scalars().all()
    out: dict[str, list[dict]] = {}
    for d in rows:
        out.setdefault(str(d.project_id), []).append(_doc_brief(d))
    return out


def _letter_view(letter: InboundLetter) -> dict:
    return {
        "ref_no": letter.ref_no,
        "letter_date": letter.letter_date,
        "referenced_refs": letter.referenced_refs or [],
    }


async def enrich_letters(db: AsyncSession, letters: list[dict]) -> None:
    """Add `answered_by` (the earliest reply that quotes the letter's reference)
    to each letter dict, in place."""
    ids = list({l["project_id"] for l in letters if l.get("project_id") and l.get("ref_no")})
    docs_by_project = await _project_letters_docs(db, ids)
    for l in letters:
        l["answered_by"] = None
        if not (l.get("project_id") and l.get("ref_no")):
            continue
        replies = [d for d in docs_by_project.get(l["project_id"], []) if d["document_type"] == "outgoing_letter"]
        letter_date = None
        if l.get("letter_date"):
            from datetime import date
            letter_date = date.fromisoformat(l["letter_date"])
        hits = correspondence.answers_for({"ref_no": l["ref_no"], "letter_date": letter_date}, replies)
        if hits:
            l["answered_by"] = _public(hits[0])


async def get_thread(db: AsyncSession, letter: InboundLetter) -> dict:
    """The letter's thread: replies that answer it and earlier documents it quotes."""
    result = {"answered_by": [], "quoted": []}
    if not letter.project_id:
        return result
    docs = (await _project_letters_docs(db, [letter.project_id])).get(str(letter.project_id), [])
    view = _letter_view(letter)
    replies = [d for d in docs if d["document_type"] == "outgoing_letter"]
    result["answered_by"] = [_public(d) for d in correspondence.answers_for(view, replies)]
    quoted = correspondence.quoted_documents(view, docs)
    result["quoted"] = [_public(d) for d in quoted if not correspondence.refs_match(d.get("ref_no"), letter.ref_no)]
    return result
