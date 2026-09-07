"""Health check endpoint used to verify the service is running."""

from fastapi import APIRouter

from shared.schemas.common import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Basic liveness probe."""
    return HealthResponse(status="ok")
