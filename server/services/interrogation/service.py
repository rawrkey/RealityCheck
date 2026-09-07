"""Voice Interrogation service: sessions, claims, alignment, Deal Reality.

Flow:
1. ``create_session`` makes an ``InterrogationSession`` whose system prompt and
   tools configure the AssemblyAI Voice Agent debrief call.
2. The rep answers; the frontend relays the debrief transcript via
   ``record_debrief``, which stores messages and builds a role-labeled
   ``Transcript``.
3. ``extract_claims`` runs the debrief transcript through the LLM Gateway and
   normalizes the result into ``RepClaim`` objects (stable ids, valid evidence
   references only).
4. ``compute_alignments`` compares each claim to the call's Ground Truth.
5. ``build_deal_reality`` synthesizes the Deal Reality, falling back to a
   deterministic summary when no model key or gateway is mocked.
"""

import json
import logging
import uuid
from datetime import datetime, timezone

from pydantic import ValidationError

from server.config import settings
from server.services.analysis import llm_gateway
from server.services.interrogation.align import align_claims
from server.services.interrogation.prompt import (
    ALL_DIMENSIONS,
    CLAIM_EXTRACTION_SYSTEM_PROMPT,
    DEAL_REALITY_SYSTEM_PROMPT,
    DIMENSION_LABELS,
    GREETING,
    build_claim_extraction_user_prompt,
    build_deal_reality_user_prompt,
    build_interrogation_system_prompt,
)
from server.services.interrogation.schema import (
    ClaimExtraction,
    DEBRIEF_AGENT_SPEAKER,
    DEBRIEF_REP_SPEAKER,
    DealRealityInput,
)
from server.services.json_schema import strict_json_schema
from server.services.storage import StorageError, get_call_store
from shared.schemas.call import CallRecord
from shared.schemas.interrogation import (
    DEAL_REALITY_VERSION,
    AlignmentVerdict,
    BlindSpot,
    ClaimAlignment,
    DealReality,
    InterrogationDimension,
    InterrogationMessage,
    InterrogationRole,
    InterrogationSession,
    InterrogationStatus,
    RepClaim,
)
from shared.schemas.transcript import Transcript, Utterance

logger = logging.getLogger(__name__)

CLAIM_SCHEMA_NAME = "claim_extraction"
DEAL_REALITY_SCHEMA_NAME = "deal_reality"

# Number of top-priority recommendations to keep in the Deal Reality.
MAX_RECOMMENDATIONS = 5
MAX_BLIND_SPOTS = 6


class InterrogationError(Exception):
    """Raised when interrogation logic fails. Message is safe for clients."""


class NoDebriefError(InterrogationError):
    """Raised when acting before a debrief transcript has been recorded."""


# ---- session lifecycle -----------------------------------------------------


def new_session_id() -> str:
    return uuid.uuid4().hex[:12]


def create_session(call: CallRecord) -> InterrogationSession:
    """Create (and persist) a fresh interrogation session for a call."""
    session = InterrogationSession(
        id=new_session_id(),
        call_id=call.id,
        status=InterrogationStatus.created,
        dimensions=[d for d in ALL_DIMENSIONS],
        system_prompt=build_interrogation_system_prompt(),
        messages=[
            InterrogationMessage(role=InterrogationRole.agent, text=GREETING)
        ],
    )
    _persist_session(session)
    return session


def _persist_session(session: InterrogationSession) -> None:
    try:
        get_call_store().save_interrogation(session)
    except StorageError as exc:
        raise InterrogationError(str(exc)) from exc


# ---- debrief recording -----------------------------------------------------


def record_debrief(
    call: CallRecord, session: InterrogationSession, messages: list[dict]
) -> InterrogationSession:
    """Store the debrief transcript and build its role-labeled Transcript."""
    normalized: list[InterrogationMessage] = []
    for message in messages:
        role = message.get("role")
        text = (message.get("text") or "").strip()
        if role not in {"agent", "rep"} or not text:
            continue
        normalized.append(
            InterrogationMessage(
                role=InterrogationRole(role),
                text=text,
            )
        )

    session.messages = normalized
    session.debrief_transcript = _messages_to_transcript(normalized)
    session.status = InterrogationStatus.in_progress
    session.updated_at = datetime.now(timezone.utc)
    _persist_session(session)
    return session


def _messages_to_transcript(messages: list[InterrogationMessage]) -> Transcript:
    utterances: list[Utterance] = []
    start_ms = 0
    for index, message in enumerate(messages, start=1):
        duration = max(1000, len(message.text) * 60)
        utterances.append(
            Utterance(
                id=f"debrief_utt_{index:04d}",
                speaker=(
                    DEBRIEF_REP_SPEAKER
                    if message.role == InterrogationRole.rep
                    else DEBRIEF_AGENT_SPEAKER
                ),
                start_ms=start_ms,
                end_ms=start_ms + duration,
                text=message.text,
            )
        )
        start_ms += duration
    return Transcript(
        id=f"debrief_{uuid.uuid4().hex[:8]}",
        duration_seconds=start_ms / 1000,
        language="en",
        utterances=utterances,
        full_text=" ".join(m.text for m in messages),
    )


