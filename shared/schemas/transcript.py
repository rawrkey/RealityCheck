"""Internal transcript models.

These models normalize provider output (AssemblyAI) into a stable internal
representation. No provider-specific objects leak past the AssemblyAI service.
"""

from enum import Enum

from pydantic import BaseModel, Field


class Speaker(str, Enum):
    """Stable, provider-independent speaker labels."""

    SPEAKER_A = "SPEAKER_A"
    SPEAKER_B = "SPEAKER_B"
    SPEAKER_C = "SPEAKER_C"
    SPEAKER_D = "SPEAKER_D"


class Utterance(BaseModel):
    """A single turn of speech with a stable id and timestamp."""

    id: str = Field(..., description="Stable id, e.g. utt_0001")
    speaker: Speaker
    start_ms: int = Field(..., ge=0)
    end_ms: int = Field(..., ge=0)
    text: str


class Transcript(BaseModel):
    """Normalized, speaker-labeled transcript of a sales call."""

    id: str
    duration_seconds: float = Field(default=0.0, ge=0)
    language: str = "unknown"
    utterances: list[Utterance] = Field(default_factory=list)
    full_text: str = ""