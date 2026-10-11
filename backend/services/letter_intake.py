"""
Phase 2 — Letter Intake & Classification Service.
Handles uploading client letters and classifying them using AI.
"""
import uuid
import json
import structlog

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models.letter import InboundLetter
from backend.models.audit import AuditEntry
from backend.services.knowledge_base import extract_document_from_bytes, CONTENT_TYPES
from backend.services.storage import storage_backend
from backend.services import correspondence
from backend.services.webhook_service import dispatch_event
from backend.services import openai_client

logger = structlog.get_logger()
settings = get_settings()

classification_model = openai_client.get_model()

CLASSIFICATION_PROMPT = """You are an expert legal/contract correspondence analyst. Analyze the following client letter and extract structured information.

CLIENT LETTER:
---
{letter_text}
---

Extract the following information and return ONLY a valid JSON object (no markdown, no code fences):

{{
    "category": "<one of: dispute, renewal_request, amendment, general_inquiry, complaint, payment_issue>",
    "intent": "<1-2 sentence summary of what the client is requesting or communicating>",
    "urgency": "<one of: low, medium, high>",
    "domain_category": "<one of: extension_of_time, payment, variation, key_date, design_drawings, site_access_land, quality, safety, claims_disputes, termination, general_correspondence, other>",
    "posture": "<the sender's stance, one of: dispute, request, notice, response, information, acknowledgement>",
    "scope": "<part of the works concerned, one of: viaduct, stations, depot, systems, both, general, other>",
    "kd_tags": ["<contract key dates the letter is about, written KD-<number>, e.g. KD-2; empty list if none>"],
    "requested_action": "<one sentence: what the sender wants us to do, or null if nothing>",
    "confidence_score": <float between 0.0 and 1.0 indicating your confidence in the classification>,
    "key_entities": {{
        "names": ["<list of people/company names mentioned>"],
        "dates": ["<list of dates mentioned>"],
        "contract_numbers": ["<list of contract/reference numbers mentioned>"],
        "amounts": ["<list of monetary amounts mentioned>"]
    }}
}}

Be precise and accurate. If you're uncertain about the category, choose the closest match and reflect that in the confidence_score."""


PROJECT_PREDICTION_PROMPT = """You are a project router. Based on the following client letter, predict which project this letter likely belongs to.

Available projects:
{projects_list}

CLIENT LETTER:
---
{letter_text}
---

Return ONLY a JSON object:
{{
    "predicted_project_id": "<project_id or null if unsure>",
    "confidence": <float 0.0-1.0>,
    "reason": "<one sentence naming the evidence: contract number, project name, client, location or reference numbering>"
}}"""


ROUTE_AUTO_ASSIGN_CONFIDENCE = 0.85


def route_by_keywords(letter_text: str, projects: list[dict]) -> dict | None:
    """Deterministic project routing: the letter names exactly one project's
    code or name. Returns {project_id, confidence, reason} or None."""
    text_ = " ".join((letter_text or "").lower().split())
    hits: list[tuple[dict, str, str]] = []
    for p in projects or []:
        for kind, value in (("project code", p.get("project_code")), ("project name", p.get("name"))):
            v = " ".join((value or "").lower().split())
            if len(v) >= 4 and v in text_:
                hits.append((p, kind, value))
                break
    if len({h[0]["id"] for h in hits}) != 1:
        return None
    p, kind, value = hits[0]
    return {
        "project_id": p["id"],
        "confidence": 0.9,
        "reason": f"The letter mentions the {kind} \"{value}\".",
    }


