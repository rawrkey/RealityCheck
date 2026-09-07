"""Perception vs. evidence: deterministic claim alignment.

Each rep claim is checked against the Ground Truth Analysis for its dimension.
Keyword-overlap scoring picks the best-matching analysis item(s). The verdict:

- ``aligned``: the claim overlaps a real analysis item for that dimension.
- ``misaligned``: the dimension has analysis items the claim should have matched,
  but the claim matches none of them (a perception gap on evidence that exists).
- ``unsupported``: the transcript has no recorded signal for the dimension, so
  the claim can neither be confirmed nor contradicted.

This is intentionally simple and auditable. A later LLM refinement step can
soften summaries, but the verdict mapping stays deterministic so tests never
depend on a model.
"""

import re
from typing import Iterable

from shared.schemas.analysis import GroundTruthAnalysis
from shared.schemas.evidence import EvidenceItem
from shared.schemas.interrogation import (
    AlignmentVerdict,
    ClaimAlignment,
    InterrogationDimension,
    RepClaim,
)
from shared.schemas.transcript import Transcript

_STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "was",
    "were",
    "is",
    "are",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "about",
    "that",
    "this",
    "they",
    "them",
    "their",
    "i",
    "we",
    "you",
    "he",
    "she",
    "it",
    "told",
    "said",
    "says",
    "had",
    "have",
    "has",
    "will",
    "can",
    "would",
    "could",
    "should",
    "really",
    "quite",
    "pretty",
    "just",
    "also",
    "around",
    "like",
}

# Map each dimension to the analysis attributes whose items represent the
# ground truth we align against.
_DIMENSION_ATTRIBUTES: dict[InterrogationDimension, tuple[str, ...]] = {
    InterrogationDimension.primary_objection: ("objections",),
    InterrogationDimension.buyer_decision_maker: ("stakeholders", "participants"),
    InterrogationDimension.deal_interest_risk: (
        "buyer_signals",
        "timeline_signals",
        "competitor_mentions",
    ),
    InterrogationDimension.next_step: ("next_steps", "commitments"),
}


def tokenize(text: str) -> set[str]:
    """Normalize free text into a set of content words."""
    words = re.findall(r"[a-z]+", text.lower())
    return {word for word in words if word not in _STOPWORDS}


def _overlap_score(claim: str, candidate: str) -> float:
    """Dice coefficient between a claim and a candidate item's text."""
    claim_tokens = tokenize(claim)
    candidate_tokens = tokenize(candidate)
    if not claim_tokens or not candidate_tokens:
        return 0.0
    intersection = claim_tokens & candidate_tokens
    return (2.0 * len(intersection)) / (len(claim_tokens) + len(candidate_tokens))


def _candidate_text(item) -> str:
    """Render an analysis item as searchable text describing its content."""
    parts: list[str] = []

    def _append(value) -> None:
        if value is None:
            return
        if hasattr(value, "value"):  # enum -> its serialized string
            value = value.value
        if isinstance(value, str):
            parts.append(value)

    _append(getattr(item, "description", None))
    _append(getattr(item, "category", None))
    _append(getattr(item, "type", None))
    _append(getattr(item, "name", None))
    _append(getattr(item, "commitment", None))
    _append(getattr(item, "date_reference", None))
    _append(getattr(item, "stated_budget", None))
    _append(getattr(item, "likely_role", None))
    if isinstance(item, dict):
        for key in ("description", "name", "type", "category"):
            _append(item.get(key))
    return " ".join(parts)


def _dimension_analysis_items(
    analysis: GroundTruthAnalysis | None, dimension: InterrogationDimension
) -> list[tuple[str, object]]:
    """Return (item_id, item) pairs for the ground truth of a dimension."""
    if analysis is None:
        return []
    items: list[tuple[str, object]] = []
    for attribute in _DIMENSION_ATTRIBUTES.get(dimension, ()):
        for item in getattr(analysis, attribute, []) or []:
            item_id = getattr(item, "id", "") or ""
            if not item_id:
                # Participants (ParticipantInsight) have no id; anchor by speaker.
                speaker = getattr(item, "speaker_id", None)
                if speaker is not None:
                    item_id = f"participant:{speaker.value}"
                else:
                    item_id = f"{attribute}:{len(items)}"
            if item_id:
                items.append((item_id, item))
    return items


