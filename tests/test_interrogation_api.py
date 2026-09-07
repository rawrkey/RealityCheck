"""API behavior for the voice interrogation, debrief, and Deal Reality flow."""

import json

import pytest

GATEWAY = "server.services.analysis.llm_gateway.chat_structured"
SERVICE = "server.services.interrogation.service"
ROUTES = "server.api.routes.interrogation"


def _claims_json() -> str:
    return json.dumps(
        {
            "claims": [
                {
                    "id": "",
                    "dimension": "primary_objection",
                    "question": "What was the buyer's main objection?",
                    "claim": "The main objection was security sign-off taking a few weeks.",
                    "rep_confidence": 0.8,
                    "evidence_utterance_ids": ["debrief_utt_0002"],
                },
                {
                    "id": "",
                    "dimension": "buyer_decision_maker",
                    "question": "Who was the decision maker?",
                    "claim": "The buyer was Sarah in procurement and is the decision maker.",
                    "rep_confidence": 0.6,
                    "evidence_utterance_ids": ["debrief_utt_0004"],
                },
                {
                    "id": "",
                    "dimension": "deal_interest_risk",
                    "question": "How did the deal look?",
                    "claim": "The buyer seemed interested and engaged with the follow-up.",
                    "rep_confidence": 0.7,
                    "evidence_utterance_ids": ["debrief_utt_0006"],
                },
                {
                    "id": "",
                    "dimension": "next_step",
                    "question": "What's the next step?",
                    "claim": "We agreed to send the security documentation tomorrow.",
                    "rep_confidence": 0.9,
                    "evidence_utterance_ids": ["debrief_utt_0008"],
                },
            ]
        }
    )


@pytest.fixture
def debrief_messages() -> list[dict]:
    return [
        {"role": "agent", "text": "What was the buyer's main objection?"},
        {"role": "rep", "text": "The main objection was security sign-off taking a few weeks."},
        {"role": "agent", "text": "Who was the decision maker?"},
        {"role": "rep", "text": "Sarah in procurement, but I believe the buyer is the decision maker."},
        {"role": "agent", "text": "How did the deal look?"},
        {"role": "rep", "text": "They were pretty interested and engaged with the follow-up."},
        {"role": "agent", "text": "What's the next step?"},
        {"role": "rep", "text": "We agreed to send the security documentation tomorrow."},
    ]


@pytest.fixture
def wired_interrogation(
    client, stored_call, tmp_call_store, monkeypatch
) -> dict:
    """Store wired to the tmp store + claim extraction LLM mocked."""
    monkeypatch.setattr(f"{ROUTES}.get_call_store", lambda: tmp_call_store)
    monkeypatch.setattr(f"{SERVICE}.get_call_store", lambda: tmp_call_store)
    monkeypatch.setattr(GATEWAY, lambda **kwargs: _claims_json())
    return {"call_id": stored_call.id}


def test_full_interrogation_flow(client, wired_interrogation, debrief_messages) -> None:
    call_id = wired_interrogation["call_id"]

    session = client.post(f"/api/calls/{call_id}/interrogation/session")
    assert session.status_code == 201
    body = session.json()
    assert len(body["dimensions"]) == 4
    assert body["status"] == "created"

    # Creating again returns the same (idempotent).
    again = client.post(f"/api/calls/{call_id}/interrogation/session")
    assert again.json()["id"] == body["id"]

    debrief = client.post(
        f"/api/calls/{call_id}/interrogation/debrief",
        json={"messages": debrief_messages},
    )
    assert debrief.status_code == 200
    payload = debrief.json()
    assert payload["session"]["status"] == "completed"
    assert len(payload["session"]["claims"]) == 4
    assert len(payload["alignments"]) == 4
    assert all(a["verdict"] == "aligned" for a in payload["alignments"])

    fetched = client.get(f"/api/calls/{call_id}/debrief")
    assert fetched.status_code == 200
    assert fetched.json()["session"]["id"] == body["id"]
    assert len(fetched.json()["alignments"]) == 4

    alignment = client.get(f"/api/calls/{call_id}/interrogation/alignment")
    assert alignment.status_code == 200
    assert alignment.json()[0]["claim_id"] == "claim_001"

    reality = client.post(f"/api/calls/{call_id}/interrogation/reality")
    assert reality.status_code == 200
    r = reality.json()
    assert r["aligned_count"] == 4 and r["total_count"] == 4
    assert r["alignment_score"] == 1.0
    assert r["risk_level"] == "low"
    assert r["blind_spots"] == []

    fetched_reality = client.get(f"/api/calls/{call_id}/reality")
    assert fetched_reality.status_code == 200
    assert fetched_reality.json()["summary"] == r["summary"]