async def classify_letter(
    letter_text: str,
    projects: list[dict] = None,
) -> dict:
    """Use AI to classify a client letter and extract metadata.
    Optionally predicts the project based on sender domain, content, and contract references.
    Returns classification dict with optional 'predicted_project' key.
    """
    try:
        response_text = await openai_client.call_openai_async(
            prompt=CLASSIFICATION_PROMPT.format(letter_text=letter_text),
            model=classification_model,
            temperature=0.1,
            max_output_tokens=1000,
            response_format={"type": "json_object"},
        )

        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])

        classification = json.loads(response_text)

        valid_categories = [
            "dispute", "renewal_request", "amendment",
            "general_inquiry", "complaint", "payment_issue",
        ]
        if classification.get("category") not in valid_categories:
            classification["category"] = "general_inquiry"

        valid_urgency = ["low", "medium", "high"]
        if classification.get("urgency") not in valid_urgency:
            classification["urgency"] = "medium"

        valid_posture = ["dispute", "request", "notice", "response", "information", "acknowledgement"]
        if classification.get("posture") not in valid_posture:
            classification["posture"] = None
        valid_scope = ["viaduct", "stations", "depot", "systems", "both", "general", "other"]
        if classification.get("scope") not in valid_scope:
            classification["scope"] = None
        # KD tags: the model's list plus anything the text states explicitly.
        tags = [t for t in (classification.get("kd_tags") or []) if isinstance(t, str)]
        classification["kd_tags"] = list(dict.fromkeys(
            [t.upper().replace(" ", "-") for t in tags] + correspondence.extract_kd_tags(letter_text)
        ))

        # Project prediction
        if projects:
            try:
                projects_list_str = "\n".join(
                    f"- {p['id']}: {p['name']}"
                    + (f" (client: {p['client_name']})" if p.get("client_name") else "")
                    + (f" (code: {p['project_code']})" if p.get("project_code") else "")
                    for p in projects
                )
                pred_text = await openai_client.call_openai_async(
                    prompt=PROJECT_PREDICTION_PROMPT.format(
                        projects_list=projects_list_str,
                        letter_text=letter_text,
                    ),
                    model=classification_model,
                    temperature=0.1,
                    max_output_tokens=200,
                    response_format={"type": "json_object"},
                )
                if pred_text.startswith("```"):
                    lines = pred_text.split("\n")
                    pred_text = "\n".join(lines[1:-1])
                prediction = json.loads(pred_text)
                if prediction.get("predicted_project_id"):
                    classification["predicted_project"] = prediction
            except Exception as pred_err:
                logger.warning("letter.project_prediction_failed", error=str(pred_err))

        return classification

    except json.JSONDecodeError as e:
        logger.error("letter.classification_json_parse_failed", error=str(e))
        return {
            "category": "general_inquiry",
            "intent": "Classification failed — manual review required",
            "urgency": "medium",
            "confidence_score": 0.0,
            "key_entities": {},
        }
    except Exception as e:
        logger.error("letter.classification_failed", error=str(e))
        raise


async def intake_letter(
    db: AsyncSession,
    filename: str,
    content: bytes,
    file_type: str,
    user_id: uuid.UUID,
    project_id: str = None,
) -> InboundLetter:
    """
    Fast intake: extract text -> store as "new". Classification (an LLM call)
    is deliberately NOT done here — it used to block the upload response by
    several seconds. The caller (POST /api/letters/upload) kicks classification
    off as a background job right after this returns; if a draft is requested
    before that finishes, `drafting.generate_draft()` classifies inline (~1-2s)
    instead. See `classify_letter_task` / `reclassify_letter` for that logic.
    """
    # Extract text. Digital files parse locally and fast; scanned pages are read
    # with OCR (a few seconds a page). Page counts and the OCR count are kept.
    extracted = await extract_document_from_bytes(content, file_type, filename)
    raw_text = extracted.text
    meta = correspondence.extract_metadata(raw_text, filename)

    # Keep the original file: the scan itself carries the letterhead, stamps and
    # signature that the extracted text leaves out.
    storage_key = f"letters/{uuid.uuid4()}/{filename}"
    await storage_backend.upload(content, storage_key, CONTENT_TYPES.get(file_type, "application/octet-stream"))

    # Create letter record, unclassified for now.
    letter = InboundLetter(
        filename=filename,
        raw_text=raw_text,
        status="new",
        project_id=project_id,
        created_by=user_id,
        storage_path=storage_key,
        file_type=file_type,
        page_count=extracted.page_count,
        ocr_pages=extracted.ocr_pages,
        ref_no=meta["ref_no"],
        letter_date=meta["doc_date"],
        subject=meta["subject"],
        referenced_refs=meta["referenced_refs"],
        kd_tags=meta["kd_tags"],
    )
    db.add(letter)
    await db.flush()

    # Audit
    audit = AuditEntry(
        entity_type="letter",
        entity_id=str(letter.id),
        action="uploaded",
        user_id=user_id,
        details={"filename": filename, "ref_no": meta["ref_no"], "ocr_pages": extracted.ocr_pages},
    )
    db.add(audit)
    await db.flush()

    logger.info("letter.uploaded", filename=filename, user_id=str(user_id))

    # Dispatch webhook (fire-and-forget)
    await dispatch_event("letter.uploaded", {
        "letter_id": str(letter.id),
        "filename": filename,
        "uploaded_by": str(user_id),
    })

    return letter


