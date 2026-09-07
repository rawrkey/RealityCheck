"""Voice Agent function-tool definitions and their server-side handlers.

The AssemblyAI Voice Agent uses *client-side function tools*: the agent emits
a ``tool.call`` over the WebSocket, and *our* code runs the logic and returns a
``tool.result``. To keep the permanent API key and evidence logic server-side,
the browser relays ``tool.call`` to our backend, which executes the handler
here and returns a serializable result string for the agent to speak.
"""

import json

from server.services.evidence import search_evidence
from shared.schemas.interrogation import InterrogationDimension
from shared.schemas.transcript import Transcript


class ToolExecutionError(Exception):
    """Raised when a Voice Agent tool cannot be executed. Message is safe."""


class ToolNotFoundError(ToolExecutionError):
    """Raised when the requested tool name is not registered."""


# ---- tool definitions (exposed to the Voice Agent via session.tools) --------
# The ``name`` values here are the tool names the agent calls.
# ``parameters`` is the JSON Schema the agent uses to fill arguments from speech.

def _transcript_evidence_tool() -> dict:
    """The tool that lets the Voice Agent pull evidence mid-interrogation."""
    return {
        "type": "function",
        "name": "retrieve_evidence",
        "description": (
            "Retrieve verbatim quotes from the sales call that support or "
            "contradict a claim. Call this when the rep makes a factual claim "
            "about the call and you want to check it against the transcript."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "A short phrase from the call to search for, "
                    "e.g. 'budget' or 'security sign-off'.",
                    "examples": ["budget", "security sign-off", "procurement"],
                }
            },
            "required": ["query"],
        },
    }


def get_voice_agent_tools() -> list[dict]:
    """Return the Voice Agent tool list exposed on the interrogating agent."""
    return [_transcript_evidence_tool()]


# ---- server-side handlers ---------------------------------------------------

_DIMENSION_HINTS: dict[InterrogationDimension, list[str]] = {
    InterrogationDimension.primary_objection: [
        "objection",
        "concern",
        "hesitation",
        "pricing",
        "budget",
        "security",
        "integration",
        "timing",
    ],
    InterrogationDimension.buyer_decision_maker: [
        "decision",
        "stakeholder",
        "buyer",
        "procurement",
        "champion",
        "budget holder",
    ],
    InterrogationDimension.deal_interest_risk: [
        "interest",
        "risk",
        "urgency",
        "timeline",
        "competitor",
        "evaluation",
    ],
    InterrogationDimension.next_step: [
        "next step",
        "follow up",
        "deadline",
        "send",
        "schedule",
        "agreed",
    ],
}


def execute_tool(
    transcript: Transcript | None,
    *,
    name: str,
    arguments: dict,
    analysis=None,
) -> str:
    """Execute a Voice Agent tool and return a JSON-serializable result string.

    ``name`` is the tool the agent called; ``arguments`` its parsed args. The
    returned string is fed back to the Voice Agent as the ``tool.result``.
    """
    if name == "retrieve_evidence":
        return _retrieve_evidence(transcript, arguments, analysis)
    raise ToolNotFoundError(f"Unknown tool: {name}")


def _retrieve_evidence(
    transcript: Transcript | None, arguments: dict, analysis=None
) -> str:
    if transcript is None:
        return json.dumps({"found": False, "error": "Transcript unavailable."})

    query = str(arguments.get("query", "")).strip()
    if not query:
        return json.dumps({"found": False, "error": "No query provided."})

    items = search_evidence(transcript, query=query, analysis=analysis)
    return json.dumps(
        {
            "found": bool(items),
            "count": len(items),
            "evidence": [
                {
                    "utterance_id": item.utterance_id,
                    "speaker": item.speaker.value,
                    "timestamp": item.timestamp,
                    "text": item.text,
                }
                for item in items
            ],
        }
    )


def dimension_search_hints(dimension: InterrogationDimension) -> list[str]:
    """Return transcript keyword hints for a given interrogation dimension."""
    return _DIMENSION_HINTS.get(dimension, [])
