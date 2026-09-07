"""Aggregates all API routers into a single router mounted on the app."""

from fastapi import APIRouter

from server.api.routes.calls import router as calls_router
from server.api.routes.health import router as health_router
from server.api.routes.interrogation import router as interrogation_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(calls_router, prefix="/api")
api_router.include_router(interrogation_router, prefix="/api")