def align_claim(
    claim: RepClaim,
    *,
    analysis: GroundTruthAnalysis | None,
    transcript: Transcript | None,
) -> ClaimAlignment:
    """Align one rep claim against the call's ground truth."""
    dimension = claim.dimension
    candidate_items = _dimension_analysis_items(analysis, dimension)

    best_overlap = 0.0
    best_id: str | None = None
    best_item: object | None = None
    for item_id, item in candidate_items:
        score = _overlap_score(claim.claim, _candidate_text(item))
        if score > best_overlap:
            best_overlap = score
            best_id = item_id
            best_item = item

    threshold = 0.2
    if best_overlap >= threshold and best_id is not None:
        verdict = AlignmentVerdict.aligned
        summary = (
            f"The transcript supports this claim: it matches "
            f"{_describe_match(dimension, best_item)} "
            f"({best_id})."
        )
        transcript_evidence = _evidence_for_item(
            best_item, transcript, reason=f"evidence for claim (matched {best_id})"
        )
        matched_ids = [best_id]
    elif candidate_items:
        verdict = AlignmentVerdict.misaligned
        summary = (
            "The call contains evidence about this dimension, but this claim "
            "does not match it. The call instead records: "
            + "; ".join(
                _short_describe(item)
                for _, item in candidate_items[:3]
            )
            + "."
        )
        transcript_evidence = _evidence_for_items(
            candidate_items,
            transcript,
            reason="call evidence the claim did not match",
        )
        matched_ids = []
    else:
        verdict = AlignmentVerdict.unsupported
        summary = (
            "The transcript does not contain a clear signal for this dimension, "
            "so this claim can be neither confirmed nor contradicted."
        )
        transcript_evidence = []
        matched_ids = []

    return ClaimAlignment(
        claim_id=claim.id,
        dimension=dimension,
        verdict=verdict,
        summary=summary,
        transcript_evidence=transcript_evidence,
        matched_analysis_ids=matched_ids,
    )


def align_claims(
    claims: Iterable[RepClaim],
    *,
    analysis: GroundTruthAnalysis | None,
    transcript: Transcript | None,
) -> list[ClaimAlignment]:
    """Align every claim in a session against the call's ground truth."""
    return [align_claim(claim, analysis=analysis, transcript=transcript) for claim in claims]


# ---- helpers ---------------------------------------------------------------


def _describe_match(dimension: InterrogationDimension, item) -> str:
    label = _short_describe(item)
    dim_labels = {
        InterrogationDimension.primary_objection: "the recorded objection",
        InterrogationDimension.buyer_decision_maker: "the recorded stakeholder",
        InterrogationDimension.deal_interest_risk: "the recorded buyer signal",
        InterrogationDimension.next_step: "the recorded next step",
    }
    return f"{dim_labels.get(dimension, 'ground truth item')}: {label}"


def _short_describe(item) -> str:
    if isinstance(item, dict):
        return item.get("description") or item.get("name") or str(item)[:120]
    description = getattr(item, "description", None) or getattr(item, "name", None)
    if not description and hasattr(item, "commitment"):
        description = getattr(item, "commitment", "")
    return str(description)[:160] if description else "<no description>"


def _evidence_for_item(item, transcript: Transcript | None, *, reason: str) -> list[EvidenceItem]:
    """Resolve an analysis item's evidence utterance ids against the call."""
    ids = {
        id for id in (getattr(item, "evidence_utterance_ids", []) or [])
    }
    if transcript is None:
        return []
    return [
        _to_evidence(u, reason)
        for u in transcript.utterances
        if u.id in ids
    ]


def _evidence_for_items(
    items: list[tuple[str, object]], transcript: Transcript | None, *, reason: str
) -> list[EvidenceItem]:
    if transcript is None:
        return []
    wanted = {
        id
        for _, item in items
        for id in (getattr(item, "evidence_utterance_ids", []) or [])
    }
    return [_to_evidence(u, reason) for u in transcript.utterances if u.id in wanted]


def _to_evidence(utterance, reason: str) -> EvidenceItem:
    from server.services.format import format_ms

    return EvidenceItem(
        utterance_id=utterance.id,
        speaker=utterance.speaker,
        start_ms=utterance.start_ms,
        end_ms=utterance.end_ms,
        timestamp=format_ms(utterance.start_ms),
        text=utterance.text,
        matched_reason=reason,
    )