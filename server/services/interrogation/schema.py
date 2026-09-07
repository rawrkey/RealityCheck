"""JSON Schema outputs for Voice Interrogation LLM steps."""

from pydantic import BaseModel, Field

from shared.schemas.interrogation import (
    DealRiskLevel,
    InterrogationDimension,
    Priority,
    RepClaim,
)
from shared.schemas.transcript import Speaker


class ClaimExtraction(BaseModel):
    """LLM output for extracting rep claims from a debrief transcript."""

    claims: list[RepClaim] = Field(default_factory=list)


class BlindSpotInput(BaseModel):
    """A blind spot as produced by the Deal Reality LLM synthesis."""

    dimension: InterrogationDimension | None = None
    title: str
    description: str


class RecommendationInput(BaseModel):
    """A recommended action as produced by the Deal Reality LLM synthesis."""

    priority: Priority = Priority.medium
    action: str
    rationale: str


class DealRealityInput(BaseModel):
    """LLM output for Deal Reality synthesis (enriched server-side)."""

    summary: str
    risk_level: DealRiskLevel = DealRiskLevel.medium
    blind_spots: list[BlindSpotInput] = Field(default_factory=list)
    recommendations: list[RecommendationInput] = Field(default_factory=list)


# Normalized speaker labels used when converting debrief messages to a
# Transcript. SPEAKER_A is the rep (whose claims matter), SPEAKER_B the agent.
DEBRIEF_REP_SPEAKER = Speaker.SPEAKER_A
DEBRIEF_AGENT_SPEAKER = Speaker.SPEAKER_B