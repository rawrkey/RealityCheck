# RealityCheck Architecture

RealityCheck is an AI voice sales manager that debriefs sales reps after a
call, challenges their interpretation of the call against the transcript
evidence, detects blind spots, and produces a **"Deal Reality"** view.

The core idea:

> "Your salesperson thinks the deal went well. Our AI proves whether they're right."

## High-Level Pipeline

```
Original Sales Call
        │
        ▼
    Speech-to-Text
        │
        ▼
  Ground Truth Analysis
        │
        ▼
   Voice Interrogation
        │
        ▼
   Evidence Retrieval
        │
        ▼
     Deal Reality
        │
        ▼
  Coaching / Next Actions
```

## Stage Details

| Stage | Description | Status |
| --- | --- | --- |
| **Original Sales Call** | A recorded audio of a sales call (uploaded by the rep or pulled via the CRM). | **Implemented (upload)** |
| **Speech-to-Text** | Transcribe the call audio into a timestamped, speaker-labeled transcript. | **Implemented** – via **AssemblyAI** (`server/services/assemblyai/`). |
| **Ground Truth Analysis** | Extract factual points: participants, objections, buyer signals, stakeholders, commitments, next steps, budget, timeline, competition. | **Implemented** – `server/services/analysis/`. |
| **Voice Interrogation** | A Voice Agent debriefs the rep right after the call and captures their claims across four dimensions. | **Implemented (Phase 3)** – `server/services/interrogation/` + `server/services/voice_agent/`. |
| **Evidence Retrieval** | Pull specific quotes/timestamps that support or contradict claims. | **Implemented** – `server/services/evidence/` and as a live tool for the agent (`server/services/voice_agent/tools.py`). |
| **Deal Reality** | Present the aligned view: what the rep believed, what the evidence shows, whether they align, and the resulting deal risk. | **Implemented (Phase 3)** – `server/services/interrogation/`. |
| **Coaching / Next Actions** | Recommend concrete next actions for the rep and deal. | **Implemented (lightweight)** – recommendations inside the Deal Reality. |

## Repository Layout

```
realitycheck/
├── apps/
│   └── web/            # React + TypeScript + Vite frontend
├── server/
│   ├── api/routes/     # One module per resource
│   ├── services/
│   │   ├── assemblyai/ # Speech-to-text (AssemblyAI SDK)
│   │   ├── analysis/   # Ground-truth extraction (LLM Gateway + prompt)
│   │   ├── evidence/   # Evidence retrieval
│   │   ├── calls/      # Call pipeline orchestration
│   │   ├── interrogation/ # Phase 3: sessions, claims, alignment, Deal Reality
│   │   ├── voice_agent/   # Phase 3: Voice Agent token, session config, tools
│   │   ├── storage/    # Local JSON-file call store
│   │   └── json_schema.py # Strict JSON Schema builder (shared by prompts)
│   └── main.py         # FastAPI app entrypoint
├── shared/schemas/     # Shared Pydantic domain types
├── data/demo/          # Sample call recordings (audio gitignored)
└── docs/               # Architecture & project docs
```

## Design Principles

- **Frontend and backend run independently.** The only contract between them
  is the HTTP API (see `shared/schemas/` and the `VITE_API_BASE_URL` env var).
- **`server/api` stays thin.** Route modules only wire HTTP concerns; business
  logic lives in `server/services/*`, keeping `main.py` small.
- **No fake AI.** External calls hit the real AssemblyAI SDK and LLM Gateway.
  Nothing fabricates model output. Services are injectable only so tests can
  mock the network.
- **AssemblyAI stays isolated.** Only `server/services/assemblyai/` touches the
  SDK; it returns the internal `Transcript` model.
- **Monorepo-friendly packaging.** Python and JS tooling are isolated per app.

## The pipeline (Phase 2)

On upload, `server/services/calls/pipeline.py` orchestrates:

1. `uploaded` → persist source audio + empty `CallRecord`.
2. `transcribing` → `transcribe_audio(bytes) -> Transcript` (AssemblyAI, speaker
   labels enabled, normalized to `Speaker` enum + `utt_####` ids).
3. `analyzing` → `analyze_transcript(Transcript) -> GroundTruthAnalysis`
   (AssemblyAI LLM Gateway, strict JSON schema, evidence refs validated).
4. `ready` → persist the finished `CallRecord`.

Any failure transitions the record to `failed` with a human-readable
`error_message`; no credentials or stack traces are sent to the client.

### Internal transcript representation

`Transcript { id, duration_seconds, language, utterances[], full_text }` with
`Utterance { id, speaker (SPEAKER_A | SPEAKER_B | ...), start_ms, end_ms, text }`.

