"""
Correspondence intelligence — deterministic helpers (no LLM) that read a letter's
own reference, date and subject, the references it quotes, the contract key
dates (KD-n) it mentions, and link letters to the replies that answer them.

Letters in this domain quote each other by reference number
("Ref.: AFC-KBC3-KMRL-2024-403", "your letter ref GC/Kochi/KMRL/2025/1194 dated
09.08.2025"). Scanned letters come through OCR, so references can carry stray
spaces around "-" and "/". Matching therefore works on a normalised form and
accepts a unique tail ("KMRL/2025/1194" matches the full reference).
"""
from __future__ import annotations

import re
from datetime import date

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}
_MONTH_NAMES = r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"

_NUMERIC_DATE = r"(\d{1,2})\s*[./\-]\s*(\d{1,2})\s*[./\-]\s*(\d{2,4})"
_TEXT_DATE = rf"(\d{{1,2}})(?:st|nd|rd|th)?[\s.,\-]+({_MONTH_NAMES})\.?[\s.,\-]+(\d{{4}})"

_DATE_LABEL = re.compile(rf"\b(?:date[d]?|dt)\b\s*[:.\-]?\s*(?:{_TEXT_DATE}|{_NUMERIC_DATE})", re.IGNORECASE)
_ANY_TEXT_DATE = re.compile(_TEXT_DATE, re.IGNORECASE)
_ANY_NUMERIC_DATE = re.compile(_NUMERIC_DATE)

# "Ref.: X", "Our Ref No: X", "Ref, X" — captured up to "Date"/"Dated"/"Dt" or end of line.
_REF_LINE = re.compile(
    r"(?im)^[ \t]*(?P<prefix>our\s+|your\s+)?ref(?:erence)?\b\.?[ \t]*(?:no\.?)?[ \t]*[:.,\-]+[ \t]*"
    r"(?P<ref>[A-Z0-9][^\n]*?)(?=[ \t]+(?:date[d]?|dt)\b|[ \t]*$)",
)
# A reference-looking token: letters/digits with at least two "/" or "-" separated parts.
_REF_TOKEN = re.compile(r"\b[A-Za-z][A-Za-z0-9]*(?:\s?[-/]\s?[A-Za-z0-9\[\]]+){2,}\b")
_SUBJECT_START = re.compile(r"(?im)^[ \t]*(?:subject|sub|sh)[ \t]*[:\-][ \t]*(?P<s>.+)$")
_SUBJECT_STOP = re.compile(r"(?i)^\s*(?:ref|reference|dear|respected|kind\s+attention|to\b|encl|sir|madam)\b")

_KD = re.compile(r"\bKD[\s\-]?0?(\d{1,2})\b", re.IGNORECASE)
_KEY_DATE = re.compile(r"\bKey\s+Dates?\s+0?(\d{1,2})\b", re.IGNORECASE)


def norm_ref(ref: str | None) -> str:
    """Upper-case alphanumerics only: 'AFC-KBC3 -KMRL-2024-403' -> 'AFCKBC3KMRL2024403'."""
    return re.sub(r"[^A-Z0-9]", "", (ref or "").upper())


