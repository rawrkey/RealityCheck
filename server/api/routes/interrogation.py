"""Voice interrogation, debrief, tool relay, and Deal Reality endpoints."""

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from server.config import settings
from server.services.interrogation import (
    InterrogationError,
    NoDebriefError,
    build_deal_reality,
    compute_alignments,
    create_session,
    extract_claims,
    record_debrief,
)
from server.services.storage import StorageError, get_call_store
from server.services.voice_agent import (
    VoiceAgentError,
    build_session_config,
    execute_tool,
    mint_voice_agent_token,
    voice_agent_ws_endpoint,
)
from shared.schemas.call import CallRecord
from shared.schemas.interrogation import (
    ClaimAlignment,
    DealReality,
    DebriefResponse,
    InterrogationConfig,
    InterrogationMessage,
    InterrogationRole,
    InterrogationSession,
)

router = APIRouter(prefix="/calls", tags=["interrogation"])

TOOL_EXECUTION_TIMEOUT_MS = 30_000


class DebriefMessageInput(BaseModel):
    """A single turn of the debrief as captured by the frontend."""

    role: InterrogationRole
    text: str = Field(..., min_length=1)


class DebriefInput(BaseModel):
    """The recorded debrief conversation, in order."""

    messages: list[DebriefMessageInput] = Field(default_factory=list)


class ToolCallInput(BaseModel):
    """A Voice Agent tool call relayed from the browser for server-side execution."""

    name: str
    arguments: dict = Field(default_factory=dict)


class ToolResult(BaseModel):
    """Result of executing a Voice Agent tool on the server."""

    result: str
    calls: list[dict] = Field(
        default_factory=list,
        description="Optional supplemental data (e.g. evidence) for the UI.",
    )


class VoiceAvailability(BaseModel):
    """Whether a live voice debrief is possible for a call, and why not."""

    available: bool
    reason: str | None = Field(
        default=None,
        description="Human-readable explanation when voice is unavailable.",
    )


@router.get("/{call_id}/interrogation/voice", response_model=VoiceAvailability)
def voice_availability(call_id: str) -> VoiceAvailability:
    """Report whether a live voice debrief is available for a call.

    Voice needs an AssemblyAI API key configured server-side. This is a pure
    capability probe (no token is minted) so the frontend can honestly present
    either a voice debrief or the typed fallback before the rep commits.
    """
    _load_or_404(call_id)
    if settings.assemblyai_api_key:
        return VoiceAvailability(available=True, reason=None)
    return VoiceAvailability(
        available=False,
        reason="Live voice isn't available in this environment "
        "(no ASSEMBLYAI_API_KEY is configured).",
    )


@router.post(
    "/{call_id}/interrogation/session",
    response_model=InterrogationSession,
    status_code=201,
)
def start_interrogation(call_id: str) -> InterrogationSession:
    """Create a fresh Voice Interrogation session, or return the existing one."""
    call = _load_or_404(call_id)
    existing = _load_session_or_none(call_id)
    if existing is not None:
        return existing
    return create_session(call)


@router.get("/{call_id}/interrogation/session", response_model=InterrogationSession)
def get_interrogation(call_id: str) -> InterrogationSession:
    """Return the interrogation session for a call."""
    return _load_session_or_404(call_id)


@router.post("/{call_id}/interrogation/debrief", response_model=DebriefResponse)
def submit_debrief(call_id: str, payload: DebriefInput) -> DebriefResponse:
    """Record the debrief and extract structured rep claims."""
    call = _load_or_404(call_id)
    session = _load_session_or_404(call_id)

    try:
        session = record_debrief(
            call,
            session,
            [m.model_dump() for m in payload.messages],
        )
        session = extract_claims(session)
        alignments = compute_alignments(call, session)
    except NoDebriefError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except InterrogationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return DebriefResponse(
        call_id=call.id,
        session=session,
        alignments=alignments,
    )


@router.get("/{call_id}/debrief", response_model=DebriefResponse)
def get_debrief(call_id: str) -> DebriefResponse:
    """Return the whole debrief: session, claims and current alignments."""
    call = _load_or_404(call_id)
    session = _load_session_or_404(call_id)
    try:
        alignments = compute_alignments(call, session)
    except NoDebriefError:
        alignments = []
    return DebriefResponse(call_id=call.id, session=session, alignments=alignments)


