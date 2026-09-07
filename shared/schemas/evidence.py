"""Evidence items that tie analysis facts back to transcript utterances."""

from pydantic import BaseModel

from shared.schemas.transcript import Speaker


class EvidenceItem(BaseModel):
    """A transcript utterance returned as evidence for an analysis claim."""

    utterance_id: str
    speaker: Speaker
    start_ms: int
    end_ms: int
    timestamp: str
    text: str
    matched_reason: str