### Ground-truth analysis

The pipeline distinguishes:
1. **What was actually said** (transcript).
2. **What the AI can reasonably infer** (structured `GroundTruthAnalysis`,
   including the `initial_ground_truth_assessment`).
3. **What the salesperson later claims** (Phase 3 rep claims from the debrief).

Every extracted fact carries `evidence_utterance_ids` pointing back to the
transcript. `server/services/evidence/` turns those ids (or keyword queries)
into `EvidenceItem`s the UI can render as "why does the AI believe this?".

## Phase 3: Voice Interrogation & Deal Reality

The debrief is a short Voice Agent call with the rep *before* they see any
evidence. The agent asks 4–7 questions across four dimensions (**primary
objection**, **buyer / decision-maker**, **deal interest & risk**, **next
step**), then the pipeline aligns each claim against the ground truth.

A high-level sequence:

```
Rep dashboard          Browser (React)               Backend                  AssemblyAI
     │      start interrogation ──► POST /interrogation/session ►
     │                       ◄────── session id + config ───────┤
     │            GET /interrogation/config ◄── mint Voice Agent token (server-side only)
     │  ◄────────────── token (short-lived) + session.update payload ────┘
     │  connect Voice Agent WebSocket ─────────────────────────►
     │  stream microphone audio ── input.audio ─────────────────►
     │  ◄── transcript.user / transcript.agent / tool.call ─────┘
     │        tool.call ────► POST /interrogation/tool (relay) ─► retrieve_evidence(transcript)
     │        ◄──────────── tool.result (JSON string) ──────────┘
     │  tool.result ──► (drained on reply.done)
     │  session.end ──►
     │  POST /interrogation/debrief {messages} ──► extract claims → align vs ground truth
     │                       ◄──────── alignment results + session ──┐
     │  GET /debrief  ──►                                          │
     │  POST /interrogation/reality ──► build Deal Reality ◄────────┘
     │  GET /reality ──►  summary, risk, blind spots, recommendations
```

### Why client-side function tools

Tool logic (`retrieve_evidence`) runs **server-side in our backend**, not in
the browser and not as an AssemblyAI HTTP tool. The permanent API key never
reaches the browser; the agent emits `tool.call` over the WebSocket, the
browser relays it to `POST /api/calls/{id}/interrogation/tool`, and the
browser sends `tool.result` back once `reply.done` is the latest event. See
`docs/INTERROGATION.md` for the full protocol notes.

### Without an API key (demo mode)

Claim extraction and Deal Reality have deterministic fallbacks when the LLM
Gateway is unavailable, so the whole flow can run end-to-end in a test or demo
environment. The frontend also offers a manual "type the rep's answers" mode
when no Voice Agent token can be minted.

## What Is Implemented (Phase 2)

- `POST /api/calls`, `GET /api/calls`, `GET /api/calls/{id}`,
  `GET /api/calls/{id}/transcript`, `GET /api/calls/{id}/evidence`.
- AssemblyAI speech-to-text with speaker labels → internal `Transcript`.
- Ground-truth analysis via AssemblyAI LLM Gateway with a strict, versioned
  JSON schema and a versioned prompt.
- Local JSON-file store under `data/demo/calls/` (swappable storage abstraction).
- Evidence retrieval by keyword, analysis item id, and utterance id(s).
- Frontend demo flow: upload → status → transcript → ground truth with
  reveal-evidence boxes.

## What Is Implemented (Phase 3)

- `POST /{call_id}/interrogation/session`, `GET /{call_id}/interrogation/session`.
- `POST /{call_id}/interrogation/debrief`, `GET /{call_id}/debrief`.
- `GET /{call_id}/interrogation/alignment`, `POST /{call_id}/interrogation/align`.
- `GET/{POST} /{call_id}/interrogation/reality`, `GET /{call_id}/reality`.
- `GET /{call_id}/interrogation/config` (short-lived Voice Agent token +
  `session.update` payload).
- `POST /{call_id}/interrogation/tool` (server-side execution of the agent's
  `retrieve_evidence` tool).
- Voice Agent session persistence (`{call_id}.interrogation.json`) and Deal
  Reality persistence (`{call_id}.reality.json`).
- Deterministic fallbacks (claim extraction + Deal Reality) for key-less demos.
- Frontend pages: `/calls/:id/debrief` (live Voice Agent or manual debrief →
  claims vs evidence) and `/calls/:id/reality` (Deal Reality dashboard).

## Future Phases

- **Phase 4:** User accounts / authentication and end-to-end demo workflows.
