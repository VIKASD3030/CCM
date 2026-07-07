"""
Phase 3 — AI-Assisted Drafting Service.
RAG loop: retrieve relevant context from knowledge base -> generate draft response.
"""

import uuid
import logging

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models.letter import InboundLetter
from backend.models.draft import DraftResponse
from backend.models.audit import AuditEntry
from backend.services.knowledge_base import search_similar_chunks
from backend.services.webhook_service import dispatch_event
from backend.services import gemini as gemini_client

logger = logging.getLogger(__name__)
settings = get_settings()

draft_model = gemini_client.get_model()

DRAFTING_SYSTEM_PROMPT = """You are a professional correspondence manager specializing in contract and business communications. Your job is to draft formal, accurate, and professional responses to client letters.

GUIDELINES:
1. Maintain a professional, courteous tone throughout
2. Reference specific contract terms, dates, and figures when available from the context
3. Address all points raised in the client's letter
4. Be clear about any actions being taken or required
5. Include appropriate opening and closing salutations
6. Keep the response concise but thorough
7. Use proper business letter formatting"""

CATEGORY_INSTRUCTIONS = {
    "dispute": """
SPECIAL INSTRUCTIONS FOR DISPUTE RESPONSES:
- Acknowledge the client's concern empathetically
- Reference the relevant contract clause(s)
- Present facts objectively
- Propose a resolution path or next steps
- Avoid admitting liability without authorization
- Suggest a meeting or call if the matter is complex""",

    "renewal_request": """
SPECIAL INSTRUCTIONS FOR RENEWAL RESPONSES:
- Acknowledge the renewal request positively
- Reference the current contract terms and expiration date
- Outline any proposed changes to terms for the renewal period
- Provide clear next steps for proceeding with the renewal
- Include any relevant pricing or term adjustments""",

    "amendment": """
SPECIAL INSTRUCTIONS FOR AMENDMENT RESPONSES:
- Clearly identify which contract clause(s) the amendment affects
- State the proposed amendment terms precisely
- Outline the process for executing the amendment
- Mention any implications of the amendment on other contract terms
- Include a timeline for the amendment process""",

    "general_inquiry": """
SPECIAL INSTRUCTIONS FOR GENERAL INQUIRY RESPONSES:
- Directly answer the client's questions
- Provide additional helpful context where appropriate
- Offer to provide further clarification if needed
- Keep the tone friendly and helpful""",

    "complaint": """
SPECIAL INSTRUCTIONS FOR COMPLAINT RESPONSES:
- Acknowledge the complaint and express understanding
- Do not assign blame or make excuses
- Outline specific steps being taken to address the issue
- Provide a timeline for resolution if possible
- Offer direct contact information for follow-up""",

    "payment_issue": """
SPECIAL INSTRUCTIONS FOR PAYMENT ISSUE RESPONSES:
- Reference the specific invoice(s) or payment(s) in question
- Provide accurate payment history from records
- Clarify any discrepancies with supporting details
- Offer payment plan options if applicable
- Include payment instructions or contact for accounts department""",
}

DRAFTING_PROMPT = """Based on the following information, draft a professional response letter.

LETTER CATEGORY: {category}
LETTER URGENCY: {urgency}

CLIENT'S LETTER:
---
{letter_text}
---

CLIENT'S INTENT: {intent}

RELEVANT CONTEXT FROM OUR RECORDS:
---
{context}
---

{category_instructions}

{additional_instructions}

Draft a complete, professional response letter. Format it as a proper business letter with date, salutation, body paragraphs, and closing."""


