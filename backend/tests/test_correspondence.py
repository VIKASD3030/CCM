"""Unit tests for services/correspondence.py: reference, date, subject, KD tag
extraction and reply linking. Pure logic, no database or network.

Run:  python -m backend.tests.test_correspondence   (or pytest, if installed)
The sample text mirrors a scanned incoming letter and the reply that answers it.
"""
from datetime import date

from backend.services.correspondence import (
    answers_for,
    extract_date,
    extract_kd_tags,
    extract_metadata,
    extract_ref,
    norm_ref,
    refs_match,
)

INCOMING = """AFCONS INFRASTRUCTURE LIMITED
KOCHI METRO RAIL PROJECT
Ref.: AFC-KBC3 -KMRL-2024-403 Date: 08 November 2024
To,
The Executive Director (Strategic Planning and Projects)
Kind Attention: Mr. Vinu C Koshy
Subject: Contract KBC-03 -: Design and construction of
elevated viaduct and 10 elevated stations viz.
Palarivattom Junction
SH: KD5 - Commissioning of 2nd Batching Plant - For Complete Viaduct
Reference: 1. LOA no. KMRL/PROCUREMENT/LOA/2024-25/006 Dt. 05.01.2024
Dear Sir, as per Cl 2.8 and Key Date 9 the first batch was on 06.07.2024. See also KD-2.
"""

REPLY = """SYSTRA
Ref, GC/Kochi Metro Phase-II/KMRL/2025/1194 Dated 09.08.2025
The Chief Engineer (Progress)
Subject: Contract KBC-03 - reply
Reference: 1. AFC-KBC3-KMRL-2024-403 dated 08 November 2024
"""


def test_incoming_letter_metadata():
    m = extract_metadata(INCOMING, "scan.pdf")
    assert norm_ref(m["ref_no"]) == "AFCKBC3KMRL2024403"  # OCR spaces around "-" are ignored
    assert m["doc_date"] == date(2024, 11, 8)
    assert m["subject"].startswith("Contract KBC-03") and "elevated viaduct" in m["subject"]
    assert set(m["kd_tags"]) == {"KD-5", "KD-9", "KD-2"}
    assert m["referenced_refs"] == ["KMRL/PROCUREMENT/LOA/2024-25/006"]


def test_reply_metadata_and_quoted_reference():
    r = extract_metadata(REPLY)
    assert norm_ref(r["ref_no"]).endswith("KMRL20251194")
    assert r["doc_date"] == date(2025, 8, 9)
    assert r["referenced_refs"] == ["AFC-KBC3-KMRL-2024-403"]


def test_reply_answers_letter_only_when_it_quotes_the_reference_and_comes_after():
    letter = extract_metadata(INCOMING)
    reply = extract_metadata(REPLY)
    letter_view = {"ref_no": letter["ref_no"], "letter_date": letter["doc_date"]}
    reply_view = {"ref_no": reply["ref_no"], "doc_date": reply["doc_date"], "referenced_refs": reply["referenced_refs"]}
    too_early = {**reply_view, "ref_no": "X/1", "doc_date": date(2024, 1, 1)}
    unrelated = {"ref_no": "Y/2", "doc_date": date(2025, 1, 1), "referenced_refs": ["ZZZ/UNREL/2020/001"]}
    assert answers_for(letter_view, [reply_view, too_early, unrelated]) == [reply_view]


def test_reference_matching_accepts_a_unique_tail_but_not_a_lookalike():
    assert refs_match("KMRL/2025/1194", "GC/Kochi Metro Phase-II/KMRL/2025/1194")
    assert not refs_match("KMRL/2025/717", "KMRL/2025/1717")
    assert not refs_match("2025/1", "KMRL/2025/1")  # too short to be a safe tail


def test_your_ref_is_never_taken_as_our_ref():
    assert extract_ref("Your Ref: ABC/12/2024\nOur Ref: SYS/0099/2025\n") == "SYS/0099/2025"


def test_reference_falls_back_to_the_file_name():
    assert extract_metadata("no refs here", "AFC-KBC3-KMRL-2025-1015.pdf")["ref_no"] == "AFC-KBC3-KMRL-2025-1015"


def test_dates():
    assert extract_date("Date: 8th October 2026") == date(2026, 10, 8)
    assert extract_date("Dt. 12/03/25") == date(2025, 3, 12)  # day first


def test_key_dates_do_not_match_longer_numbers():
    assert extract_kd_tags("KD-12 and KD 2 and Key Date 07") == ["KD-12", "KD-2", "KD-7"]
    assert extract_kd_tags("the KD-2 date") == ["KD-2"]


if __name__ == "__main__":  # runs without pytest: python -m backend.tests.test_correspondence
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print("PASS", t.__name__)
    print(f"{len(tests)} tests passed")
