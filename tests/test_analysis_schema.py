"""GroundTruthAnalysis schema validation and normalization."""

import pytest
from pydantic import ValidationError

from server.services.analysis.schema import ground_truth_json_schema
from server.services.analysis.service import normalize_analysis
from shared.schemas.analysis import (
    GROUND_TRUTH_ANALYSIS_VERSION,
    GroundTruthAnalysis,
)
from shared.schemas.transcript import Transcript


def test_valid_analysis_round_trips(sample_analysis: GroundTruthAnalysis) -> None:
    parsed = GroundTruthAnalysis.model_validate(sample_analysis.model_dump())
    assert parsed == sample_analysis


def test_analysis_rejects_unknown_category() -> None:
    data = {
        "objections": [
            {
                "id": "obj_001",
                "category": "budgetary",  # not a valid ObjectionCategory
                "description": "nope",
                "evidence_utterance_ids": ["utt_0001"],
                "confidence": 0.5,
            }
        ]
    }
    with pytest.raises(ValidationError):
        GroundTruthAnalysis.model_validate(data)


def test_analysis_rejects_out_of_range_confidence() -> None:
    data = {
        "objections": [
            {
                "id": "obj_001",
                "category": "pricing",
                "description": "nope",
                "evidence_utterance_ids": ["utt_0001"],
                "confidence": 1.5,
            }
        ]
    }
    with pytest.raises(ValidationError):
        GroundTruthAnalysis.model_validate(data)


def test_normalize_drops_invalid_evidence_and_assigns_stable_ids(
    sample_transcript: Transcript, sample_analysis: GroundTruthAnalysis
) -> None:
    # Sabotage: point the objection at a nonexistent utterance and blank ids.
    sample_analysis.objections[0].evidence_utterance_ids = ["does_not_exist"]
    sample_analysis.objections[0].id = ""

    result = normalize_analysis(sample_analysis, sample_transcript)

    # Objection had no valid evidence -> dropped entirely.
    assert result.objections == []
    # Other items keep valid evidence and get stable ids.
    assert result.commitments[0].id == "commit_001"
    assert result.commitments[0].evidence_utterance_ids == ["utt_0003"]
    # Prompt version is pinned.
    assert result.prompt_version == GROUND_TRUTH_ANALYSIS_VERSION


def test_normalize_removes_only_bad_ids(sample_transcript, sample_analysis) -> None:
    sample_analysis.next_steps[0].evidence_utterance_ids = ["utt_0003", "BAD"]
    result = normalize_analysis(sample_analysis, sample_transcript)
    assert result.next_steps[0].evidence_utterance_ids == ["utt_0003"]


def test_ground_truth_json_schema_is_strict_and_self_contained() -> None:
    schema = ground_truth_json_schema()
    assert schema["type"] == "object"
    assert "$defs" not in schema
    assert schema.get("additionalProperties") is False
    # Every listed property must be required (OpenAI-style strict).
    assert set(schema["required"]) == set(schema["properties"].keys())
    # An objection item schema must be strict too.
    objection_schema = schema["properties"]["objections"]["items"]
    assert objection_schema.get("additionalProperties") is False
    assert "id" in objection_schema["required"]