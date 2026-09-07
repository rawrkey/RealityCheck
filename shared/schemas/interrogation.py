"""Voice interrogation, claim alignment, and Deal Reality models.

Phase 3 introduces the rep's voice debrief. A Voice Agent asks a small number
of adaptive questions across four dimensions. The rep's answers become
``RepClaim`` objects. Each claim is aligned against the Ground Truth Analysis
(the transcript evidence), producing ``ClaimAlignment`` verdicts, which feed
the final ``DealReality``: perception vs. evidence, blind spots, deal risk and
recommended next actions.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from shared.schemas.evidence import EvidenceItem
from shared.schemas.transcript import Transcript

INTERROGATION_VERSION = "interrogation-v1"
DEAL_REALITY_VERSION = "deal-reality-v1"


class InterrogationDimension(str, Enum):
    """The four dimensions the Voice Agent interrogates the rep on."""

    primary_objection = "primary_objection"
    buyer_decision_maker = "buyer_decision_maker"
    deal_interest_risk = "deal_interest_risk"
    next_step = "next_step"


class InterrogationRole(str, Enum):
    agent = "agent"
    rep = "rep"


class InterrogationStatus(str, Enum):
    created = "created"
    in_progress = "in_progress"
    completed = "completed"


class InterrogationMessage(BaseModel):
    """A single turn in the debrief conversation."""

    role: InterrogationRole
    text: str


class RepClaim(BaseModel):
    """A structured claim extracted from the rep's answer on one dimension."""

    id: str = Field(..., description="Stable id, e.g. claim_001")
    dimension: InterrogationDimension
    question: str = Field(
        ..., description="The question the Voice Agent asked to elicit the claim."
    )
    claim: str = Field(..., description="What the rep said, distilled.")
    rep_confidence: float = Field(
        default=0.5,
        ge=0,
        le=1,
        description="How confident the rep sounded (0..1), if stated.",
    )
    evidence_utterance_ids: list[str] = Field(
        default_factory=list,
        description="Debrief transcript utterances supporting this claim.",
    )


class InterrogationSession(BaseModel):
    """A persisted voice debrief session for one call."""

    id: str
    call_id: str
    status: InterrogationStatus = InterrogationStatus.created
    dimensions: list[InterrogationDimension] = Field(default_factory=list)
    system_prompt: str = ""
    messages: list[InterrogationMessage] = Field(default_factory=list)
    claims: list[RepClaim] = Field(default_factory=list)
    debrief_transcript: Transcript | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AlignmentVerdict(str, Enum):
    aligned = "aligned"
    misaligned = "misaligned"
    unsupported = "unsupported"


class ClaimAlignment(BaseModel):
    """Perception vs. evidence: how a rep's claim lines up with the call."""

    claim_id: str
    dimension: InterrogationDimension
    verdict: AlignmentVerdict
    summary: str = Field(
        ..., description="Plain-language account of why the verdict was reached."
    )
    transcript_evidence: list[EvidenceItem] = Field(default_factory=list)
    matched_analysis_ids: list[str] = Field(
        default_factory=list,
        description="Ground Truth Analysis item ids that support/refute the claim.",
    )


class BlindSpot(BaseModel):
    """Something in the call the rep missed or got wrong."""

    id: str
    dimension: InterrogationDimension | None = None
    title: str
    description: str
    transcript_evidence: list[EvidenceItem] = Field(default_factory=list)


class Priority(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class RecommendedAction(BaseModel):
    """A concrete next action for the rep, prioritized by impact."""

    id: str
    priority: Priority = Priority.medium
    action: str
    rationale: str


class DealRiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class DealReality(BaseModel):
    """The aligned view: what the rep believed vs. what the evidence shows."""

    call_id: str
    prompt_version: str = DEAL_REALITY_VERSION
    summary: str = Field(
        ..., description="One-paragraph synthesis of the deal reality."
    )
    risk_level: DealRiskLevel = DealRiskLevel.medium
    alignment_score: float = Field(
        default=0.0,
        ge=0,
        le=1,
        description="Fraction of claims that aligned with the evidence.",
    )
    aligned_count: int = 0
    total_count: int = 0
    blind_spots: list[BlindSpot] = Field(default_factory=list)
    recommendations: list[RecommendedAction] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class InterrogationConfig(BaseModel):
    """Everything the frontend needs to open the Voice Agent WebSocket."""

    call_id: str
    token: str = Field(
        ..., description="Short-lived, single-use Voice Agent token (not the API key)."
    )
    websocket_url: str
    session: dict = Field(
        ...,
        description="The session.update payload: system_prompt, tools, greeting.",
    )
    expires_in_seconds: int


class DebriefResponse(BaseModel):
    """Consolidated debrief state for the frontend."""

    call_id: str
    session: InterrogationSession
    alignments: list[ClaimAlignment] = Field(default_factory=list)
