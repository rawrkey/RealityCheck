"""AssemblyAI speech-to-text integration.

This module is the ONLY place that touches the AssemblyAI SDK for
transcription. It converts provider output into the normalized internal
``Transcript`` model. No AssemblyAI-specific objects leak out of here.
"""

import logging

from server.config import settings
from shared.schemas.transcript import Speaker, Transcript, Utterance

logger = logging.getLogger(__name__)

# Ordered model list: Universal-3.5 Pro handles its supported languages; the
# API falls back to Universal-2 for anything outside that set (the documented,
# recommended arrangement for pre-recorded transcription).
SPEECH_MODELS = ["universal-3-5-pro", "universal-2"]

# Concise contextual description of the audio (Universal-3.5 Pro supports a
# single natural-language `prompt` that is not formatting/behavioral).
TRANSCRIPT_PROMPT = (
    "A B2B SaaS sales call between a sales representative and a prospective "
    "buyer discussing needs, budget, security sign-off, and next steps."
)

# Small domain-vocabulary boost for terms that appear in B2B sales calls. Kept
# deliberately short (well under the platform limits) to avoid noise.
KEYTERMS_PROMPT = [
    "security sign-off",
    "procurement",
    "proof of concept",
    "decision maker",
    "implementation timeline",
]


class AssemblyAIServiceError(Exception):
    """Raised when speech-to-text fails. Message is safe for clients."""


def _map_speaker(raw_speaker: str) -> Speaker:
    """Map a provider speaker label like "A" to a stable Speaker enum."""
    letter = raw_speaker.strip().upper()
    try:
        return Speaker[f"SPEAKER_{letter}"]
    except KeyError:
        raise AssemblyAIServiceError(
            f"Unexpected speaker label from transcription provider: {raw_speaker!r}"
        ) from None


def _to_internal_transcript(result: object) -> Transcript:
    """Convert an AssemblyAI transcript object into our internal model."""
    utterances: list[Utterance] = []
    for index, item in enumerate(result.utterances or [], start=1):
        utterances.append(
            Utterance(
                id=f"utt_{index:04d}",
                speaker=_map_speaker(item.speaker),
                start_ms=int(item.start),
                end_ms=int(item.end),
                text=item.text,
            )
        )
    return Transcript(
        id=str(getattr(result, "id", "")),
        duration_seconds=float(getattr(result, "audio_duration", 0.0) or 0.0),
        language=getattr(result, "language_code", None) or "unknown",
        utterances=utterances,
        full_text=getattr(result, "text", None) or "",
    )


def transcribe_audio(data: bytes) -> Transcript:
    """Transcribe raw audio bytes with speaker labels.

    Uploads the bytes to AssemblyAI, starts a speaker-labeled transcription,
    and waits for completion. Returns the normalized Transcript.
    """
    api_key = settings.assemblyai_api_key
    if not api_key:
        raise AssemblyAIServiceError(
            "AssemblyAI API key is not configured (ASSEMBLYAI_API_KEY)."
        )

    try:
        import assemblyai as aai

        aai.settings.api_key = api_key
        aai.settings.base_url = settings.assemblyai_base_url

        transcriber = aai.Transcriber()
        upload_url = transcriber.upload_file(data)
        config = aai.TranscriptionConfig(
            speech_models=SPEECH_MODELS,
            speaker_labels=True,
            language_detection=True,
            prompt=TRANSCRIPT_PROMPT,
            keyterms_prompt=KEYTERMS_PROMPT,
        )
        result = transcriber.transcribe(upload_url, config=config)
    except AssemblyAIServiceError:
        raise
    except Exception as exc:  # noqa: BLE001 - surface as user-safe error
        logger.exception("AssemblyAI request failed")
        raise AssemblyAIServiceError(
            f"Speech-to-text request to AssemblyAI failed: {exc}"
        ) from exc

    if getattr(result, "status", None) == aai.TranscriptStatus.error:
        error_detail = getattr(result, "error", None) or "unknown error"
        raise AssemblyAIServiceError(f"Speech-to-text failed: {error_detail}")

    return _to_internal_transcript(result)