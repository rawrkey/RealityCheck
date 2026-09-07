"""Voice interrogation service tests (sessions, claims, alignment, reality)."""

import json
import pytest

from server.services.interrogation import (
    build_deal_reality,
    compute_alignments,
    create_session,
    extract_claims,
    record_debrief,
)
from server.services.interrogation.schema import ClaimExtraction
from server.services.json_schema import strict_json_schema
from shared.schemas.interrogation import (
    AlignmentVerdict,
    InterrogationDimension,
    InterrogationStatus,
)
from shared.schemas.transcript import Speaker

SERVICE = "server.services.interrogation.service"
GATEWAY = "server.services.analysis.llm_gateway.chat_structured"


@pytest.fixture
def interrogation_store(monkeypatch, tmp_call_store) -> None:
    monkeypatch.setattr(f"{SERVICE}.get_call_store", lambda: tmp_call_store)
    return tmp_call_store


def _claim_extraction_json() -> str:
    claims = [
        {
            "id": "",
            "dimension": "primary_objection",
            "question": "What was the buyer's main objection?",
            "claim": "The main objection was security sign-off taking a few weeks.",
            "rep_confidence": 0.8,
            "evidence_utterance_ids": ["debrief_utt_0002"],
        },
        {
            "id": "",
            "dimension": "buyer_decision_maker",
            "question": "Who was the decision maker?",
            "claim": "The buyer was Sarah in procurement and is the decision maker.",
            "rep_confidence": 0.6,
            "evidence_utterance_ids": ["debrief_utt_0004"],
        },
        {
            "id": "",
            "dimension": "deal_interest_risk",
            "question": "How did the deal look?",
            "claim": "The buyer seemed interested and engaged with the follow-up.",
            "rep_confidence": 0.7,
            "evidence_utterance_ids": ["debrief_utt_0006"],
        },
        {
            "id": "",
            "dimension": "next_step",
            "question": "What's the next step?",
            "claim": "We agreed to send the security documentation tomorrow.",
            "rep_confidence": 0.9,
            "evidence_utterance_ids": ["debrief_utt_0008"],
        },
    ]
    return json.dumps({"claims": claims})


@pytest.fixture
def debrief_messages() -> list[dict]:
    return [
        {"role": "agent", "text": "What was the buyer's main objection?"},
        {"role": "rep", "text": "The main objection was security sign-off taking a few weeks."},
        {"role": "agent", "text": "Who was the decision maker?"},
        {"role": "rep", "text": "Sarah in procurement, but I believe the buyer is the decision maker."},
        {"role": "agent", "text": "How did the deal look?"},
        {"role": "rep", "text": "They were pretty interested and engaged with the follow-up."},
        {"role": "agent", "text": "What's the next step?"},
        {"role": "rep", "text": "We agreed to send the security documentation tomorrow."},
    ]


def test_create_session_persists_four_dimensions(
    stored_call, interrogation_store
) -> None:
    session = create_session(stored_call)
    assert session.call_id == stored_call.id
    assert len(session.dimensions) == 4
    assert session.status == InterrogationStatus.created
    assert session.system_prompt
    persisted = interrogation_store.load_interrogation(stored_call.id)
    assert persisted is not None
    assert persisted.id == session.id


def test_record_debrief_builds_transcript_and_keeps_order(
    stored_call, interrogation_store, debrief_messages
) -> None:
    session = create_session(stored_call)
    session = record_debrief(stored_call, session, debrief_messages)
    assert session.status == InterrogationStatus.in_progress
    assert session.debrief_transcript is not None
    utt = session.debrief_transcript.utterances
    assert utt[0].id == "debrief_utt_0001"
    assert utt[0].speaker == Speaker.SPEAKER_B  # agent
    assert utt[1].speaker == Speaker.SPEAKER_A  # rep
    assert len(utt) == 8


