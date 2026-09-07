"""Call ingestion and processing pipeline."""

from server.services.calls.pipeline import create_and_process_call, new_call_id

__all__ = ["create_and_process_call", "new_call_id"]