def _format_debrief_transcript(transcript: Transcript) -> str:
    lines = []
    for utterance in transcript.utterances:
        role = "rep" if utterance.speaker == DEBRIEF_REP_SPEAKER else "agent"
        lines.append(f"[{utterance.id}] {role}: {utterance.text}")
    return "\n".join(lines)


# ---- claim extraction ------------------------------------------------------


def extract_claims(session: InterrogationSession) -> InterrogationSession:
    """Extract structured rep claims from the recorded debrief via the LLM."""
    transcript = session.debrief_transcript
    if transcript is None or not transcript.utterances:
        raise NoDebriefError(
            "No debrief transcript recorded yet; cannot extract claims."
        )

    if session.claims:
        return session

    try:
        raw = llm_gateway.chat_structured(
            model=settings.assemblyai_llm_model,
            system_prompt=CLAIM_EXTRACTION_SYSTEM_PROMPT,
            user_prompt=build_claim_extraction_user_prompt(
                _format_debrief_transcript(transcript)
            ),
            schema_name=CLAIM_SCHEMA_NAME,
            json_schema=strict_json_schema(ClaimExtraction),
        )
    except llm_gateway.LLMGatewayError as exc:
        logger.warning(
            "Claim extraction LLM unavailable (%s); using deterministic fallback",
            exc,
        )
        session.claims = _normalize_claims(
            _extract_claims_deterministic(transcript), transcript
        )
        session.status = InterrogationStatus.completed
        session.updated_at = datetime.now(timezone.utc)
        _persist_session(session)
        return session

    try:
        parsed = ClaimExtraction.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError, ValueError, TypeError) as exc:
        logger.exception("Claim extraction output did not match schema")
        raise InterrogationError("Debrief analysis produced invalid output.") from exc

    session.claims = _normalize_claims(parsed.claims, transcript)
    session.status = InterrogationStatus.completed
    session.updated_at = datetime.now(timezone.utc)
    _persist_session(session)
    return session


def _extract_claims_deterministic(transcript: Transcript) -> list[RepClaim]:
    """Heuristic claim extraction used when the LLM Gateway is unavailable.

    Pairs each rep utterance with the preceding agent question and maps it to
    a dimension by keyword overlap. First claim per dimension wins, matching the
    de-duplication the LLM path performs in ``_normalize_claims``.
    """
    keywords: dict[InterrogationDimension, tuple[str, ...]] = {
        "primary_objection": (
            "objection",
            "obstacle",
            "concern",
            "problem",
            "hurdle",
            "block",
            "hesit",
            "security",
            "budget",
            "pricing",
            "price",
            "timeline",
            "sign-off",
            "signoff",
            "approval",
            "compliance",
            "delay",
            "waiting",
            "weeks",
        ),
        "buyer_decision_maker": (
            "who",
            "decision maker",
            "decision-maker",
            "champion",
            "stakeholder",
            "owner",
            "signer",
            "finance",
            "department",
            "procurement",
        ),
        "deal_interest_risk": (
            "interest",
            "engaged",
            "engaging",
            "excited",
            "enthusiast",
            "risk",
            "competit",
            "vendor",
            "skeptic",
            "review",
            "hesitant",
            "look",
        ),
        "next_step": (
            "next step",
            "next",
            "send",
            "schedule",
            "meet",
            "follow-up",
            "follow up",
            "agreed",
            "share",
            "email",
            "doc",
            "tomorrow",
        ),
    }

    current_question = ""
    candidates: list[tuple[str, str, str, str]] = []  # dimension q answer_utt id
    for utterance in transcript.utterances:
        if utterance.speaker == DEBRIEF_AGENT_SPEAKER:
            current_question = utterance.text
            continue
        if utterance.speaker != DEBRIEF_REP_SPEAKER:
            continue
        answer = utterance.text.strip()
        if not answer:
            continue
        question_haystack = current_question.lower()
        answer_haystack = answer.lower()
        best_dimension: InterrogationDimension | None = None
        best_score = 0
        for dimension, terms in keywords.items():
            score = 2 * sum(1 for t in terms if t in question_haystack) + sum(
                1 for t in terms if t in answer_haystack
            )
            if score > best_score:
                best_score = score
                best_dimension = dimension
        if best_dimension is not None and best_score > 0:
            candidates.append((best_dimension, current_question, answer, utterance.id))

    claims: list[RepClaim] = []
    seen: set[InterrogationDimension] = set()
    for dimension, question, answer, utterance_id in candidates:
        if dimension in seen:
            continue
        seen.add(dimension)
        claims.append(
            RepClaim(
                id="",
                dimension=dimension,
                question=question,
                claim=answer,
                rep_confidence=0.5,
                evidence_utterance_ids=[utterance_id],
            )
        )
    return claims