def test_extract_claims_normalizes_and_filters(
    stored_call, interrogation_store, debrief_messages, monkeypatch
) -> None:
    calls = {"count": 0}

    def fake_chat(**kwargs):
        calls["count"] += 1
        assert kwargs["schema_name"] == "claim_extraction"
        assert "$defs" not in kwargs["json_schema"]
        # sabotage: one claim references a bogus utterance id
        return json.dumps(
            {
                "claims": [
                    {
                        "id": "",
                        "dimension": "primary_objection",
                        "question": "What was the buyer's main objection?",
                        "claim": "The main objection was security sign-off taking a few weeks.",
                        "rep_confidence": 0.5,
                        "evidence_utterance_ids": ["debrief_utt_0002", "nope"],
                    }
                ]
            }
        )

    monkeypatch.setattr(GATEWAY, fake_chat)

    session = create_session(stored_call)
    session = record_debrief(stored_call, session, debrief_messages)
    session = extract_claims(session)
    assert calls["count"] == 1
    claim = session.claims[0]
    assert claim.id == "claim_001"
    assert claim.evidence_utterance_ids == ["debrief_utt_0002"]
    assert session.status == InterrogationStatus.completed


def test_extract_claims_dedupes_dimensions(
    stored_call, interrogation_store, debrief_messages, monkeypatch
) -> None:
    def fake_chat(**kwargs):
        payload = json.loads(_claim_extraction_json())
        # duplicate next_step dimension
        payload["claims"].append(
            {
                "id": "",
                "dimension": "next_step",
                "question": "again?",
                "claim": "we agreed already",
                "rep_confidence": 0.5,
                "evidence_utterance_ids": ["debrief_utt_0008"],
            }
        )
        return json.dumps(payload)

    monkeypatch.setattr(GATEWAY, fake_chat)
    session = create_session(stored_call)
    session = record_debrief(stored_call, session, debrief_messages)
    session = extract_claims(session)
    dims = [c.dimension for c in session.claims]
    assert len(dims) == len(set(dims)) == 4


def test_extract_claims_requires_debrief(stored_call, interrogation_store) -> None:
    session = create_session(stored_call)
    with pytest.raises(Exception):
        extract_claims(session)


def test_extract_claims_deterministic_fallback_without_llm(
    stored_call, interrogation_store, debrief_messages, monkeypatch
) -> None:
    import server.services.analysis.llm_gateway as gateway

    def unavailable(**kwargs):
        raise gateway.LLMGatewayError("ASSEMBLYAI_API_KEY is not configured")

    monkeypatch.setattr(GATEWAY, unavailable)

    session = create_session(stored_call)
    session = record_debrief(stored_call, session, debrief_messages)
    session = extract_claims(session)

    assert session.status == InterrogationStatus.completed
    dims = {c.dimension for c in session.claims}
    assert dims == {
        InterrogationDimension.primary_objection,
        InterrogationDimension.buyer_decision_maker,
        InterrogationDimension.deal_interest_risk,
        InterrogationDimension.next_step,
    }
    assert all(c.rep_confidence == 0.5 for c in session.claims)
    assert all(c.id for c in session.claims)


def test_alignments_mark_matching_claims_as_aligned(
    stored_call, interrogation_store, debrief_messages, monkeypatch
) -> None:
    monkeypatch.setattr(GATEWAY, lambda **kwargs: _claim_extraction_json())
    session = create_session(stored_call)
    session = record_debrief(stored_call, session, debrief_messages)
    session = extract_claims(session)

    alignments = compute_alignments(stored_call, session)
    assert len(alignments) == 4
    assert all(a.verdict == AlignmentVerdict.aligned for a in alignments)
    assert all(a.matched_analysis_ids for a in alignments)
    objection = next(a for a in alignments if a.dimension == InterrogationDimension.primary_objection)
    assert objection.matched_analysis_ids == ["obj_001"]
    assert objection.transcript_evidence[0].utterance_id == "utt_0002"


def test_alignments_detect_misalignment(
    stored_call, interrogation_store, monkeypatch
) -> None:
    # Claim on next_step ignores the agreed step that exists in the analysis.
    monkeypatch.setattr(
        GATEWAY,
        lambda **kwargs: json.dumps(
            {
                "claims": [
                    {
                        "id": "",
                        "dimension": "next_step",
                        "question": "What's next?",
                        "claim": "We did not agree on anything yet, we will catch up later.",
                        "rep_confidence": 0.5,
                        "evidence_utterance_ids": ["debrief_utt_0002"],
                    }
                ]
            }
        ),
    )
    session = create_session(stored_call)
    session = record_debrief(
        stored_call,
        session,
        [
            {"role": "agent", "text": "What's next?"},
            {"role": "rep", "text": "We did not agree on anything yet, we will catch up later."},
        ],
    )
    session = extract_claims(session)
    alignments = compute_alignments(stored_call, session)
    assert len(alignments) == 1
    assert alignments[0].verdict == AlignmentVerdict.misaligned
    assert alignments[0].matched_analysis_ids == []


