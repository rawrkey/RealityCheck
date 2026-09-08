"""Call lifecycle and persistence models."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from shared.schemas.analysis import GroundTruthAnalysis
from shared.schemas.transcript import Transcript


class CallStatus(str, Enum):
    uploaded = "uploaded"
    transcribing = "transcribing"
    analyzing = "analyzing"
    ready = "ready"
    failed = "failed"


class CallSource(str, Enum):
    """Where a call record came from: the bundled deterministic sample or a real upload."""

    sample = "sample"
    upload = "upload"


class CallRecord(BaseModel):
    """Primary persisted object for a processed call."""

    id: str
    original_filename: str
    created_at: datetime
    status: CallStatus = CallStatus.uploaded
    source: CallSource = CallSource.upload
    transcript: Transcript | None = None
    analysis: GroundTruthAnalysis | None = None
    error_message: str | None = Field(
        default=None,
        description="Human-readable error when status is failed.",
    )


class CallSummary(BaseModel):
    """Lightweight metadata for list endpoints."""

    id: str
    original_filename: str
    created_at: datetime
    status: CallStatus
    source: CallSource = CallSource.upload
    error_message: str | None = None