def _normalize_claims(
    claims: list[RepClaim], transcript: Transcript
) -> list[RepClaim]:
    """Assign stable ids and drop claims with no valid debrief evidence."""
    valid_ids = {u.id for u in transcript.utterances}
    seen_dimensions: set[InterrogationDimension] = set()
    normalized: list[RepClaim] = []
    for index, claim in enumerate(claims, start=1):
        if claim.dimension in seen_dimensions:
            logger.info("Dropping duplicate dimension claim %s", claim.dimension)
            continue
        claim.evidence_utterance_ids = [
            item_id for item_id in claim.evidence_utterance_ids if item_id in valid_ids
        ]
        if not claim.evidence_utterance_ids:
            logger.info("Dropping claim with no valid debrief evidence")
            continue
        claim.id = f"claim_{index:03d}"
        claim.rep_confidence = max(0.0, min(1.0, float(claim.rep_confidence) or 0.5))
        seen_dimensions.add(claim.dimension)
        normalized.append(claim)
    return normalized


# ---- alignment -------------------------------------------------------------


def compute_alignments(
    call: CallRecord, session: InterrogationSession
) -> list[ClaimAlignment]:
    """Align every claim in the session against the call's ground truth."""
    if not session.claims:
        raise NoDebriefError("No rep claims to align.")
    return align_claims(
        session.claims,
        analysis=call.analysis,
        transcript=call.transcript,
    )


# ---- Deal Reality ----------------------------------------------------------


def build_deal_reality(
    call: CallRecord,
    session: InterrogationSession | None,
    alignments: list[ClaimAlignment],
) -> DealReality:
    """Synthesize the Deal Reality from claims + alignments.

    Uses the LLM Gateway when available; falls back to a deterministic
    synthesis so the MVP works and is testable without a model key.
    """
    total = len(alignments)
    aligned = sum(1 for a in alignments if a.verdict == AlignmentVerdict.aligned)
    alignment_score = aligned / total if total else 0.0

    data = _try_llm_synthesis(call, session, alignments)
    if data is None:
        data = _deterministic_synthesis(call, alignments)

    # Enrich blind spots with call evidence for misaligned claims.
    blind_spots = _attach_blind_spot_evidence(data.blind_spots, alignments)
    recommendations = _to_recommendations(data.recommendations)

    reality = DealReality(
        call_id=call.id,
        prompt_version=DEAL_REALITY_VERSION,
        summary=data.summary,
        risk_level=data.risk_level,
        alignment_score=alignment_score,
        aligned_count=aligned,
        total_count=total,
        blind_spots=blind_spots,
        recommendations=recommendations,
        created_at=datetime.now(timezone.utc),
    )

    try:
        get_call_store().save_reality(reality)
    except StorageError as exc:
        raise InterrogationError(str(exc)) from exc

    return reality


def _try_llm_synthesis(
    call: CallRecord,
    session: InterrogationSession | None,
    alignments: list[ClaimAlignment],
) -> DealRealityInput | None:
    if not settings.assemblyai_api_key:
        return None
    try:
        raw = llm_gateway.chat_structured(
            model=settings.assemblyai_llm_model,
            system_prompt=DEAL_REALITY_SYSTEM_PROMPT,
            user_prompt=build_deal_reality_user_prompt(
                assessment_block=_assessment_block(call),
                alignments_block=_alignments_block(session, alignments),
            ),
            schema_name=DEAL_REALITY_SCHEMA_NAME,
            json_schema=strict_json_schema(DealRealityInput),
        )
    except llm_gateway.LLMGatewayError:
        logger.warning("LLM Deal Reality synthesis failed; using deterministic fallback")
        return None

    try:
        return DealRealityInput.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError, ValueError, TypeError):
        logger.warning("LLM Deal Reality output invalid; using deterministic fallback")
        return None


def _assessment_block(call: CallRecord) -> str:
    analysis = call.analysis
    if analysis is None:
        return "No ground-truth assessment available."
    assessment = analysis.initial_ground_truth_assessment
    return (
        f"interest_level={assessment.interest_level.value}, "
        f"risk_level={assessment.risk_level.value}, "
        f"urgency_level={assessment.urgency_level.value}, "
        f"confidence={assessment.confidence:.2f}\n"
        + "; ".join(
            f"{a.id}: {a.description}"
            for a in analysis.objections[:3]
        )
    )


