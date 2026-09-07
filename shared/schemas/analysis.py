"""Ground-truth analysis models.

The ground-truth analysis is the factual foundation of RealityCheck. It only
contains what can be supported by the transcript. Nothing here represents the
salesperson's later claims or the final Deal Reality verdict.
"""

from enum import Enum

from pydantic import BaseModel, Field

from shared.schemas.transcript import Speaker

GROUND_TRUTH_ANALYSIS_VERSION = "ground-truth-v1"


class ConfidenceLevel(str, Enum):
    """Generic confidence/level vocabulary used across analysis."""

    low = "low"
    medium = "medium"
    high = "high"
    unknown = "unknown"


class Sentiment(str, Enum):
    positive = "positive"
    negative = "negative"
    neutral = "neutral"


class ObjectionCategory(str, Enum):
    pricing = "pricing"
    security = "security"
    implementation = "implementation"
    integration = "integration"
    timing = "timing"
    competition = "competition"
    product_fit = "product_fit"
    procurement = "procurement"
    other = "other"


class BuyerSignalType(str, Enum):
    positive_interest = "positive_interest"
    concern = "concern"
    urgency = "urgency"
    hesitation = "hesitation"
    commitment = "commitment"
    comparison = "comparison"
    request_for_next_step = "request_for_next_step"


class StakeholderType(str, Enum):
    decision_maker = "decision_maker"
    economic_buyer = "economic_buyer"
    technical_stakeholder = "technical_stakeholder"
    procurement = "procurement"
    champion = "champion"
    end_user = "end_user"
    other = "other"


class NextStepType(str, Enum):
    AGREED_NEXT_STEP = "AGREED_NEXT_STEP"
    SUGGESTED_NEXT_STEP = "SUGGESTED_NEXT_STEP"


class TimelineType(str, Enum):
    purchase_target = "purchase_target"
    implementation_date = "implementation_date"
    evaluation_period = "evaluation_period"
    decision_date = "decision_date"
    other = "other"


class ParticipantInsight(BaseModel):
    """Best-effort role inference for a speaker. Never treated as certain."""

    speaker_id: Speaker
    likely_role: str | None = None
    confidence: float = Field(default=0.0, ge=0, le=1)
    evidence: str | None = Field(
        default=None,
        description="Plain-language reasoning for the role inference.",
    )
    evidence_utterance_ids: list[str] = Field(default_factory=list)


class Objection(BaseModel):
    """An objection raised by the buyer, anchored to transcript evidence."""

    id: str = ""
    category: ObjectionCategory
    description: str
    evidence_utterance_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0, le=1)


class BuyerSignal(BaseModel):
    """A meaningful positive/negative buying signal."""

    id: str = ""
    type: BuyerSignalType
    description: str
    evidence_utterance_ids: list[str] = Field(default_factory=list)
    sentiment: Sentiment = Sentiment.neutral
    confidence: float = Field(default=0.5, ge=0, le=1)


class StakeholderInsight(BaseModel):
    """A reference to a stakeholder, with explicit uncertainty."""

    id: str = ""
    stakeholder_type: StakeholderType
    description: str | None = None
    evidence_utterance_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0, le=1)


class Commitment(BaseModel):
    """An explicit commitment made by either side."""

    id: str = ""
    speaker_id: Speaker
    commitment: str
    deadline: str | None = Field(
        default=None,
        description="Deadline only if explicitly stated; never inferred.",
    )
    evidence_utterance_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0, le=1)


class NextStep(BaseModel):
    """An explicitly agreed (or merely suggested) next step."""

    id: str = ""
    description: str
    step_type: NextStepType = NextStepType.AGREED_NEXT_STEP
    owner: Speaker | None = None
    deadline: str | None = None
    evidence_utterance_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0, le=1)


class PricingSignal(BaseModel):
    """Actual pricing / budget information present in the call."""

    id: str = ""
    pricing_discussed: bool = False
    stated_budget: str | None = None
    price_concern: str | None = None
    competitor_price_reference: str | None = None
    evidence_utterance_ids: list[str] = Field(default_factory=list)


class TimelineSignal(BaseModel):
    """Explicit timing information."""

    id: str = ""
    description: str
    timeline_type: TimelineType = TimelineType.other
    date_reference: str | None = Field(
        default=None,
        description="Raw text as stated in the call, e.g. 'before end of quarter'.",
    )
    evidence_utterance_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0, le=1)


class CompetitorMention(BaseModel):
    """A competitor explicitly mentioned in the call."""

    id: str = ""
    name: str
    context: str | None = None
    evidence_utterance_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0, le=1)


class GroundTruthAssessment(BaseModel):
    """Initial AI assessment. NOT the final Deal Reality verdict."""

    interest_level: ConfidenceLevel = ConfidenceLevel.unknown
    risk_level: ConfidenceLevel = ConfidenceLevel.unknown
    urgency_level: ConfidenceLevel = ConfidenceLevel.unknown
    confidence: float = Field(default=0.5, ge=0, le=1)


class GroundTruthAnalysis(BaseModel):
    """Full structured ground-truth extraction for one call."""

    prompt_version: str = GROUND_TRUTH_ANALYSIS_VERSION
    participants: list[ParticipantInsight] = Field(default_factory=list)
    objections: list[Objection] = Field(default_factory=list)
    buyer_signals: list[BuyerSignal] = Field(default_factory=list)
    stakeholders: list[StakeholderInsight] = Field(default_factory=list)
    commitments: list[Commitment] = Field(default_factory=list)
    next_steps: list[NextStep] = Field(default_factory=list)
    pricing_signals: list[PricingSignal] = Field(default_factory=list)
    timeline_signals: list[TimelineSignal] = Field(default_factory=list)
    competitor_mentions: list[CompetitorMention] = Field(default_factory=list)
    initial_ground_truth_assessment: GroundTruthAssessment = Field(
        default_factory=GroundTruthAssessment
    )