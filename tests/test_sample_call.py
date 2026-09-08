"""Phase 5B: cold-start demo path, sample fixture, and voice availability."""

import pytest

from server.services.sample_call import (
    SAMPLE_CALL_ID,
    build_sample_analysis,
    build_sample_transcript,
    ensure_sample_call,
)
from shared.schemas.call import CallStatus
from shared.schemas.transcript import Speaker

CALLS = "server.api.routes.calls"
ROUTES = "server.api.routes.interrogation"
SERVICE = "server.services.interrogation.service"

CANONICAL_DEBRIEF = [
    {"role": "agent", "text": "What was the buyer's primary objection to moving forward?"},
    {"role": "rep", "text": "Pricing was the main objection — not security."},
    {"role": "agent", "text": "Who was the decision maker on the buyer's side?"},
    {"role": "rep", "text": "The decision maker wasn't clear, so procurement handles the review."},
    {"role": "agent", "text": "How engaged was the buyer, and what risks did you sense?"},
    {"role": "rep", "text": "They seemed interested and engaged, with moderate interest."},
    {"role": "agent", "text": "What is the agreed next step?"},
    {"role": "rep", "text": "No firm next meeting locked — we'll send the security docs, but they'll circle back later."},
]


@pytest.fixture
def wired_demo(client, tmp_call_store, monkeypatch) -> dict:
    """Seed the sample call and wire the app's stores to the tmp store."""
    monkeypatch.setattr(f"{CALLS}.get_call_store", lambda: tmp_call_store)
    monkeypatch.setattr(f"{ROUTES}.get_call_store", lambda: tmp_call_store)
    monkeypatch.setattr(f"{SERVICE}.get_call_store", lambda: tmp_call_store)
    response = client.post("/api/calls/demo")
    assert response.status_code == 200
    return {"call_id": response.json()["id"]}


# ---- fixture integrity ------------------------------------------------------


def test_sample_fixture_is_ready_and_consistent(tmp_call_store) -> None:
    call = ensure_sample_call(tmp_call_store)
    transcript = call.transcript
    analysis = call.analysis

    assert call.id == SAMPLE_CALL_ID
    assert call.status == CallStatus.ready
    assert call.error_message is None
    assert transcript is not None and len(transcript.utterances) == 12
    assert analysis is not None

    utterance_ids = {u.id for u in transcript.utterances}
    sections = [
        ("participants", "evidence_utterance_ids"),
        ("objections", "evidence_utterance_ids"),
        ("buyer_signals", "evidence_utterance_ids"),
        ("stakeholders", "evidence_utterance_ids"),
        ("commitments", "evidence_utterance_ids"),
        ("next_steps", "evidence_utterance_ids"),
        ("pricing_signals", "evidence_utterance_ids"),
        ("timeline_signals", "evidence_utterance_ids"),
        ("competitor_mentions", "evidence_utterance_ids"),
    ]
    for field_name, _ in sections:
        for item in getattr(analysis, field_name):
            for evidence_id in item.evidence_utterance_ids:
                assert evidence_id in utterance_ids, (
                    f"{field_name} item references missing utterance {evidence_id}"
                )

    assert all(u.speaker in (Speaker.SPEAKER_A, Speaker.SPEAKER_B) for u in transcript.utterances)
    assert transcript.full_text == " ".join(u.text for u in transcript.utterances)
    for first, second in zip(transcript.utterances, transcript.utterances[1:]):
        assert second.start_ms >= first.end_ms


def test_sample_seed_is_idempotent(tmp_call_store) -> None:
    first = ensure_sample_call(tmp_call_store)
    again = ensure_sample_call(tmp_call_store)
    assert again.id == first.id
    assert again == first