def _alignments_block(
    session: InterrogationSession | None, alignments: list[ClaimAlignment]
) -> str:
    claims = {c.id: c for c in session.claims} if session else {}
    lines = []
    for alignment in alignments:
        claim = claims.get(alignment.claim_id)
        claim_text = claim.claim if claim else alignment.claim_id
        lines.append(
            f"- Claim ({alignment.dimension.value}): {claim_text}\n"
            f"  Verdict: {alignment.verdict.value}. {alignment.summary}"
        )
    return "\n".join(lines)


def _deterministic_synthesis(
    call: CallRecord, alignments: list[ClaimAlignment]
) -> DealRealityInput:
    """Produce a defensible Deal Reality without calling any model."""
    total = len(alignments)
    aligned = sum(1 for a in alignments if a.verdict == AlignmentVerdict.aligned)
    misaligned = sum(1 for a in alignments if a.verdict == AlignmentVerdict.misaligned)

    if total == 0:
        summary = "No rep claims were captured, so no Deal Reality could be formed."
        risk = "medium"
    elif misaligned > 0:
        summary = (
            f"The rep's read diverges from the call: {aligned}/{total} claims were "
            "supported by evidence, and key claims were not. The deal needs "
            "re-verification before next touchpoints."
        )
        risk = "high"
    elif aligned < total:
        summary = (
            f"Partially aligned: {aligned}/{total} claims matched the transcript. "
            "Some perceptions are unverifiable or under-supported."
        )
        risk = "medium"
    else:
        summary = (
            f"The rep's read is aligned with the call: all {total} claims were "
            "supported by the transcript evidence."
        )
        risk = "low"

    blind_spots: list = []
    recommendations: list = []
    for alignment in alignments:
        if alignment.verdict != AlignmentVerdict.aligned:
            blind_spots.append(
                {
                    "dimension": alignment.dimension,
                    "title": _blind_spot_title(alignment.verdict, alignment.dimension),
                    "description": alignment.summary,
                }
            )
            recommendations.append(_recommendation_for_alignment(alignment))

    return DealRealityInput(
        summary=summary,
        risk_level=risk,
        blind_spots=blind_spots[:MAX_BLIND_SPOTS],
        recommendations=recommendations,
    )


def _blind_spot_title(
    verdict: AlignmentVerdict, dimension: InterrogationDimension
) -> str:
    label = DIMENSION_LABELS.get(dimension, dimension.value.replace("_", " "))
    if verdict == AlignmentVerdict.misaligned:
        return f"Misread of {label}"
    return f"Unsupported belief about {label}"


def _recommendation_for_alignment(alignment: ClaimAlignment) -> dict:
    label = DIMENSION_LABELS.get(alignment.dimension, alignment.dimension.value)
    if alignment.verdict == AlignmentVerdict.misaligned:
        return {
            "priority": "high",
            "action": f"Re-verify {label} with the buyer before your next touchpoint.",
            "rationale": alignment.summary,
        }
    return {
        "priority": "medium",
        "action": f"Get clarity on {label} - the call did not establish it.",
        "rationale": alignment.summary,
    }


def _to_recommendations(recommendations: list) -> list:
    """Convert ``RecommendationInput`` objects into persisted ``RecommendedAction``."""
    from shared.schemas.interrogation import RecommendedAction

    result: list[RecommendedAction] = []
    for index, recommendation in enumerate(recommendations, start=1):
        result.append(
            RecommendedAction(
                id=f"rec_{index:02d}",
                priority=recommendation.priority,
                action=recommendation.action,
                rationale=recommendation.rationale,
            )
        )
    return result[:MAX_RECOMMENDATIONS]


def _attach_blind_spot_evidence(
    blind_spots: list, alignments: list[ClaimAlignment]
) -> list[BlindSpot]:
    """Attach call evidence to blind spots from their originating alignments."""
    evidence_by_dimension: dict[InterrogationDimension, list] = {}
    for alignment in alignments:
        if alignment.transcript_evidence:
            evidence_by_dimension.setdefault(alignment.dimension, [])
            evidence_by_dimension[alignment.dimension].extend(
                alignment.transcript_evidence
            )

    result: list[BlindSpot] = []
    seen = 0
    for index, spot in enumerate(blind_spots, start=1):
        if seen >= MAX_BLIND_SPOTS:
            break
        dimension = spot.dimension
        evidence = evidence_by_dimension.get(dimension, []) if dimension else []
        result.append(
            BlindSpot(
                id=f"spot_{index:02d}",
                dimension=dimension,
                title=spot.title,
                description=spot.description,
                transcript_evidence=evidence,
            )
        )
        seen += 1
    return result


# ---- helpers ---------------------------------------------------------------


__all__ = [
    "InterrogationError",
    "NoDebriefError",
    "build_deal_reality",
    "compute_alignments",
    "create_session",
    "extract_claims",
    "new_session_id",
    "record_debrief",
]