def test_debrief_requires_session(client, wired_interrogation) -> None:
    response = client.get(f"/api/calls/{wired_interrogation['call_id']}/debrief")
    assert response.status_code == 404
    assert "no interrogation session" in response.json()["detail"].lower()


def test_reality_requires_existing_call(client, wired_interrogation) -> None:
    assert client.get("/api/calls/missing/reality").status_code == 404


def test_reality_without_claims_builds_medium(client, wired_interrogation) -> None:
    call_id = wired_interrogation["call_id"]
    client.post(f"/api/calls/{call_id}/interrogation/session")
    reality = client.post(f"/api/calls/{call_id}/interrogation/reality")
    assert reality.status_code == 200
    assert reality.json()["total_count"] == 0
    assert reality.json()["risk_level"] == "medium"


def test_config_endpoint_returns_token_and_session(
    client, wired_interrogation, monkeypatch
) -> None:
    monkeypatch.setattr(
        f"{ROUTES}.mint_voice_agent_token", lambda **kwargs: "short.lived.token"
    )
    call_id = wired_interrogation["call_id"]
    client.post(f"/api/calls/{call_id}/interrogation/session")

    response = client.get(f"/api/calls/{call_id}/interrogation/config")
    assert response.status_code == 200
    payload = response.json()
    assert payload["token"] == "short.lived.token"
    assert "agents.assemblyai.com" in payload["websocket_url"]
    assert "system_prompt" in payload["session"]["session"]
    assert payload["session"]["session"]["tools"][0]["name"] == "retrieve_evidence"
    assert payload["session"]["session"]["greeting"]


def test_config_fails_without_api_key(client, wired_interrogation) -> None:
    call_id = wired_interrogation["call_id"]
    client.post(f"/api/calls/{call_id}/interrogation/session")
    response = client.get(f"/api/calls/{call_id}/interrogation/config")
    assert response.status_code == 502


def test_tool_relay_executes_evidence_search(client, wired_interrogation) -> None:
    call_id = wired_interrogation["call_id"]
    response = client.post(
        f"/api/calls/{call_id}/interrogation/tool",
        json={"name": "retrieve_evidence", "arguments": {"query": "procurement"}},
    )
    assert response.status_code == 200
    result = json.loads(response.json()["result"])
    assert result["found"] is True
    assert result["count"] == 1
    assert result["evidence"][0]["utterance_id"] == "utt_0004"


def test_tool_relay_unknown_tool(client, wired_interrogation) -> None:
    call_id = wired_interrogation["call_id"]
    response = client.post(
        f"/api/calls/{call_id}/interrogation/tool",
        json={"name": "nope", "arguments": {}},
    )
    assert response.status_code == 400
    assert "Unknown tool" in response.json()["detail"]


def test_schema_for_tools_is_function_type(client, wired_interrogation) -> None:
    call_id = wired_interrogation["call_id"]
    client.post(f"/api/calls/{call_id}/interrogation/session")
    from server.services.voice_agent import get_voice_agent_tools

    tools = get_voice_agent_tools()
    assert tools[0]["type"] == "function"
    assert tools[0]["parameters"]["type"] == "object"
    assert "required" in tools[0]["parameters"]