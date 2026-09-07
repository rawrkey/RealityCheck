"""Shared test fixtures and helpers."""

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.main import app  # noqa: E402
from server.services.storage import CallStore  # noqa: E402
from shared.schemas.analysis import (  # noqa: E402
    GroundTruthAnalysis,
    GroundTruthAssessment,
)
from shared.schemas.call import CallRecord, CallStatus  # noqa: E402
from shared.schemas.transcript import Speaker, Transcript, Utterance  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def tmp_call_store(tmp_path: Path) -> CallStore:
    return CallStore(tmp_path / "calls")


@pytest.fixture
def sample_utterances() -> list[Utterance]:
    return [
        Utterance(
            id="utt_0001",
            speaker=Speaker.SPEAKER_A,
            start_ms=0,
            end_ms=3000,
            text="Thanks for the time today. What's the budget for this project?",
        ),
        Utterance(
            id="utt_0002",
            speaker=Speaker.SPEAKER_B,
            start_ms=3100,
            end_ms=8000,
            text="We're looking at around 50k but security sign-off takes a few weeks.",
        ),
        Utterance(
            id="utt_0003",
            speaker=Speaker.SPEAKER_A,
            start_ms=8100,
            end_ms=12000,
            text="Understood. I'll send over the security documentation tomorrow.",
        ),
        Utterance(
            id="utt_0004",
            speaker=Speaker.SPEAKER_B,
            start_ms=12100,
            end_ms=15000,
            text="Please do. Send it to our procurement team as well.",
        ),
    ]


@pytest.fixture
def sample_transcript(sample_utterances: list[Utterance]) -> Transcript:
    return Transcript(
        id="t_001",
        duration_seconds=15.0,
        language="en",
        utterances=sample_utterances,
        full_text=" ".join(u.text for u in sample_utterances),
    )


@pytest.fixture
def sample_analysis(sample_transcript: Transcript) -> GroundTruthAnalysis:
    """An analysis fully consistent with the sample transcript utterances."""
    return GroundTruthAnalysis(
        prompt_version="ground-truth-v1",
        participants=[
            {
                "speaker_id": Speaker.SPEAKER_B,
                "likely_role": "buyer",
                "confidence": 0.82,
                "evidence": "Discusses budget and procurement",
                "evidence_utterance_ids": ["utt_0002", "utt_0004"],
            }
        ],
        objections=[
            {
                "id": "obj_001",
                "category": "security",
                "description": "Security sign-off takes several weeks",
                "evidence_utterance_ids": ["utt_0002"],
                "confidence": 0.9,
            }
        ],
        buyer_signals=[
            {
                "id": "sig_001",
                "type": "positive_interest",
                "description": "Buyer engages on follow-up",
                "evidence_utterance_ids": ["utt_0004"],
                "sentiment": "positive",
                "confidence": 0.7,
            }
        ],
        commitments=[
            {
                "id": "commit_001",
                "speaker_id": Speaker.SPEAKER_A,
                "commitment": "Send security documentation tomorrow",
                "deadline": "tomorrow",
                "evidence_utterance_ids": ["utt_0003"],
                "confidence": 0.95,
            }
        ],
        next_steps=[
            {
                "id": "step_001",
                "description": "Send security docs to buyer and procurement",
                "step_type": "AGREED_NEXT_STEP",
                "owner": Speaker.SPEAKER_A,
                "deadline": "tomorrow",
                "evidence_utterance_ids": ["utt_0003", "utt_0004"],
                "confidence": 0.9,
            }
        ],
        pricing_signals=[
            {
                "id": "price_001",
                "pricing_discussed": True,
                "stated_budget": "around 50k",
                "evidence_utterance_ids": ["utt_0002"],
            }
        ],
        timeline_signals=[
            {
                "id": "tl_001",
                "description": "Security sign-off takes a few weeks",
                "timeline_type": "decision_date",
                "date_reference": "a few weeks",
                "evidence_utterance_ids": ["utt_0002"],
                "confidence": 0.8,
            }
        ],
        initial_ground_truth_assessment=GroundTruthAssessment(
            interest_level="medium",
            risk_level="medium",
            urgency_level="low",
            confidence=0.6,
        ),
    )


@pytest.fixture
def stored_call(tmp_call_store: CallStore, sample_transcript, sample_analysis) -> CallRecord:
    """A ready call already saved in the tmp store."""
    call = CallRecord(
        id="call_abc123",
        original_filename="demo.wav",
        created_at=datetime.now(timezone.utc),
        status=CallStatus.ready,
        transcript=sample_transcript,
        analysis=sample_analysis,
    )
    tmp_call_store.save_call(call)
    return call