"""Deterministic demo call fixture for the cold-start experience.

Builds a fully analyzed, ``ready`` CallRecord entirely from local data: no
AssemblyAI key, no LLM gateway, no network. The fixture is explicitly labeled
as a sample (``SAMPLE_CALL_ID`` / ``SAMPLE_FILENAME``) so it is never mistaken
for a real uploaded call, and the scenario is coherent across every layer
(transcript -> analysis -> sensitive debrief -> Deal Reality).
"""

from datetime import datetime, timezone

from server.services.analysis.service import normalize_analysis
from server.services.storage import CallStore
from shared.schemas.analysis import (
    BuyerSignal,
    GroundTruthAnalysis,
    GroundTruthAssessment,
    Objection,
    ParticipantInsight,
    PricingSignal,
    StakeholderInsight,
    TimelineSignal,
)
from shared.schemas.call import CallRecord, CallSource, CallStatus
from shared.schemas.transcript import Speaker, Transcript, Utterance

SAMPLE_CALL_ID = "demo-nova-onboarding"
SAMPLE_FILENAME = "sample-nova-onboarding.mp3"


def build_sample_utterances() -> list[Utterance]:
    """12-turn call: Nova (rep) vs. a procurement lead at the buyer."""
    rows = [
        # (id, speaker, start, end, text)
        (
            "utt_0001",
            Speaker.SPEAKER_A,
            0,
            5200,
            "Priya, thanks for making time. I'm Jordan with Nova — we build "
            "automated security review tooling. The first thing I'd love to "
            "understand: what's the review process on your side before we can "
            "even get started?",
        ),
        (
            "utt_0002",
            Speaker.SPEAKER_B,
            5400,
            10500,
            "The big one is security sign-off from our compliance team. "
            "Anything we bring in has to clear that first, and honestly the "
            "review usually takes a few weeks.",
        ),
        (
            "utt_0003",
            Speaker.SPEAKER_A,
            10700,
            15000,
            "Got it, that's helpful. Beyond compliance then — who typically "
            "needs to sign off on a purchase like this?",
        ),
        (
            "utt_0004",
            Speaker.SPEAKER_B,
            15200,
            20500,
            "Procurement coordinates the overall review, but a purchase this "
            "size needs our CISO and the head of finance to approve. I can't "
            "commit for them.",
        ),
        (
            "utt_0005",
            Speaker.SPEAKER_A,
            20700,
            25500,
            "Understood. And where does this sit on your roadmap right now? "
            "How much of a priority is this for the team?",
        ),
        (
            "utt_0006",
            Speaker.SPEAKER_B,
            25700,
            31500,
            "I'm genuinely interested — this is on our roadmap. But we're "
            "still evaluating vendors, so I need to stay measured about it.",
        ),
        (
            "utt_0007",
            Speaker.SPEAKER_A,
            31700,
            36500,
            "Fair enough. If this did move forward, what would a realistic "
            "budget look like?",
        ),
        (
            "utt_0008",
            Speaker.SPEAKER_B,
            36700,
            43500,
            "We sketched a number around fifty thousand for a tool like this. "
            "Budget isn't the blocker though — proving it works in our "
            "environment is.",
        ),
        (
            "utt_0009",
            Speaker.SPEAKER_A,
            43700,
            48200,
            "That's useful. And if the security review clears, what does the "
            "timeline look like for implementation?",
        ),
        (
            "utt_0010",
            Speaker.SPEAKER_B,
            48400,
            54500,
            "That's the thing I keep coming back to. If the security review "
            "drags out — and it will — the whole timeline slips. We're looking "
            "at a few weeks minimum.",
        ),
        (
            "utt_0011",
            Speaker.SPEAKER_A,
            54700,
            59200,
            "Let me make the next steps easy for you. Anything specific you "
            "need from us in the meantime?",
        ),
        (
            "utt_0012",
            Speaker.SPEAKER_B,
            59400,
            64500,
            "Send over the security documentation and the integration guide. "
            "No firm next meeting yet — give us a few weeks to wrap the review, "
            "then we'll circle back.",
        ),
    ]
    sequence: list[Utterance] = []
    for id, speaker, start, end, text in rows:
        sequence.append(
            Utterance(
                id=id,
                speaker=speaker,
                start_ms=start,
                end_ms=end,
                text=text,
            )
        )
    return sequence