@router.get(
    "/{call_id}/interrogation/alignment", response_model=list[ClaimAlignment]
)
def get_alignments(call_id: str) -> list[ClaimAlignment]:
    """Recompute and return perception-vs-evidence alignments for a call."""
    call = _load_or_404(call_id)
    session = _load_session_or_404(call_id)
    try:
        return compute_alignments(call, session)
    except NoDebriefError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{call_id}/interrogation/align", response_model=list[ClaimAlignment])
def align_claims_endpoint(call_id: str) -> list[ClaimAlignment]:
    """Recompute alignments (getter variant kept for symmetry/tooling)."""
    return get_alignments(call_id)


@router.get("/{call_id}/reality", response_model=DealReality)
def get_deal_reality(call_id: str) -> DealReality:
    """Return the persisted Deal Reality, building it if none was created."""
    _load_or_404(call_id)
    existing = _load_reality_or_none(call_id)
    if existing is not None:
        return existing
    return _build_reality(call_id)


@router.post("/{call_id}/interrogation/reality", response_model=DealReality)
def create_deal_reality(call_id: str) -> DealReality:
    """Compute (and persist) the Deal Reality for a call."""
    return _build_reality(call_id)


# ---- Voice Agent wiring ----------------------------------------------------


@router.get("/{call_id}/interrogation/config", response_model=InterrogationConfig)
def interrogation_config(call_id: str) -> InterrogationConfig:
    """Mint a short-lived Voice Agent token and return the full session config."""
    _load_or_404(call_id)
    session = _load_session_or_404(call_id)

    try:
        token = mint_voice_agent_token(
            expires_in_seconds=settings.voice_agent_token_ttl_seconds
        )
    except VoiceAgentError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    greeting = _greeting_from_session(session)
    return InterrogationConfig(
        call_id=call_id,
        token=token,
        websocket_url=voice_agent_ws_endpoint(token),
        session=build_session_config(
            system_prompt=session.system_prompt,
            greeting=greeting,
        ),
        expires_in_seconds=settings.voice_agent_token_ttl_seconds,
    )


@router.post("/{call_id}/interrogation/tool", response_model=ToolResult)
def relay_tool(call_id: str, payload: ToolCallInput) -> ToolResult:
    """Execute a Voice Agent tool call on the server and return its result.

    The browser relays ``tool.call`` (received over the WebSocket) here; the
    resulting string is then sent back as ``tool.result``. This keeps the
    permanent API key and evidence logic server-side.
    """
    call = _load_or_404(call_id)
    transcript = call.transcript
    if transcript is None:
        raise HTTPException(
            status_code=409,
            detail=f"Transcript is not available for call {call_id} "
            f"(status={call.status.value}).",
        )
    try:
        result = execute_tool(
            transcript,
            name=payload.name,
            arguments=payload.arguments,
            analysis=call.analysis,
        )
    except Exception as exc:  # noqa: BLE001 - surfaced as a safe tool error
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ToolResult(result=result)


# ---- helpers ---------------------------------------------------------------


def _load_or_404(call_id: str) -> CallRecord:
    try:
        call = get_call_store().load_call(call_id)
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if call is None:
        raise HTTPException(status_code=404, detail=f"Call {call_id} not found.")
    return call


def _load_session_or_none(call_id: str) -> InterrogationSession | None:
    try:
        return get_call_store().load_interrogation(call_id)
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _load_session_or_404(call_id: str) -> InterrogationSession:
    session = _load_session_or_none(call_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"No interrogation session for call {call_id}. "
            "Start one first.",
        )
    return session


def _load_reality_or_none(call_id: str) -> DealReality | None:
    try:
        return get_call_store().load_reality(call_id)
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _build_reality(call_id: str) -> DealReality:
    call = _load_or_404(call_id)
    session = _load_session_or_none(call_id)
    try:
        alignments = compute_alignments(call, session) if session else []
    except NoDebriefError:
        alignments = []
    try:
        return build_deal_reality(call, session, alignments)
    except InterrogationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _greeting_from_session(session: InterrogationSession) -> str:
    for message in session.messages:
        if message.role == InterrogationRole.agent:
            return message.text
    return "Let's debrief the call."