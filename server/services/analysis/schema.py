"""Ground-truth analysis JSON Schema.

This thin module keeps the Phase 2 ``ground_truth_json_schema()`` entrypoint
while delegating the strict/inlined schema construction to the shared helper in
``server/services/json_schema.py``.
"""

from server.services.json_schema import strict_json_schema
from shared.schemas.analysis import GroundTruthAnalysis


def ground_truth_json_schema() -> dict:
    """Return a strict, inlined JSON Schema for GroundTruthAnalysis."""
    return strict_json_schema(GroundTruthAnalysis)
