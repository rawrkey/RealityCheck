"""Call processing pipeline.

Orchestrates the synchronous demo workflow:

    uploaded -> transcribing -> analyzing -> ready | failed

External services (speech-to-text, analysis) are injectable so tests can pass
fakes. Defaults resolve at call time, which keeps monkeypatching simple.
"""

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from server.services.analysis.service import analyze_transcript
from server.services.assemblyai.service import transcribe_audio
from server.services.storage import StorageError, get_call_store
from shared.schemas.analysis import GroundTruthAnalysis
from shared.schemas.call import CallRecord, CallStatus
from shared.schemas.transcript import Transcript

logger = logging.getLogger(__name__)


def new_call_id() -> str:
    return uuid.uuid4().hex[:12]


def create_and_process_call(
    *,
    original_filename: str,
    audio: bytes,
    transcriber=None,
    analyzer=None,
    store=None,
) -> CallRecord:
    """Create a call record and run it through the full pipeline.

    Always returns a persisted CallRecord; on failure the record has
    status=failed and a human-readable error_message.
    """
    transcriber = transcriber or transcribe_audio
    analyzer = analyzer or analyze_transcript
    store = store or get_call_store()

    call = CallRecord(
        id=new_call_id(),
        original_filename=original_filename,
        created_at=datetime.now(timezone.utc),
        status=CallStatus.uploaded,
    )

    try:
        store.save_source(call.id, Path(original_filename).suffix, audio)
    except StorageError:
        logger.warning("Could not persist source audio for call %s", call.id)

    try:
        store.save_call(call)

        call.status = CallStatus.transcribing
        store.save_call(call)
        call.transcript = transcriber(audio)

        call.status = CallStatus.analyzing
        store.save_call(call)
        call.analysis = analyzer(call.transcript)

        call.status = CallStatus.ready
        store.save_call(call)
    except Exception as exc:  # noqa: BLE001 - record failure, keep message safe
        logger.exception("Call %s failed during processing", call.id)
        call.status = CallStatus.failed
        call.error_message = _friendly_error_message(exc)
        _persist_failure(store, call)

    return call


def _friendly_error_message(exc: Exception) -> str:
    """Produce a client-safe error message without credentials or stack traces."""
    if isinstance(exc, (StorageError,)) or _is_domain_error(exc):
        return str(exc) or exc.__class__.__name__
    return "Unexpected error while processing the call. Please try again."


def _is_domain_error(exc: Exception) -> bool:
    module_names = (
        "server.services.assemblyai",
        "server.services.analysis",
    )
    return exc.__class__.__module__.startswith(module_names)


def _persist_failure(store, call: CallRecord) -> None:
    """Best-effort persistence of the failed record."""
    try:
        store.save_call(call)
    except StorageError:
        logger.exception("Could not persist failed call %s", call.id)