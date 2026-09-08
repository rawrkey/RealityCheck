"""Phase 5C: live provider path, model configuration, labeling, and provider status.

All external APIs are mocked; no live AssemblyAI access.
"""

import json
from types import SimpleNamespace

import pytest

from server.config import settings
from server.services.analysis.llm_gateway import chat_structured
from server.services.assemblyai.service import (
    AssemblyAIServiceError,
    transcribe_audio,
)
from server.services.sample_call import SAMPLE_CALL_ID, ensure_sample_call
from shared.schemas.call import CallRecord, CallSource, CallStatus

PIPELINE = "server.services.calls.pipeline"
AAI_SERVICE = "server.services.assemblyai.service"
LLM_GATEWAY = "server.services.analysis.llm_gateway"
CALLS_ROUTE = "server.api.routes.calls"


# ---- configuration ----------------------------------------------------------


def test_default_analysis_model_is_gemini_flash_lite() -> None:
    assert settings.assemblyai_llm_model == "gemini-2.5-flash-lite"


def test_default_fallback_model_is_cross_provider() -> None:
    assert settings.assemblyai_llm_fallback_model == "claude-sonnet-4-6"


# ---- transcription configuration --------------------------------------------


def test_transcribe_passes_expected_models_and_speaker_labels(monkeypatch) -> None:
    captured: dict = {}

    class FakeTranscriber:
        def upload_file(self, data: bytes) -> str:
            return "https://upload.example/audio.wav"

        def transcribe(self, upload_url: str, config=None):
            captured["config"] = config
            return SimpleNamespace(
                id="tr_live_001",
                status="completed",
                audio_duration=1.0,
                language_code="en",
                text="Hello there.",
                utterances=[
                    SimpleNamespace(
                        speaker="A",
                        start=0,
                        end=1000,
                        text="Hello there.",
                    )
                ],
            )

    import assemblyai as aai

    monkeypatch.setattr(aai, "Transcriber", lambda: FakeTranscriber())
    monkeypatch.setattr(settings, "assemblyai_api_key", "test-key")

    transcript = transcribe_audio(b"RIFF demo audio")

    config = captured["config"]
    assert config.speech_models == ["universal-3-5-pro", "universal-2"]
    assert config.speaker_labels is True
    assert config.language_detection is True
    assert config.prompt  # scenario prompt is present
    assert config.keyterms_prompt  # small domain vocab is present

    assert transcript.id == "tr_live_001"
    assert transcript.utterances[0].speaker.value == "SPEAKER_A"


def test_transcribe_requires_api_key(monkeypatch) -> None:
    monkeypatch.setattr(settings, "assemblyai_api_key", None)
    with pytest.raises(AssemblyAIServiceError, match="API key"):
        transcribe_audio(b"RIFF demo audio")


# ---- LLM Gateway: configured model + fallback -------------------------------


def test_llm_gateway_receives_configured_model_and_fallback(monkeypatch) -> None:
    captured: dict = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": '{"ok": true}'}}]}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, url, headers, json):
            captured["url"] = url
            captured["headers"] = headers
            captured["payload"] = json
            return FakeResponse()

    monkeypatch.setattr(f"{LLM_GATEWAY}.httpx.Client", FakeClient)
    monkeypatch.setattr(settings, "assemblyai_api_key", "test-key")

    result = chat_structured(
        model=settings.assemblyai_llm_model,
        system_prompt="sys",
        user_prompt="usr",
        schema_name="ground_truth_analysis",
        json_schema={},
    )

    assert result == '{"ok": true}'
    payload = captured["payload"]
    assert payload["model"] == "gemini-2.5-flash-lite"
    assert payload["fallbacks"] == [{"model": "claude-sonnet-4-6"}]
    assert payload["response_format"]["type"] == "json_schema"
    assert payload["response_format"]["json_schema"]["strict"] is True
    assert captured["headers"]["authorization"] == "test-key"


def test_llm_gateway_respects_configured_model_override(monkeypatch) -> None:
    captured: dict = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": "x"}}]}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, url, headers, json):
            captured["payload"] = json
            return FakeResponse()

    monkeypatch.setattr(f"{LLM_GATEWAY}.httpx.Client", FakeClient)
    monkeypatch.setattr(settings, "assemblyai_api_key", "test-key")
    monkeypatch.setattr(settings, "assemblyai_llm_model", "gpt-5.1")

    chat_structured(
        model=settings.assemblyai_llm_model,
        system_prompt="sys",
        user_prompt="usr",
        schema_name="x",
        json_schema={},
    )

    assert captured["payload"]["model"] == "gpt-5.1"


def test_llm_gateway_omits_fallback_when_disabled(monkeypatch) -> None:
    captured: dict = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": "x"}}]}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, url, headers, json):
            captured["payload"] = json
            return FakeResponse()

    monkeypatch.setattr(f"{LLM_GATEWAY}.httpx.Client", FakeClient)
    monkeypatch.setattr(settings, "assemblyai_api_key", "test-key")
    monkeypatch.setattr(settings, "assemblyai_llm_fallback_model", "")

    chat_structured(
        model=settings.assemblyai_llm_model,
        system_prompt="sys",
        user_prompt="usr",
        schema_name="x",
        json_schema={},
    )

    assert "fallbacks" not in captured["payload"]


