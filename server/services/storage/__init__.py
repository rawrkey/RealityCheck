"""Call storage service."""

from server.config import settings
from server.services.storage.store import CallStore, StorageError

__all__ = ["CallStore", "StorageError", "get_call_store"]


def get_call_store() -> CallStore:
    """Construct the store from current settings (reads config each call)."""
    return CallStore(settings.call_storage_dir)