async def generate_draft(
    db: AsyncSession,
    letter_id: str,
    additional_instructions: str = "",
    user_id: uuid.UUID = None,
) -> DraftResponse:
    """
    Generate an AI draft response for a letter using RAG.
    1. Fetch the letter
    2. Search knowledge base for relevant context (scoped to project)
    3. Build prompt with context
    4. Call AI to generate draft
    5. Store and return
    """
    letter = await db.get(InboundLetter, str(letter_id))
    if not letter:
        raise ValueError(f"Letter {letter_id} not found")

    relevant_chunks = await search_similar_chunks(
        db, letter.raw_text, top_k=5, project_id=str(letter.project_id) if letter.project_id else None
    )

    context_parts = []
    context_doc_ids = []
    for i, chunk in enumerate(relevant_chunks, 1):
        source = chunk.get("metadata", {}).get("filename", "Unknown")
        context_parts.append(
            f"[Document {i}: {source} | Relevance: {chunk['similarity']}]\n{chunk['chunk_text']}"
        )
        context_doc_ids.append({
            "document_id": chunk["document_id"],
            "chunk_id": chunk["chunk_id"],
            "similarity": chunk["similarity"],
            "source": source,
        })

    context_text = "\n\n".join(context_parts) if context_parts else "No relevant context found in the knowledge base."

    category_instructions = CATEGORY_INSTRUCTIONS.get(
        letter.category or "general_inquiry",
        CATEGORY_INSTRUCTIONS["general_inquiry"],
    )

    prompt = DRAFTING_PROMPT.format(
        category=letter.category or "general_inquiry",
        urgency=letter.urgency or "medium",
        letter_text=letter.raw_text,
        intent=letter.intent or "Not classified",
        context=context_text,
        category_instructions=category_instructions,
        additional_instructions=f"\nADDITIONAL INSTRUCTIONS:\n{additional_instructions}" if additional_instructions else "",
    )

    try:
        draft_text = await gemini_client.call_gemini_async(
            prompt=f"{DRAFTING_SYSTEM_PROMPT}\n\n{prompt}",
            model=draft_model,
            temperature=0.7,
            max_output_tokens=3000,
        )
    except Exception as e:
        logger.error(f"Draft generation failed: {e}")
        raise

    version_count = await db.execute(
        select(func.count())
        .select_from(DraftResponse)
        .where(DraftResponse.letter_id == str(letter_id))
    )
    version = (version_count.scalar() or 0) + 1

    draft_id = uuid.uuid4()
    draft = DraftResponse(
        id=draft_id,
        letter_id=str(letter_id),
        draft_text=draft_text,
        version=version,
        status="pending_review",
        context_documents=context_doc_ids,
        feedback=additional_instructions if additional_instructions else None,
        edited_by=user_id,
    )
    db.add(draft)

    letter.status = "drafted"

    audit = AuditEntry(
        entity_type="draft",
        entity_id=str(draft_id),
        action="draft_generated",
        user_id=user_id,
        details={
            "letter_id": str(letter_id),
            "version": version,
            "context_chunks_used": len(relevant_chunks),
            "model": settings.generation_model,
        },
    )
    db.add(audit)
    await db.flush()

    logger.info(f"Generated draft v{version} for letter {letter_id} by user {user_id}")

    # Dispatch webhook (fire-and-forget)
    await dispatch_event("draft.generated", {
        "draft_id": str(draft.id),
        "letter_id": str(letter_id),
        "version": version,
        "generated_by": str(user_id) if user_id else None,
    })

    return draft


async def regenerate_draft(
    db: AsyncSession,
    draft_id: str,
    feedback: str,
    user_id: uuid.UUID = None,
) -> DraftResponse:
    """Re-generate a draft with additional feedback/instructions."""
    old_draft = await db.get(DraftResponse, str(draft_id))
    if not old_draft:
        raise ValueError(f"Draft {draft_id} not found")

    old_draft.status = "revised"
    old_draft.feedback = feedback

    new_draft = await generate_draft(
        db, old_draft.letter_id, additional_instructions=feedback, user_id=user_id
    )

    return new_draft


async def update_draft_text(
    db: AsyncSession,
    draft_id: str,
    new_text: str,
    user_id: uuid.UUID = None,
) -> dict | None:
    """Manually edit the draft text."""
    draft = await db.get(DraftResponse, str(draft_id))
    if not draft:
        return None

    draft.draft_text = new_text
    draft.edited_by = user_id

    audit = AuditEntry(
        entity_type="draft",
        entity_id=str(draft_id),
        action="manually_edited",
        user_id=user_id,
        details={"letter_id": str(draft.letter_id)},
    )
    db.add(audit)
    await db.flush()

    return draft.to_dict()


async def get_drafts_for_letter(
    db: AsyncSession,
    letter_id: str,
    user_id: uuid.UUID = None,
    user_role: str = None,
) -> list[dict]:
    """Get all draft versions for a letter with row-level security."""
    letter = await db.get(InboundLetter, str(letter_id))
    if not letter:
        return []

    if user_role not in ["admin", "reviewer"] and user_id is not None:
        if letter.created_by != user_id:
            return []

    stmt = (
        select(DraftResponse)
        .where(DraftResponse.letter_id == str(letter_id))
        .order_by(DraftResponse.version.desc())
    )
    result = await db.execute(stmt)
    drafts = result.scalars().all()
    return [d.to_dict() for d in drafts]


async def get_draft_by_id(
    db: AsyncSession,
    draft_id: str,
    user_id: uuid.UUID = None,
    user_role: str = None,
) -> dict | None:
    """Get a single draft by ID with row-level security."""
    draft = await db.get(DraftResponse, str(draft_id))
    if not draft:
        return None

    letter = await db.get(InboundLetter, str(draft.letter_id))
    if not letter:
        return None

    if user_role not in ["admin", "reviewer"] and user_id is not None:
        if letter.created_by != user_id:
            return None

    return draft.to_dict()
