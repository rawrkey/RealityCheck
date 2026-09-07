"""Aggregates all API routers into a single router mounted on the app."""

from fastapi import APIRouter

from server.api.routes.health import router as health_router

api_router = APIRouter()

api_router.include_router(health_router)
