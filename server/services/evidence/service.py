"""Evidence retrieval.

Maps analysis claims and free-text queries back to the exact transcript
utterances that support them. Simple, robust text/reference matching for the
MVP - not vector search.
"""

from enum import Enum

from server.services.format import format_ms
from shared.schemas.analysis import GroundTruthAnalysis
from shared.schemas.evidence import EvidenceItem
from shared.schemas.transcript import Transcript, Utterance

_EVIDENCE_FIELDS = (
    ("participants", "participant insight"),
    ("objections", "objection"),
    ("buyer_signals", "buyer signal"),
    ("stakeholders", "stakeholder insight"),
    ("commitments", "commitment"),
    ("next_steps", "next step"),
    ("pricing_signals", "pricing signal"),
    ("timeline_signals", "timeline signal"),
    ("competitor_mentions", "competitor mention"),
)


class EvidenceError(Exception):
    """Raised for invalid evidence retrieval requests. Message is safe for clients."""


def _to_evidence_item(utterance: Utterance, reason: str) -> EvidenceItem:
    return EvidenceItem(
        utterance_id=utterance.id,
        speaker=utterance.speaker,
        start_ms=utterance.start_ms,
        end_ms=utterance.end_ms,
        timestamp=format_ms(utterance.start_ms),
        text=utterance.text,
        matched_reason=reason,
    )


def search_evidence(
    transcript: Transcript,
    *,
    query: str | None = None,
    analysis_item_id: str | None = None,
    utterance_id: str | None = None,
    utterance_ids: str | None = None,
    analysis: GroundTruthAnalysis | None = None,
) -> list[EvidenceItem]:
    """Returns transcript utterances matching the given filter.

    Priority: utterance_id > utterance_ids (comma-separated) >
    analysis_item_id > query. If no filter is given, every utterance is
    returned.
    """
    if utterance_id is not None:
        for utterance in transcript.utterances:
            if utterance.id == utterance_id:
                return [_to_evidence_item(utterance, "exact utterance match")]
        return []

    if utterance_ids:
        wanted = {id.strip() for id in utterance_ids.split(",") if id.strip()}
        matches = [u for u in transcript.utterances if u.id in wanted]
        return [_to_evidence_item(u, "matched utterance id list") for u in matches]

    if analysis_item_id is not None:
        return _evidence_for_analysis_item(transcript, analysis, analysis_item_id)

    if query:
        lowered = query.strip().lower()
        if not lowered:
            return []
        matches = [
            utterance
            for utterance in transcript.utterances
            if lowered in utterance.text.lower()
        ]
        return [
            _to_evidence_item(u, f"matched keyword: \"{query.strip()}\"")
            for u in matches
        ]

    return [
        _to_evidence_item(u, "transcript utterance") for u in transcript.utterances
    ]


def _evidence_for_analysis_item(
    transcript: Transcript, analysis: GroundTruthAnalysis | None, item_id: str
) -> list[EvidenceItem]:
    if analysis is None:
        return []

    item, label = _find_analysis_item(analysis, item_id)
    if item is None:
        return []

    ids = set(item.evidence_utterance_ids)
    utterances = [u for u in transcript.utterances if u.id in ids]
    return [
        _to_evidence_item(
            u,
            f"evidence for {label}: {_item_description(item)}",
        )
        for u in utterances
    ]


def _find_analysis_item(analysis: GroundTruthAnalysis, item_id: str):
    """Locate an analysis object by id and return (item, human label)."""
    for attribute, label in _EVIDENCE_FIELDS:
        items = getattr(analysis, attribute, []) or []
        for item in items:
            if getattr(item, "id", None) == item_id:
                return item, label
    return None, None


def _item_description(item) -> str:
    description = getattr(item, "description", None) or ""
    category = getattr(item, "category", None) or getattr(item, "type", None)
    if category is not None:
        label = category.value if isinstance(category, Enum) else category
        return f"[{label}] {description}".strip()
    return str(description)