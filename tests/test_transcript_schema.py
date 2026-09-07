"""Transcript schema validation."""

import pytest
from pydantic import ValidationError

from shared.schemas.transcript import Speaker, Transcript, Utterance


def test_valid_transcript_round_trips(sample_transcript: Transcript) -> None:
    data = sample_transcript.model_dump()
    assert data["utterances"][0]["id"] == "utt_0001"
    parsed = Transcript.model_validate(data)
    assert parsed == sample_transcript


def test_utterance_requires_speaker() -> None:
    with pytest.raises(ValidationError):
        Utterance(id="utt_0001", start_ms=0, end_ms=100, text="hello")  # no speaker


def test_utterance_rejects_negative_timestamp() -> None:
    with pytest.raises(ValidationError):
        Utterance(
            id="utt_0001",
            speaker=Speaker.SPEAKER_A,
            start_ms=-5,
            end_ms=100,
            text="hello",
        )


def test_transcript_accepts_empty_utterances() -> None:
    transcript = Transcript(id="t_x", full_text="")
    assert transcript.utterances == []


def test_invalid_speaker_value_rejected() -> None:
    with pytest.raises(ValidationError):
        Utterance(
            id="utt_0001",
            speaker="SPEAKER_Z",  # not part of the Speaker enum
            start_ms=0,
            end_ms=100,
            text="hello",
        )