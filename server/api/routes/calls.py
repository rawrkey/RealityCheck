"""Call ingestion, retrieval, and evidence endpoints."""

import logging
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from server.services.calls import pipeline
from server.services.evidence import search_evidence
from server.services.storage import StorageError, get_call_store
from shared.schemas.call import CallRecord, CallSummary
from shared.schemas.evidence import EvidenceItem
from shared.schemas.transcript import Transcript

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calls", tags=["calls"])

ALLOWED_AUDIO_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".m4a",
    ".mp4",
    ".mov",
    ".aac",
    ".flac",
    ".ogg",
    ".wma",
    ".webm",
}

MAX_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024  # 200 MB safety cap


@router.post("", response_model=CallRecord, status_code=201)
def upload_call(file: UploadFile | None = File(None)) -> CallRecord:
    """Upload a sales-call audio file and process it synchronously."""
    filename, audio = _read_and_validate_upload(file)
    return pipeline.create_and_process_call(
        original_filename=filename,
        audio=audio,
    )


@router.get("", response_model=list[CallSummary])
def list_calls() -> list[CallSummary]:
    """List processed calls (lightweight metadata)."""
    return get_call_store().list_calls()


@router.get("/{call_id}", response_model=CallRecord)
def get_call(call_id: str) -> CallRecord:
    """Return the full processed call."""
    call = _load_or_404(call_id)
    return call


@router.get("/{call_id}/transcript", response_model=Transcript)
def get_transcript(call_id: str) -> Transcript:
    """Return the normalized transcript for a call."""
    call = _load_or_404(call_id)
    if call.transcript is None:
        raise HTTPException(
            status_code=409,
            detail=f"Transcript is not available for call {call_id} "
            f"(status={call.status.value}).",
        )
    return call.transcript


@router.get("/{call_id}/evidence", response_model=list[EvidenceItem])
def get_evidence(
    call_id: str,
    query: str | None = None,
    analysis_item_id: str | None = None,
    utterance_id: str | None = None,
    utterance_ids: str | None = None,
) -> list[EvidenceItem]:
    """Return transcript evidence matching a keyword, analysis item, or utterance."""
    call = _load_or_404(call_id)
    if call.transcript is None:
        raise HTTPException(
            status_code=409,
            detail=f"Evidence is not available for call {call_id} "
            f"(status={call.status.value}).",
        )
    return search_evidence(
        call.transcript,
        query=query,
        analysis_item_id=analysis_item_id,
        utterance_id=utterance_id,
        utterance_ids=utterance_ids,
        analysis=call.analysis,
    )


# ---- helpers ---------------------------------------------------------------


def _load_or_404(call_id: str) -> CallRecord:
    try:
        call = get_call_store().load_call(call_id)
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if call is None:
        raise HTTPException(status_code=404, detail=f"Call {call_id} not found.")
    return call


def _read_and_validate_upload(file: UploadFile | None) -> tuple[str, bytes]:
    if file is None:
        raise HTTPException(status_code=400, detail="No file provided. Use multipart field 'file'.")

    filename = file.filename or ""

    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{extension or '(none)'}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))}.",
        )

    try:
        audio = file.file.read()
    except Exception as exc:  # noqa: BLE001 - reading failure surfaced cleanly
        logger.exception("Failed to read uploaded file")
        raise HTTPException(status_code=400, detail="Failed to read the uploaded file.") from exc
    finally:
        file.file.close()

    if not audio:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if len(audio) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="The uploaded file exceeds the maximum allowed size.",
        )

    return filename, audio