async def get_all_letters(
    db: AsyncSession,
    status: str = None,
    category: str = None,
    project_id: str = None,
    user_id: uuid.UUID = None,
    user_role: str = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    """List all letters with pagination, optionally filtered by status or category.
    Can be scoped to project_id. Returns (letters_list, total_count).
    """
    base_stmt = select(InboundLetter)
    count_stmt = select(func.count()).select_from(InboundLetter)

    if project_id:
        base_stmt = base_stmt.where(InboundLetter.project_id == project_id)
        count_stmt = count_stmt.where(InboundLetter.project_id == project_id)

    if user_role != "admin" and user_id is not None:
        base_stmt = base_stmt.where(InboundLetter.created_by == user_id)
        count_stmt = count_stmt.where(InboundLetter.created_by == user_id)

    if status:
        base_stmt = base_stmt.where(InboundLetter.status == status)
        count_stmt = count_stmt.where(InboundLetter.status == status)
    if category:
        base_stmt = base_stmt.where(InboundLetter.category == category)
        count_stmt = count_stmt.where(InboundLetter.category == category)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    stmt = base_stmt.order_by(InboundLetter.received_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    letters = result.scalars().all()

    return [letter.to_dict() for letter in letters], total


async def get_letter_by_id(
    db: AsyncSession,
    letter_id: str,
    user_id: uuid.UUID = None,
    user_role: str = None,
) -> dict | None:
    """Get a single letter by ID with row-level security."""
    letter = await db.get(InboundLetter, str(letter_id))
    if not letter:
        return None

    if user_role != "admin" and user_id is not None:
        if letter.created_by != user_id:
            return None

    return letter.to_dict()


async def reclassify_letter(
    db: AsyncSession,
    letter_id: str,
    category: str = None,
    urgency: str = None,
) -> dict | None:
    """Manually override a letter's classification."""
    letter = await db.get(InboundLetter, str(letter_id))
    if not letter:
        return None

    old_category = letter.category
    old_urgency = letter.urgency

    if category:
        letter.category = category
    if urgency:
        letter.urgency = urgency

    audit = AuditEntry(
        entity_type="letter",
        entity_id=str(letter_id),
        action="reclassified",
        user_id=None,
        details={
            "old_category": old_category,
            "new_category": category or old_category,
            "old_urgency": old_urgency,
            "new_urgency": urgency or old_urgency,
        },
    )
    db.add(audit)
    await db.flush()

    return letter.to_dict()


def apply_classification(letter: InboundLetter, classification: dict) -> None:
    """Copy a classify_letter() result onto the letter record."""
    letter.category = classification.get("category")
    letter.urgency = classification.get("urgency")
    letter.intent = classification.get("intent")
    letter.confidence_score = classification.get("confidence_score")
    letter.key_entities = classification.get("key_entities")
    letter.domain_category = classification.get("domain_category")
    letter.posture = classification.get("posture")
    letter.scope = classification.get("scope")
    letter.requested_action = classification.get("requested_action")
    tags = classification.get("kd_tags") or []
    letter.kd_tags = list(dict.fromkeys([*(letter.kd_tags or []), *tags]))
    if letter.status == "new":
        letter.status = "classified"