def test_sample_analysis_supports_intended_alignment_verdicts(tmp_call_store) -> None:
    from server.services.interrogation.align import align_claims
    from shared.schemas.interrogation import (
        AlignmentVerdict,
        InterrogationDimension,
        RepClaim,
    )

    call = ensure_sample_call(tmp_call_store)
    claims = [
        RepClaim(
            id="claim_001",
            dimension=InterrogationDimension.primary_objection,
            question="q1",
            claim="Pricing was the main objection — not security.",
            evidence_utterance_ids=["utt_0001"],
        ),
        RepClaim(
            id="claim_002",
            dimension=InterrogationDimension.buyer_decision_maker,
            question="q2",
            claim="The decision maker wasn't clear, so procurement handles the review.",
            evidence_utterance_ids=["utt_0002"],
        ),
        RepClaim(
            id="claim_003",
            dimension=InterrogationDimension.deal_interest_risk,
            question="q3",
            claim="They seemed interested and engaged, with moderate interest.",
            evidence_utterance_ids=["utt_0003"],
        ),
        RepClaim(
            id="claim_004",
            dimension=InterrogationDimension.next_step,
            question="q4",
            claim="No firm next meeting locked — the buyer will circle back later.",
            evidence_utterance_ids=["utt_0004"],
        ),
    ]
    alignments = align_claims(claims, analysis=call.analysis, transcript=call.transcript)
    verdicts = {a.verdict for a in alignments}
    assert AlignmentVerdict.misaligned in verdicts
    assert AlignmentVerdict.aligned in verdicts
    assert AlignmentVerdict.unsupported in verdicts
    by_dim = {a.dimension: a.verdict for a in alignments}
    assert by_dim[InterrogationDimension.primary_objection] == AlignmentVerdict.misaligned
    assert by_dim[InterrogationDimension.buyer_decision_maker] == AlignmentVerdict.aligned
    assert by_dim[InterrogationDimension.deal_interest_risk] == AlignmentVerdict.aligned
    assert by_dim[InterrogationDimension.next_step] == AlignmentVerdict.unsupported


# ---- API: seed + idempotency ------------------------------------------------


def test_demo_seed_endpoint_and_idempotency(client, wired_demo) -> None:
    call_id = wired_demo["call_id"]
    assert call_id == SAMPLE_CALL_ID

    first = client.get(f"/api/calls/{call_id}")
    assert first.status_code == 200
    body = first.json()
    assert body["status"] == "ready"
    assert body["original_filename"] == "sample-nova-onboarding.mp3"
    assert body["transcript"] is not None
    assert body["analysis"] is not None

    again = client.post("/api/calls/demo")
    assert again.status_code == 200
    assert again.json()["id"] == call_id

    listing = client.get("/api/calls").json()
    assert sum(1 for c in listing if c["id"] == call_id) == 1


def test_demo_flag_label_explains_it_is_a_sample(client, wired_demo) -> None:
    body = client.get(f"/api/calls/{wired_demo['call_id']}").json()
    assert "sample" in body["original_filename"].lower()


# ---- full demo smoke: debrief -> Deal Reality (deterministic, no LLM) -------


def test_full_demo_flow_produces_the_intended_reveal(client, wired_demo) -> None:
    call_id = wired_demo["call_id"]

    session = client.post(f"/api/calls/{call_id}/interrogation/session")
    assert session.status_code == 201

    debrief = client.post(
        f"/api/calls/{call_id}/interrogation/debrief",
        json={"messages": CANONICAL_DEBRIEF},
    )
    assert debrief.status_code == 200
    payload = debrief.json()
    assert len(payload["session"]["claims"]) == 4

    alignments = {a["dimension"]: a["verdict"] for a in payload["alignments"]}
    assert alignments == {
        "primary_objection": "misaligned",
        "buyer_decision_maker": "aligned",
        "deal_interest_risk": "aligned",
        "next_step": "unsupported",
    }

    reality = client.post(f"/api/calls/{call_id}/interrogation/reality")
    assert reality.status_code == 200
    body = reality.json()
    assert body["aligned_count"] == 2
    assert body["total_count"] == 4
    assert body["alignment_score"] == 0.5
    assert body["risk_level"] == "high"
    assert len(body["blind_spots"]) == 2
    assert len(body["recommendations"]) == 2


# ---- voice availability ------------------------------------------------------


def test_voice_unavailable_without_api_key(client, wired_demo, monkeypatch) -> None:
    monkeypatch.setattr(f"{ROUTES}.settings.assemblyai_api_key", None)
    response = client.get(f"/api/calls/{wired_demo['call_id']}/interrogation/voice")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert "voice" in body["reason"].lower()


def test_voice_available_with_api_key(client, wired_demo, monkeypatch) -> None:
    monkeypatch.setattr(f"{ROUTES}.settings.assemblyai_api_key", "test-key")
    response = client.get(f"/api/calls/{wired_demo['call_id']}/interrogation/voice")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    assert body["reason"] is None


def test_voice_probe_requires_existing_call(client, wired_demo) -> None:
    response = client.get("/api/calls/does-not-exist/interrogation/voice")
    assert response.status_code == 404