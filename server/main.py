"""RealityCheck FastAPI application entrypoint.

Run with:
    uv run uvicorn server.main:app

or from the repository root:
    uvicorn server.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.api.router import api_router
from server.config import settings

app = FastAPI(
    title="RealityCheck API",
    description="AI voice sales manager that challenges a rep's read on the call.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
