"""API behavior for the call lifecycle using injected fakes (no external calls)."""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from server.services.analysis import AnalysisError
from server.services.assemblyai import AssemblyAIServiceError
from shared.schemas.call import CallRecord, CallStatus
from shared.schemas.transcript import Transcript

PIPELINE = "server.services.calls.pipeline"


@pytest.fixture
def mock_external_services(
    monkeypatch,
    tmp_call_store,
    sample_transcript,
    sample_analysis,
) -> None:
    monkeypatch.setattr(f"{PIPELINE}.transcribe_audio", lambda data: sample_transcript)
    monkeypatch.setattr(f"{PIPELINE}.analyze_transcript", lambda transcript: sample_analysis)
    monkeypatch.setattr(f"{PIPELINE}.get_call_store", lambda: tmp_call_store)
    monkeypatch.setattr(
        "server.api.routes.calls.get_call_store",
        lambda: tmp_call_store,
    )


def test_upload_processes_and_returns_ready(
    client: TestClient, mock_external_services
) -> None:
    response = client.post(
        "/api/calls",
        files={"file": ("demo.wav", b"RIFF demo audio", "audio/wav")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "ready"
    assert body["original_filename"] == "demo.wav"
    assert body["transcript"]["id"] == "t_001"
    assert body["analysis"]["commitments"][0]["id"] == "commit_001"
    assert "error_message" not in body or body["error_message"] is None


def test_upload_failure_marks_call_failed(
    client: TestClient, mock_external_services, sample_transcript
) -> None:
    def broken_transcriber(data: bytes) -> Transcript:
        raise AssemblyAIServiceError("Speech-to-text failed: boom")

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(f"{PIPELINE}.transcribe_audio", broken_transcriber)
    try:
        response = client.post(
            "/api/calls",
            files={"file": ("demo.wav", b"RIFF demo audio", "audio/wav")},
        )
    finally:
        monkeypatch.undo()

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "failed"
    assert "boom" in body["error_message"]


def test_upload_analysis_failure_marks_call_failed(
    client: TestClient, mock_external_services
) -> None:
    monkeypatch = pytest.MonkeyPatch()

    def broken_analyzer(transcript):
        raise AnalysisError("Analysis produced invalid structured output.")

    monkeypatch.setattr(f"{PIPELINE}.analyze_transcript", broken_analyzer)
    try:
        response = client.post(
            "/api/calls",
            files={"file": ("demo.wav", b"RIFF demo audio", "audio/wav")},
        )
    finally:
        monkeypatch.undo()

    assert response.status_code == 201
    assert response.json()["status"] == "failed"
    assert "Analysis produced invalid structured output" in response.json()["error_message"]


def test_upload_saves_source_audio(
    client: TestClient, mock_external_services, tmp_call_store
) -> None:
    client.post(
        "/api/calls",
        files={"file": ("demo.wav", b"RIFF demo audio", "audio/wav")},
    )
    call = tmp_call_store.list_calls()[0]
    source = tmp_call_store._source_dir(call.id) / "source.wav"
    assert source.read_bytes() == b"RIFF demo audio"


def test_list_detail_transcript_evidence(
    client: TestClient, mock_external_services, tmp_call_store
) -> None:
    created = client.post(
        "/api/calls",
        files={"file": ("demo.wav", b"RIFF demo audio", "audio/wav")},
    ).json()
    call_id = created["id"]

    listing = client.get("/api/calls")
    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()] == [call_id]

    detail = client.get(f"/api/calls/{call_id}")
    assert detail.status_code == 200
    assert detail.json()["id"] == call_id

    transcript = client.get(f"/api/calls/{call_id}/transcript")
    assert transcript.status_code == 200
    assert transcript.json()["utterances"][0]["id"] == "utt_0001"

    evidence = client.get(f"/api/calls/{call_id}/evidence", params={"query": "procurement"})
    assert evidence.status_code == 200
    items = evidence.json()
    assert len(items) == 1
    assert items[0]["utterance_id"] == "utt_0004"

    item_evidence = client.get(
        f"/api/calls/{call_id}/evidence", params={"analysis_item_id": "commit_001"}
    )
    assert item_evidence.status_code == 200
    assert [i["utterance_id"] for i in item_evidence.json()] == ["utt_0003"]


def test_unknown_call_returns_404(client) -> None:
    assert client.get("/api/calls/doesnotexist").status_code == 404
    assert client.get("/api/calls/doesnotexist/transcript").status_code == 404
    assert client.get("/api/calls/doesnotexist/evidence").status_code == 404


def test_transcript_not_ready_returns_409(client, tmp_call_store) -> None:
    call = CallRecord(
        id="call_pending",
        original_filename="pending.wav",
        created_at=datetime.now(timezone.utc),
        status=CallStatus.transcribing,
    )
    tmp_call_store.save_call(call)

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr("server.api.routes.calls.get_call_store", lambda: tmp_call_store)
    try:
        response = client.get("/api/calls/call_pending/transcript")
    finally:
        monkeypatch.undo()

    assert response.status_code == 409