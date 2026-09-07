"""Ground-truth analysis pipeline.

``analyze_transcript`` sends the normalized transcript to the AssemblyAI LLM
Gateway with a strict JSON schema, then validates and normalizes the result:
stable ids are assigned, prompt version is pinned, and every evidence
reference is checked against the real transcript. Items that end up with no
valid evidence are dropped.
"""

import json
import logging

from pydantic import ValidationError

from server.config import settings
from server.services.analysis import llm_gateway
from server.services.analysis.prompt import SYSTEM_PROMPT, build_user_prompt
from server.services.analysis.schema import ground_truth_json_schema
from shared.schemas.analysis import (
    GROUND_TRUTH_ANALYSIS_VERSION,
    BuyerSignal,
    Commitment,
    CompetitorMention,
    GroundTruthAnalysis,
    NextStep,
    Objection,
    ParticipantInsight,
    PricingSignal,
    StakeholderInsight,
    TimelineSignal,
)
from shared.schemas.transcript import Transcript

logger = logging.getLogger(__name__)


class AnalysisError(Exception):
    """Raised when ground-truth analysis fails. Message is safe for clients."""


_SCHEMA_NAME = "ground_truth_analysis"


def analyze_transcript(transcript: Transcript) -> GroundTruthAnalysis:
    """Run ground-truth extraction over a transcript and validate the result."""
    if not transcript.utterances:
        raise AnalysisError("Transcript contains no utterances to analyze.")

    raw_content = llm_gateway.chat_structured(
        model=settings.assemblyai_llm_model,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=build_user_prompt(transcript),
        schema_name=_SCHEMA_NAME,
        json_schema=ground_truth_json_schema(),
    )

    try:
        raw = json.loads(raw_content)
    except json.JSONDecodeError as exc:
        logger.error("Analysis output was not valid JSON")
        raise AnalysisError("Analysis produced invalid structured output.") from exc

    try:
        analysis = GroundTruthAnalysis.model_validate(raw)
    except (ValidationError, ValueError, TypeError) as exc:
        logger.exception("Analysis output did not match schema")
        raise AnalysisError("Analysis produced output outside the expected schema.") from exc

    return normalize_analysis(analysis, transcript)


# ---- normalization ---------------------------------------------------------


def normalize_analysis(
    analysis: GroundTruthAnalysis, transcript: Transcript
) -> GroundTruthAnalysis:
    """Pin the prompt version, assign stable ids, and validate evidence refs."""
    valid_ids = {utterance.id for utterance in transcript.utterances}
    analysis.prompt_version = GROUND_TRUTH_ANALYSIS_VERSION

    evidence_sections = [
        ("objections", "obj"),
        ("buyer_signals", "sig"),
        ("stakeholders", "stake"),
        ("commitments", "commit"),
        ("next_steps", "step"),
        ("pricing_signals", "price"),
        ("timeline_signals", "tl"),
        ("competitor_mentions", "comp"),
    ]

    for field_name, prefix in evidence_sections:
        items = getattr(analysis, field_name) or []
        kept: list = []
        for item in items:
            item.evidence_utterance_ids = _filter_evidence_ids(
                item.evidence_utterance_ids, valid_ids
            )
            if item.evidence_utterance_ids:
                kept.append(item)
        _assign_ids(kept, prefix)
        setattr(analysis, field_name, kept)

    for participant in analysis.participants:
        participant.evidence_utterance_ids = _filter_evidence_ids(
            participant.evidence_utterance_ids, valid_ids
        )

    return analysis


def _filter_evidence_ids(ids: list[str], valid_ids: set[str]) -> list[str]:
    filtered = [item_id for item_id in ids if item_id in valid_ids]
    dropped = len(ids) - len(filtered)
    if dropped:
        logger.warning("Dropped %s invalid evidence reference(s)", dropped)
    return filtered


def _assign_ids(items: list, prefix: str) -> None:
    for index, item in enumerate(items, start=1):
        item.id = f"{prefix}_{index:03d}"


# Re-exported so callers/tests can reference concrete types without drifts.
__all__ = [
    "AnalysisError",
    "analyze_transcript",
    "normalize_analysis",
    "BuyerSignal",
    "Commitment",
    "CompetitorMention",
    "NextStep",
    "Objection",
    "ParticipantInsight",
    "PricingSignal",
    "StakeholderInsight",
    "TimelineSignal",
]