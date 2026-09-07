"""Client for the AssemblyAI LLM Gateway.

The LLM Gateway is OpenAI-compatible. We keep all gateway HTTP detail here so
the analysis service only deals with prompts and models. Auth uses the
``authorization`` header per AssemblyAI's docs (no ``Bearer`` prefix).
"""

import json
import logging

import httpx

from server.config import settings

logger = logging.getLogger(__name__)

CHAT_COMPLETIONS_PATH = "/chat/completions"


class LLMGatewayError(Exception):
    """Raised when the LLM Gateway call fails. Message is safe for clients."""


def chat_structured(
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    schema_name: str,
    json_schema: dict,
) -> str:
    """Ask the gateway for a structured completion and return the raw content."""
    api_key = settings.assemblyai_api_key
    if not api_key:
        raise LLMGatewayError(
            "AssemblyAI API key is not configured (ASSEMBLYAI_API_KEY)."
        )

    url = settings.assemblyai_llm_base_url.rstrip("/") + CHAT_COMPLETIONS_PATH
    headers = {
        "authorization": api_key,
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0,
        "max_tokens": settings.assemblyai_llm_max_tokens,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "schema": json_schema,
                "strict": True,
            },
        },
        "post_processing_steps": [{"type": "json-repair"}],
    }

    try:
        with httpx.Client(timeout=httpx.Timeout(180.0)) as client:
            response = client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        logger.exception("LLM Gateway request failed")
        raise LLMGatewayError(f"LLM Gateway request failed: {exc}") from exc

    if response.status_code != 200:
        logger.error(
            "LLM Gateway returned %s: %s", response.status_code, response.text[:500]
        )
        raise LLMGatewayError(
            f"Analysis service returned HTTP {response.status_code}."
        )

    try:
        body = response.json()
        return body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        logger.exception("LLM Gateway returned unexpected response body")
        raise LLMGatewayError("Analysis service returned an invalid response.") from exc