def refs_match(a: str | None, b: str | None, min_tail: int = 10) -> bool:
    """True when two references are the same, or one is the unique tail of the other."""
    na, nb = norm_ref(a), norm_ref(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    short, long_ = (na, nb) if len(na) <= len(nb) else (nb, na)
    return len(short) >= min_tail and long_.endswith(short)


def _clean_ref(ref: str) -> str:
    ref = re.sub(r"\s*([-/])\s*", r"\1", ref.strip())
    return re.sub(r"\s{2,}", " ", ref).strip(" .,;:")


def _to_date(day: str, month: str | int, year: str) -> date | None:
    try:
        m = month if isinstance(month, int) else _MONTHS[month.lower()[:4] if month.lower().startswith("sept") else month.lower()[:3]]
        y = int(year)
        if y < 100:
            y += 2000
        return date(y, m, int(day))
    except (KeyError, ValueError):
        return None


def _parse_date_match(m: re.Match) -> date | None:
    g = m.groups()
    # _DATE_LABEL groups: text-date (3) then numeric-date (3); the standalone patterns have 3.
    if len(g) == 6:
        if g[0] and g[1] and g[2]:
            return _to_date(g[0], g[1], g[2])
        if g[3] and g[4] and g[5]:
            return _to_date(g[3], int(g[4]), g[5])  # day-first (Indian convention)
        return None
    if g[1].isdigit():
        return _to_date(g[0], int(g[1]), g[2])
    return _to_date(g[0], g[1], g[2])


def extract_date(text: str) -> date | None:
    """The letter's own date: the one labelled "Date:" near the top, else the first date."""
    head = text[:3000]
    m = _DATE_LABEL.search(head)
    if m:
        d = _parse_date_match(m)
        if d:
            return d
    for rx in (_ANY_TEXT_DATE, _ANY_NUMERIC_DATE):
        m = rx.search(head)
        if m:
            d = _parse_date_match(m)
            if d:
                return d
    return None


def extract_ref(text: str) -> str | None:
    """The letter's own reference: first "Ref"/"Our Ref" line that isn't "Your Ref"."""
    for m in _REF_LINE.finditer(text[:4000]):
        if (m.group("prefix") or "").strip().lower() == "your":
            continue
        ref = _clean_ref(m.group("ref"))
        if len(norm_ref(ref)) >= 5 and re.search(r"\d", ref):
            return ref[:200]
    return None


def extract_subject(text: str) -> str | None:
    m = _SUBJECT_START.search(text[:6000])
    if not m:
        return None
    parts = [m.group("s").strip()]
    rest = text[m.end():].split("\n")[1:]  # [0] is the remainder of the subject line itself
    for line in rest[:6]:
        if not line.strip() or _SUBJECT_STOP.match(line) or _SUBJECT_START.match(line):
            break
        parts.append(line.strip())
    subject = re.sub(r"\s+", " ", " ".join(parts)).strip()
    return subject[:600] or None


def extract_kd_tags(text: str) -> list[str]:
    nums = [m.group(1) for m in _KD.finditer(text)] + [m.group(1) for m in _KEY_DATE.finditer(text)]
    seen: list[str] = []
    for n in nums:
        tag = f"KD-{int(n)}"
        if tag not in seen:
            seen.append(tag)
    return seen


def extract_quoted_refs(text: str, own_ref: str | None = None) -> list[str]:
    """References quoted in the letter (excluding its own), best first.

    Taken from "Ref"/"Reference" lines and from reference-shaped tokens in the body.
    """
    found: list[str] = []

    def add(ref: str) -> None:
        ref = _clean_ref(ref)
        n = norm_ref(ref)
        # A real reference has at least a few digits (serial / year); that
        # rules out words like "KBC-03-reply".
        if len(n) < 8 or sum(c.isdigit() for c in ref) < 4:
            return
        if own_ref and refs_match(ref, own_ref):
            return
        if not any(refs_match(ref, f) for f in found):
            found.append(ref[:200])

    for m in _REF_LINE.finditer(text[:12000]):
        # Take the reference-shaped tokens out of the line ("1. LOA no. KMRL/…/006"
        # -> "KMRL/…/006"); fall back to the whole line when it has none.
        tokens = _REF_TOKEN.findall(m.group("ref"))
        for t in tokens or [m.group("ref")]:
            add(t)
    for m in _REF_TOKEN.finditer(text[:12000]):
        add(m.group(0))
    return found[:25]


def extract_metadata(text: str, filename: str | None = None) -> dict:
    """ref_no, doc_date, subject, referenced_refs, kd_tags for one letter."""
    text = text or ""
    ref = extract_ref(text)
    if not ref and filename:
        stem = re.sub(r"\.[A-Za-z0-9]{2,4}$", "", filename).strip()
        if re.search(r"\d", stem) and re.search(r"[-/_]", stem) and len(norm_ref(stem)) >= 8:
            ref = stem[:200]
    return {
        "ref_no": ref,
        "doc_date": extract_date(text),
        "subject": extract_subject(text),
        "referenced_refs": extract_quoted_refs(text, ref),
        "kd_tags": extract_kd_tags(text),
    }


# ── Linking ────────────────────────────────────────────────────────────────

def answers_for(letter: dict, replies: list[dict]) -> list[dict]:
    """Replies (outgoing documents) that quote the letter's reference.

    `letter` needs ref_no and letter_date/doc_date; each reply needs
    referenced_refs and doc_date. A reply dated before the letter can't answer it.
    Earliest reply first.
    """
    ref = letter.get("ref_no")
    if not ref:
        return []
    letter_date = letter.get("letter_date") or letter.get("doc_date")
    hits = []
    for r in replies:
        if not any(refs_match(ref, q) for q in (r.get("referenced_refs") or [])):
            continue
        rd = r.get("doc_date")
        if letter_date and rd and rd < letter_date:
            continue
        hits.append(r)
    hits.sort(key=lambda r: (r.get("doc_date") is None, r.get("doc_date") or date.max))
    return hits


def quoted_documents(letter: dict, documents: list[dict]) -> list[dict]:
    """Documents whose own reference the letter quotes (the thread it belongs to)."""
    quoted = letter.get("referenced_refs") or []
    out = []
    for d in documents:
        if d.get("ref_no") and any(refs_match(d["ref_no"], q) for q in quoted):
            out.append(d)
    return out
