"""Shared domain schemas.

These are lightweight placeholder types describing the core domain vocabulary.
The full product data model will be designed in Phase 3; only minimal, obvious
types are included here to establish the shape without inventing the model.
"""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Response body for the health endpoint."""

    status: str