def build_sample_transcript() -> Transcript:
    utterances = build_sample_utterances()
    return Transcript(
        id=f"transcript-{SAMPLE_CALL_ID}",
        duration_seconds=utterances[-1].end_ms / 1000,
        language="en",
        utterances=utterances,
        full_text=" ".join(u.text for u in utterances),
    )


def build_sample_analysis(transcript: Transcript) -> GroundTruthAnalysis:
    """Ground-truth extraction for the sample script.

    The buyer's dominant, repeated concern is security sign-off. A rep who
    remembers "pricing" as the main objection will read as misaligned, which is
    the reveal the demo is designed to produce.
    """
    analysis = GroundTruthAnalysis(
        participants=[
            ParticipantInsight(
                speaker_id=Speaker.SPEAKER_A,
                likely_role="Sales rep",
                confidence=0.78,
                evidence="Introduces Nova and drives the conversation",
                evidence_utterance_ids=["utt_0001"],
            ),
            ParticipantInsight(
                speaker_id=Speaker.SPEAKER_B,
                likely_role="Buyer",
                confidence=0.85,
                evidence="Discusses budget, security review, and purchase approval",
                evidence_utterance_ids=["utt_0002", "utt_0004"],
            ),
        ],
        objections=[
            Objection(
                category="security",
                description=(
                    "Security sign-off is the primary blocker and the dominant concern"
                ),
                evidence_utterance_ids=["utt_0002", "utt_0010"],
                confidence=0.92,
            )
        ],
        buyer_signals=[
            BuyerSignal(
                type="positive_interest",
                description=(
                    "Buyer seemed interested and engaged, with moderate interest "
                    "throughout"
                ),
                evidence_utterance_ids=["utt_0006"],
                sentiment="positive",
                confidence=0.7,
            ),
            BuyerSignal(
                type="hesitation",
                description="Still evaluating vendors and staying measured",
                evidence_utterance_ids=["utt_0006"],
                sentiment="neutral",
                confidence=0.6,
            ),
        ],
        stakeholders=[
            StakeholderInsight(
                stakeholder_type="procurement",
                description=(
                    "Procurement coordinates the review; the final decision maker "
                    "was not confirmed on the call"
                ),
                evidence_utterance_ids=["utt_0004"],
                confidence=0.5,
            )
        ],
        commitments=[],
        next_steps=[],
        pricing_signals=[
            PricingSignal(
                pricing_discussed=True,
                stated_budget="around fifty thousand",
                price_concern=None,
                competitor_price_reference=None,
                evidence_utterance_ids=["utt_0008"],
            )
        ],
        timeline_signals=[
            TimelineSignal(
                description="Security review expected to take a few weeks",
                timeline_type="evaluation_period",
                date_reference="a few weeks",
                evidence_utterance_ids=["utt_0002", "utt_0010"],
                confidence=0.85,
            )
        ],
        competitor_mentions=[],
        initial_ground_truth_assessment=GroundTruthAssessment(
            interest_level="medium",
            risk_level="medium",
            urgency_level="low",
            confidence=0.62,
        ),
    )
    return normalize_analysis(analysis, transcript)


def ensure_sample_call(store: CallStore) -> CallRecord:
    """Return the persisted sample call, seeding it on first use (idempotent)."""
    existing = store.load_call(SAMPLE_CALL_ID)
    if existing is not None:
        # Self-heal records persisted before source labeling existed (or any
        # stale record keyed to the sample id): the sample must never read as
        # a real uploaded call.
        if existing.source != CallSource.sample:
            existing.source = CallSource.sample
            store.save_call(existing)
        return existing

    transcript = build_sample_transcript()
    analysis = build_sample_analysis(transcript)
    call = CallRecord(
        id=SAMPLE_CALL_ID,
        original_filename=SAMPLE_FILENAME,
        created_at=datetime.now(timezone.utc),
        status=CallStatus.ready,
        source=CallSource.sample,
        transcript=transcript,
        analysis=analysis,
    )
    store.save_call(call)
    return call


__all__ = [
    "SAMPLE_CALL_ID",
    "SAMPLE_FILENAME",
    "build_sample_analysis",
    "build_sample_transcript",
    "build_sample_utterances",
    "ensure_sample_call",
]