def test_llm_gateway_requires_api_key(monkeypatch) -> None:
    from server.services.analysis.llm_gateway import LLMGatewayError

    monkeypatch.setattr(settings, "assemblyai_api_key", None)
    with pytest.raises(LLMGatewayError, match="API key"):
        chat_structured(
            model=settings.assemblyai_llm_model,
            system_prompt="sys",
            user_prompt="usr",
            schema_name="x",
            json_schema={},
        )


# ---- live upload reaches the provider pipeline ------------------------------


def test_live_upload_fails_gracefully_without_api_key(
    client, monkeypatch, tmp_call_store
) -> None:
    monkeypatch.setattr(f"{CALLS_ROUTE}.get_call_store", lambda: tmp_call_store)
    monkeypatch.setattr(f"{PIPELINE}.get_call_store", lambda: tmp_call_store)
    monkeypatch.setattr(settings, "assemblyai_api_key", None)

    response = client.post(
        "/api/calls",
        files={"file": ("demo.wav", b"RIFF demo audio", "audio/wav")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "failed"
    assert "API key" in body["error_message"]


def test_live_upload_pipeline_reaches_assemblyai_service(
    client, monkeypatch, tmp_call_store
) -> None:
    from shared.schemas.transcript import Speaker, Transcript, Utterance

    transcript = Transcript(
        id="t_live",
        duration_seconds=1.0,
        language="en",
        utterances=[
            Utterance(
                id="utt_0001",
                speaker=Speaker.SPEAKER_A,
                start_ms=0,
                end_ms=500,
                text="Hi.",
            )
        ],
        full_text="Hi.",
    )

    def fake_analyzer(inner_transcript):
        from server.services.sample_call import build_sample_analysis

        return build_sample_analysis(inner_transcript)

    monkeypatch.setattr(f"{PIPELINE}.transcribe_audio", lambda data: transcript)
    monkeypatch.setattr(f"{PIPELINE}.analyze_transcript", fake_analyzer)
    monkeypatch.setattr(f"{PIPELINE}.get_call_store", lambda: tmp_call_store)
    monkeypatch.setattr(f"{CALLS_ROUTE}.get_call_store", lambda: tmp_call_store)

    response = client.post(
        "/api/calls",
        files={"file": ("feet.wav", b"RIFF demo audio", "audio/wav")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "ready"
    assert body["source"] == "upload"
    assert body["transcript"]["id"] == "t_live"


# ---- sample path is independent of provider availability ---------------------


def test_sample_call_loads_without_api_key(client, monkeypatch, tmp_call_store) -> None:
    monkeypatch.setattr(f"{CALLS_ROUTE}.get_call_store", lambda: tmp_call_store)
    monkeypatch.setattr(settings, "assemblyai_api_key", None)

    response = client.post("/api/calls/demo")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == SAMPLE_CALL_ID
    assert body["status"] == "ready"
    assert body["source"] == "sample"


def test_sample_seed_is_idempotent(client, tmp_call_store) -> None:
    first = ensure_sample_call(tmp_call_store)
    again = ensure_sample_call(tmp_call_store)
    assert again == first
    assert again.id == SAMPLE_CALL_ID


# ---- source labeling ---------------------------------------------------------


def test_sample_call_is_labeled_sample(tmp_call_store) -> None:
    call = ensure_sample_call(tmp_call_store)
    assert call.source == CallSource.sample


def test_upload_pipeline_defaults_to_upload_source() -> None:
    call = CallRecord(
        id="live_001",
        original_filename="real.wav",
        created_at=settings_portable_now(),
    )
    assert call.source == CallSource.upload


def test_sample_call_self_heals_preexisting_record(tmp_call_store) -> None:
    legacy = CallRecord(
        id=SAMPLE_CALL_ID,
        original_filename="sample-nova-onboarding.mp3",
        created_at=settings_portable_now(),
        status=CallStatus.ready,
        source=CallSource.upload,
    )
    tmp_call_store.save_call(legacy)

    healed = ensure_sample_call(tmp_call_store)
    assert healed.source == CallSource.sample
    stored = tmp_call_store.load_call(SAMPLE_CALL_ID)
    assert stored.source == CallSource.sample


def test_list_calls_includes_source(client, monkeypatch, tmp_call_store) -> None:
    alias_call = CallRecord(
        id="list_live",
        original_filename="real2.wav",
        created_at=settings_portable_now(),
        status=CallStatus.uploaded,
    )
    tmp_call_store.save_call(alias_call)

    monkeypatch.setattr(f"{CALLS_ROUTE}.get_call_store", lambda: tmp_call_store)
    listing = client.get("/api/calls").json()
    by_id = {item["id"]: item for item in listing}
    assert by_id["list_live"]["source"] == "upload"


# ---- provider status ---------------------------------------------------------


def test_provider_status_sample_mode_without_key(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "assemblyai_api_key", None)
    response = client.get("/api/calls/provider-status")
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "live_analysis_available": False,
        "voice_available": False,
        "mode": "sample",
        "label": "Sample mode",
    }


def test_provider_status_live_with_key(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "assemblyai_api_key", "test-key")
    response = client.get("/api/calls/provider-status")
    assert response.status_code == 200
    body = response.json()
    assert body["live_analysis_available"] is True
    assert body["voice_available"] is True
    assert body["mode"] == "live"
    assert body["label"] == "Live analysis available"


def test_provider_status_does_not_leak_key(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "assemblyai_api_key", "super-secret-key")
    body = client.get("/api/calls/provider-status").json()
    assert "super-secret-key" not in json.dumps(body)


def settings_portable_now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)