"""Local JSON-file storage for calls.

Hackathon-MVP storage: one JSON file per call under ``data/demo/calls/``.
The abstraction is intentionally small (save/load/list) so it can be swapped
for a database later without touching callers.
"""

import logging
from pathlib import Path

from pydantic import ValidationError

from shared.schemas.call import CallRecord, CallSummary

logger = logging.getLogger(__name__)


class StorageError(Exception):
    """Raised when local storage fails. Message is safe for clients."""


class CallStore:
    """Persists CallRecord objects as JSON files in a directory."""

    def __init__(self, directory: str | Path) -> None:
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)

    def _record_path(self, call_id: str) -> Path:
        return self.directory / f"{call_id}.json"

    def _source_dir(self, call_id: str) -> Path:
        return self.directory / call_id

    def save_call(self, call: CallRecord) -> None:
        """Persist a call record. Replaces any existing record with same id."""
        path = self._record_path(call.id)
        try:
            path.write_text(call.model_dump_json(indent=2), encoding="utf-8")
        except OSError as exc:
            logger.exception("Failed to write call %s", call.id)
            raise StorageError(f"Failed to store call {call.id}: {exc}") from exc

    def load_call(self, call_id: str) -> CallRecord | None:
        """Load a call record, or None if it does not exist."""
        path = self._record_path(call_id)
        if not path.exists():
            return None
        try:
            return CallRecord.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, ValidationError) as exc:
            logger.exception("Failed to read call %s", call_id)
            raise StorageError(f"Failed to read call {call_id}: {exc}") from exc

    def list_calls(self) -> list[CallSummary]:
        """Return lightweight summaries, newest first. Skips corrupt files."""
        summaries: list[CallSummary] = []
        for path in self.directory.glob("*.json"):
            try:
                call = CallRecord.model_validate_json(path.read_text(encoding="utf-8"))
            except (OSError, ValidationError):
                logger.warning("Skipping unreadable call file: %s", path)
                continue
            summaries.append(
                CallSummary(
                    id=call.id,
                    original_filename=call.original_filename,
                    created_at=call.created_at,
                    status=call.status,
                    error_message=call.error_message,
                )
            )
        return sorted(summaries, key=lambda c: c.created_at, reverse=True)

    def save_source(self, call_id: str, extension: str, data: bytes) -> Path:
        """Persist the original source audio for a call."""
        extension = (extension or "").lstrip(".").lower()
        directory = self._source_dir(call_id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"source.{extension}"
        try:
            path.write_bytes(data)
        except OSError as exc:
            logger.exception("Failed to write source audio for call %s", call_id)
            raise StorageError(
                f"Failed to store source audio for call {call_id}: {exc}"
            ) from exc
        return path