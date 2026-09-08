"""AssemblyAI Voice Agent integration.

Only this module touches the Voice Agent HTTP/WebSocket surface. It mints
short-lived, single-use WebSocket tokens (so the permanent ``ASSEMBLYAI_API_KEY``
never reaches the browser) and produces the ``session.config`` the frontend
WebSocket client sends via ``session.update``.

The agent uses client-side function tools; execution happens through the server
tool handlers in ``server.services.voice_agent.tools``.
"""

import logging

import httpx

from server.config import settings
from server.services.voice_agent.tools import get_voice_agent_tools

logger = logging.getLogger(__name__)

TOKEN_PATH = "/v1/token"


class VoiceAgentError(Exception):
    """Raised when the Voice Agent integration fails. Message is safe for clients."""


def mint_voice_agent_token(*, expires_in_seconds: int | None = None) -> str:
    """Mint a short-lived Voice Agent WebSocket token.

    The token is single-use and meant to be redeemed within the redemption
    window before the WebSocket connect. The permanent API key stays server-side.
    """
    api_key = settings.assemblyai_api_key
    if not api_key:
        raise VoiceAgentError(
            "AssemblyAI API key is not configured (ASSEMBLYAI_API_KEY)."
        )

    ttl = expires_in_seconds or settings.voice_agent_token_ttl_seconds
    url = settings.voice_agent_base_url.rstrip("/") + TOKEN_PATH
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    params = {"expires_in_seconds": ttl}

    try:
        with httpx.Client(timeout=httpx.Timeout(30.0)) as client:
            response = client.get(url, headers=headers, params=params)
    except httpx.HTTPError as exc:
        logger.exception("Voice Agent token request failed")
        raise VoiceAgentError(f"Voice Agent token request failed: {exc}") from exc

    if response.status_code != 200:
        logger.error(
            "Voice Agent token endpoint returned %s: %s",
            response.status_code,
            response.text[:500],
        )
        raise VoiceAgentError(
            f"Voice Agent token endpoint returned HTTP {response.status_code}."
        )

    try:
        body = response.json()
        token = body["token"]
    except (KeyError, TypeError, ValueError) as exc:
        logger.exception("Voice Agent token response was invalid")
        raise VoiceAgentError("Voice Agent token response was invalid.") from exc

    if not token:
        raise VoiceAgentError("Voice Agent token response was invalid.")

    return token


def voice_agent_ws_endpoint(token: str) -> str:
    """Return the WebSocket URL used to connect the Voice Agent session."""
    base = settings.voice_agent_ws_url
    separator = "&" if "?" in base else "?"
    return f"{base}{separator}token={token}"


def build_session_config(
    *,
    system_prompt: str,
    greeting: str,
    tools: list[dict] | None = None,
) -> dict:
    """Build the ``session.update`` payload for the frontend WebSocket client.

    The returned dict is sent as ``{"type": "session.update", "session": ...}``.
    """
    return {
        "session": {
            "system_prompt": system_prompt,
            "tools": tools or get_voice_agent_tools(),
            "greeting": greeting,
        }
    }


__all__ = [
    "VoiceAgentError",
    "build_session_config",
    "mint_voice_agent_token",
    "voice_agent_ws_endpoint",
]