def test_alignments_mark_unsupported_when_no_evidence(
    stored_call, interrogation_store, monkeypatch
) -> None:
    # Sabotage: wipe the analysis next_steps so nothing anchors the claim.
    stored_call.analysis.next_steps = []
    stored_call.analysis.commitments = []
    monkeypatch.setattr(
        GATEWAY,
        lambda **kwargs: json.dumps(
            {
                "claims": [
                    {
                        "id": "",
                        "dimension": "next_step",
                        "question": "What's next?",
                        "claim": "We agreed to send the security documentation tomorrow.",
                        "rep_confidence": 0.9,
                        "evidence_utterance_ids": ["debrief_utt_0002"],
                    }
                ]
            }
        ),
    )
    session = create_session(stored_call)
    session = record_debrief(
        stored_call,
        session,
        [
            {"role": "agent", "text": "What's next?"},
            {"role": "rep", "text": "We agreed to send the security documentation tomorrow."},
        ],
    )
    session = extract_claims(session)
    alignments = compute_alignments(stored_call, session)
    assert alignments[0].verdict == AlignmentVerdict.unsupported


def test_build_deal_reality_all_aligned_is_low_risk(
    stored_call, interrogation_store, debrief_messages, monkeypatch
) -> None:
    monkeypatch.setattr(GATEWAY, lambda **kwargs: _claim_extraction_json())
    session = create_session(stored_call)
    session = record_debrief(stored_call, session, debrief_messages)
    session = extract_claims(session)
    alignments = compute_alignments(stored_call, session)

    reality = build_deal_reality(stored_call, session, alignments)
    assert reality.aligned_count == 4
    assert reality.total_count == 4
    assert reality.alignment_score == 1.0
    assert reality.risk_level == "low"
    assert reality.blind_spots == []
    persisted = interrogation_store.load_reality(stored_call.id)
    assert persisted is not None
    assert persisted.summary == reality.summary


def test_build_deal_reality_with_gaps_is_high_risk(
    stored_call, interrogation_store, monkeypatch
) -> None:
    monkeypatch.setattr(
        GATEWAY,
        lambda **kwargs: json.dumps(
            {
                "claims": [
                    {
                        "id": "",
                        "dimension": "next_step",
                        "question": "What's next?",
                        "claim": "We did not agree on anything, we will catch up later.",
                        "rep_confidence": 0.7,
                        "evidence_utterance_ids": ["debrief_utt_0002"],
                    },
                    {
                        "id": "",
                        "dimension": "primary_objection",
                        "question": "Main objection?",
                        "claim": "The buyer's only concern was the sticker price and nothing else.",
                        "rep_confidence": 0.9,
                        "evidence_utterance_ids": ["debrief_utt_0004"],
                    },
                ]
            }
        ),
    )
    session = create_session(stored_call)
    session = record_debrief(
        stored_call,
        session,
        [
            {"role": "agent", "text": "What's next?"},
            {"role": "rep", "text": "We did not agree on anything, we will catch up later."},
            {"role": "agent", "text": "Main objection?"},
            {"role": "rep", "text": "The buyer's only concern was the sticker price."},
        ],
    )
    session = extract_claims(session)
    alignments = compute_alignments(stored_call, session)

    reality = build_deal_reality(stored_call, session, alignments)
    assert reality.alignment_score < 1.0
    assert reality.risk_level == "high"
    assert len(reality.blind_spots) >= 1
    assert any(spot.transcript_evidence for spot in reality.blind_spots)
    assert reality.recommendations
    # deterministic fallback produces recommended actions for non-aligned claims
    assert any(rec.priority == "high" for rec in reality.recommendations)


def test_build_deal_reality_empty_claims_is_medium_risk(
    stored_call, interrogation_store
) -> None:
    reality = build_deal_reality(stored_call, None, [])
    assert reality.risk_level == "medium"
    assert reality.alignment_score == 0.0


def test_claim_extraction_schema_is_strict() -> None:
    schema = strict_json_schema(ClaimExtraction)
    assert schema["type"] == "object"
    assert "$defs" not in schema
    assert schema.get("additionalProperties") is False
    items = schema["properties"]["claims"]["items"]
    assert items.get("additionalProperties") is False
    assert "evidence_utterance_ids" in items["required"]