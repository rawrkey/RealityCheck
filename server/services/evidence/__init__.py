"""Evidence retrieval service."""

from server.services.evidence.service import EvidenceError, search_evidence

__all__ = ["EvidenceError", "search_evidence"]