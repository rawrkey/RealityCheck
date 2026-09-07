# Voice Interrogation & Deal Reality

Phase 3 adds the debrief loop: right after a call, a Voice Agent asks the rep
how *they* read the conversation, we extract their claims, and we align each
claim against the ground-truth evidence captured for the original call. The
result is a **Deal Reality**: how much the rep's perception matches what
actually happened, which blind spots exist, and what to do next.

End-to-end flow and UI are described in `docs/ARCHITECTURE.md`; this document
is the protocol + contract reference for implementers.

## Dimensions (fixed set)

Every debrief surveys exactly four dimensions:

| Dimension | Rep is asked about |
| --- | --- |
| `primary_objection` | What the rep thinks the buyer's main objection was. |
| `buyer_decision_maker` | Who the buyer is, their role, and who decides. |
| `deal_interest_risk` | How the rep reads interest, urgency, and deal risks. |
| `next_step` | What the rep thinks was agreed, by whom, and when. |

## Session lifecycle

1. **`POST /api/calls/{id}/interrogation/session`** creates (or returns) the
   `InterrogationSession` with the system prompt, the four dimensions, an empty
   message log, and status `created`. Idempotent.
2. The rep is debriefed (live Voice Agent call or manual entry).
3. **`POST /api/calls/{id}/interrogation/debrief`** records the conversation
   as `InterrogationMessage`s, builds a role-labeled debrief `Transcript`
   (agent = `SPEAKER_B`, rep = `SPEAKER_A`), extracts `RepClaim`s, and computes
   `ClaimAlignment`s. Session status becomes `completed`.
4. **`POST /api/calls/{id}/interrogation/reality`** synthesizes the
   `DealReality` and persists it; `GET /api/calls/{id}/reality` returns the
   stored copy.

Sessions and realities persist as `{call_id}.interrogation.json` and
`{call_id}.reality.json` next to the call in the storage dir.

## Voice Agent wiring

The AssemblyAI Voice Agent API runs over a WebSocket. The permanent
`ASSEMBLYAI_API_KEY` stays server-side.

1. `server/services/voice_agent/service.py` mints a short-lived token:
   `GET /v1/token?expires_in_seconds=<ttl>` (default 300 s). `GET /api/calls/{id}/interrogation/config` returns it plus the assembled `session.update` payload.
2. The browser connects a WebSocket to
   `wss://agents.assemblyai.com/voice-agent?token=<token>` (the `?token=` query
   is used because a browser `WebSocket` cannot set the `Authorization` header).
3. The browser immediately sends the `session.update` message returned by the
   config endpoint (system prompt, tools, greeting).
4. The agent emits events:
   - `transcript.user` → the rep's final utterance (`role: "rep"`).
   - `transcript.agent` → the agent's complete reply (`role: "agent"`).
   - `tool.call` → `{ call_id, name, arguments }` (arguments is a dict).
   - `reply.done` → drain any accumulated `tool.result`s now.
   - `session.ended` → clean teardown after `session.end` is sent.

### Tool contract (client-side function tool)

`retrieve_evidence` is declared inline in `session.tools` as a function tool.
Its logic runs **server-side**, relayed through the browser:

- Agent sends `tool.call { call_id, name: "retrieve_evidence", arguments: { query } }`.
- Browser calls `POST /api/calls/{id}/interrogation/tool` with `{ name, arguments }`.
- Backend (`server/services/voice_agent/tools.py`) runs `execute_tool(...)`,
  keyword-matching the original call transcript (optionally biased toward a
  dimension via `dimension_search_hints`), and returns a JSON string result.
- Browser sends `tool.result` only when `reply.done` is the latest event:
  `{ "type": "tool.result", "call_id", "result": "<json string>", "is_error": bool }`.
  On `reply.done` with `status: "interrupted"`, pending results are dropped.

### Mic streaming

The browser streams `input.audio` (base64 PCM16, mono 24 kHz) after
`session.ready`. `apps/web/src/lib/voiceAgent.ts` is a complete self-contained
implementation of this contract.

## Claim extraction

`server/services/interrogation/service.py::extract_claims` runs the debrief
transcript through the LLM Gateway against a strict `ClaimExtraction` JSON
schema, then `_normalize_claims` assigns stable ids (`claim_001`, …), clamps
`rep_confidence` to `[0, 1]`, drops claims whose evidence refs don't exist in
the debrief transcript, and de-dupes per dimension.

**Deterministic fallback:** when the LLM Gateway is unavailable (e.g. no
`ASSEMBLYAI_API_KEY`), `_extract_claims_deterministic` pairs each rep answer
with the preceding agent question and maps it to a dimension by keyword
overlap (question terms weighted 2×). This keeps the demo and tests fully
functional without credentials.

## Alignment

`server/services/interrogation/align.py` is **deterministic** (no LLM):

- Each dimension maps to specific `GroundTruthAnalysis` attributes
  (objections, stakeholders/participants, interest/risk assessment, next
  steps/commitments, …).
- A claim's text is tokenized and compared (Dice coefficient on token overlap)
  against each candidate analysis item's description; threshold 0.2.
- Verdicts: `aligned` (evidence matches), `misaligned` (evidence contradicts),
  `unsupported` (no evidence found).
- `ClaimAlignment.transcript_evidence` resolves matching analysis items back to
  concrete `EvidenceItem`s from the call transcript; `matched_analysis_ids`
  lists the item ids.

## Deal Reality

`build_deal_reality` produces the `DealReality`:

- `summary` — LLM synthesis (with deterministic fallback template).
- `alignment_score` = aligned / total; `risk_level` is `high` if any claim is
  misaligned, `low` if fully aligned, else `medium`.
- `blind_spots` — gaps between rep claims and evidence (max 6, evidence-anchored).
- `recommendations` — prioritized next actions (max 5); critical when a
  high-risk misalignment exists, e.g. re-verifying the buyer's interest when
  the rep claims interest the transcript doesn't support.

## API surface

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/calls/{id}/interrogation/session` | Current session or 404 |
| POST | `/api/calls/{id}/interrogation/session` | Create/reuse session |
| POST | `/api/calls/{id}/interrogation/debrief` | Record debrief, extract + align claims |
| GET | `/api/calls/{id}/debrief` | Session + alignments |
| GET | `/api/calls/{id}/interrogation/alignment` | Alignments only |
| POST | `/api/calls/{id}/interrogation/align` | Force re-alignment |
| POST | `/api/calls/{id}/interrogation/reality` | Build (and persist) Deal Reality |
| GET | `/api/calls/{id}/reality` | Stored Deal Reality |
| GET | `/api/calls/{id}/interrogation/config` | Voice Agent token + session.update |
| POST | `/api/calls/{id}/interrogation/tool` | Run an agent tool server-side |

Note: `GET /interrogation/config` returns `502` when `ASSEMBLYAI_API_KEY` is
unset (no token can be minted). The frontend then falls back to the manual
debrief mode. Everything else works key-less via the deterministic fallbacks.

## Testing

- `tests/test_interrogation_service.py` — service layer (sessions, claims,
  alignment, reality) with the LLM Gateway mocked and the store redirected to a
  tmp dir.
- `tests/test_interrogation_api.py` — route layer via `TestClient`.
- Deterministic (key-less) paths are exercised directly; the LLM path is tested
  by faking `chat_structured` to return canonical claim JSON.