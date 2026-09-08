# RealityCheck

**AI voice sales manager that challenges your sales call.**

Your salesperson thinks the deal went well. Our AI proves whether they're
right.

RealityCheck debriefs a rep after a call: it transcribes the conversation,
challenges the rep's interpretation against the transcript evidence, detects
blind spots, and produces a **"Deal Reality"** view showing what the rep
believed, what the evidence shows, whether they align, the resulting deal risk,
and recommended next actions.

> This is **not** a generic CRM, meeting summarizer, or chatbot.

## Current Status

**Phase 5C — Live provider path + guaranteed demo.** RealityCheck ships with
**two valid paths**:

- **Path A — Instant demo (no API key).** A bundled, deterministic sample call
  (`demo-nova-onboarding`) renders instantly: Transcript → Ground Truth →
  Debrief → Deal Reality. This works with zero external dependencies and is the
  guaranteed presentation path.
- **Path B — Live analysis (API key).** A real upload is transcribed with
  AssemblyAI (speech models `universal-3-5-pro` → `universal-2`, speaker
  labels), analyzed by the AssemblyAI LLM Gateway (`gemini-2.5-flash-lite`,
  with a cross-provider fallback), and flows through Ground Truth → Voice
  Debrief → Deal Reality exactly like the sample.

Both paths share the same domain schema, evidence linking, debrief, and Deal
Reality pipeline. The sample is always labeled **Sample**; real uploads are
labeled **Live analysis**.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Speech-to-Text | AssemblyAI |
| Analysis LLM | AssemblyAI LLM Gateway (OpenAI-compatible) |
| Voice Interrogation | AssemblyAI Voice Agent API (WebSocket) |

## Repository Structure

```
realitycheck/
├── apps/
│   └── web/            # React + TypeScript + Vite frontend
├── server/
│   ├── api/routes/     # FastAPI route modules (calls, interrogation, health)
│   ├── services/
│   │   ├── assemblyai/ # Speech-to-text (AssemblyAI SDK)
│   │   ├── analysis/   # Ground-truth extraction (LLM Gateway + prompt)
│   │   ├── evidence/   # Evidence retrieval
│   │   ├── interrogation/ # Phase 3: sessions, claims, alignment, Deal Reality
│   │   ├── voice_agent/   # Phase 3: Voice Agent token, session config, tools
│   │   ├── calls/      # Call pipeline orchestration
│   │   ├── storage/    # Local JSON-file call store
│   │   └── json_schema.py # Strict JSON Schema builder (shared by prompts)
│   ├── main.py         # FastAPI app entrypoint
│   └── config.py       # Environment/config via pydantic-settings
├── shared/
│   └── schemas/        # Shared Pydantic domain types
├── data/
│   └── demo/           # Sample call recordings (audio gitignored)
├── docs/
│   ├── ARCHITECTURE.md # High-level pipeline architecture
│   └── INTERROGATION.md # Phase 3 protocol + tool contract reference
├── tests/              # Backend tests (pytest)
├── .env.example
├── .gitignore
└── pyproject.toml      # Python backend dependencies (uv)
```

## Local Setup

### Prerequisites

- **Node.js** 20+ and npm
- **Python** 3.11+
- [uv](https://docs.astral.sh/uv/) (recommended for Python dependencies)
- An **AssemblyAI API key** (for real transcription + analysis)

### Backend

```bash
# From the repository root
uv sync                                   # install dependencies
cp .env.example .env                      # then add your ASSEMBLYAI_API_KEY
uv run uvicorn server.main:app --reload
```

The API runs at <http://localhost:8000>. Verify it's up:

```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

Interactive API docs are available at <http://localhost:8000/docs>.

### Frontend

```bash
# From the repository root
cd apps/web
npm install
cp .env.example .env.local   # optional; defaults to http://localhost:8000
npm run dev
```

The app runs at <http://localhost:5173>.

## Two Ways to Use RealityCheck

### Quick Demo (no API key required)

The bundled sample call is deterministic local data — it needs no AssemblyAI
key, no network, no microphone, and no upload.

1. Start the backend and frontend (above).
2. On the landing page click **Start Demo** (or, on the Calls page, **Load
   sample call**).
3. Click through the sample's **Transcript → Ground Truth → Debrief → Deal
   Reality**. The call is labeled **Sample** and the Calls page shows
   **Sample mode** until a key is configured.

### Live Analysis (requires `ASSEMBLYAI_API_KEY`)

This path proves the real provider pipeline: upload → AssemblyAI transcription
→ LLM Gateway analysis → Ground Truth → Debrief → Deal Reality.

1. Put `ASSEMBLYAI_API_KEY` in `.env`.
2. Start the backend and frontend.
3. On the Calls page click **Analyze a call** and pick a recorded call
   (wav/mp3/m4a/mp4/mov/aac/flac/ogg/webm/wma). The Calls page shows
   **Live analysis available** when a key is configured.
4. The upload is transcribed (`universal-3-5-pro` → `universal-2`, speaker
   labels), analyzed by the LLM Gateway (`gemini-2.5-flash-lite` by default),
   and the call is labeled **Live analysis**.
5. Run the debrief (voice or typed) and open **Deal Reality**.

> The sample demo never touches the provider pipeline and never disables it:
> both paths work side by side. Live analysis needs the AssemblyAI account's
> plan to include LLM Gateway model inference (transcription and Voice Agent
> are included with a standard key; Gateway inference can be plan-gated). If
> Analysis is denied, the upload fails honestly with `status=failed` and a
> client-safe `error_message` — it is never faked or silently downgraded.

### Running the debrief (Phase 3)

Once a processed call is ready:

1. From the UI, open the call and click **Start Debrief →** (or open
   `#/calls/{id}/debrief`).
2. If `ASSEMBLYAI_API_KEY` is set, the browser connects a live **AssemblyAI
   Voice Agent** WebSocket, streams the mic, relays `retrieve_evidence` tool
   calls to the backend, and records the rep's answers. Without a key, a
   **manual debrief** form collects the rep's answers instead — the rest of the
   pipeline (claim extraction, alignment, Deal Reality) is identical and uses
   deterministic fallbacks.
3. After the debrief, claims are aligned against the evidence; open
   `#/calls/{id}/reality` for the **Deal Reality** dashboard.

See [docs/INTERROGATION.md](docs/INTERROGATION.md) for the Voice Agent protocol
and tool contract.

## API Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness probe |
| POST | `/api/calls` | Upload + process a call (multipart `file`) |
| GET | `/api/calls` | List calls (lightweight) |
| GET | `/api/calls/provider-status` | Live-provider capability probe (no secrets) |
| POST | `/api/calls/demo` | Seed the deterministic sample call (idempotent) |
| GET | `/api/calls/{id}` | Full processed call |
| GET | `/api/calls/{id}/transcript` | Normalized transcript |
| GET | `/api/calls/{id}/evidence` | Evidence by `query` / `analysis_item_id` / `utterance_id` |
| GET | `/api/calls/{id}/interrogation/session` | Current interrogation session |
| POST | `/api/calls/{id}/interrogation/session` | Create/reuse interrogation session |
| POST | `/api/calls/{id}/interrogation/debrief` | Record debrief, extract + align claims |
| GET | `/api/calls/{id}/debrief` | Consolidated debrief (session + alignments) |
| GET | `/api/calls/{id}/interrogation/alignment` | Claim alignments |
| POST | `/api/calls/{id}/interrogation/reality` | Build (and persist) Deal Reality |
| GET | `/api/calls/{id}/reality` | Stored Deal Reality |
| GET | `/api/calls/{id}/interrogation/config` | Voice Agent token + session config |
| POST | `/api/calls/{id}/interrogation/tool` | Run an agent tool server-side |

## Environment Variables

Copy `.env.example` to `.env` (backend) or `apps/web/.env.local` (frontend)
and edit as needed. **Never commit real API keys.**

| Variable | Where | Purpose |
| --- | --- | --- |
| `PORT` | Backend | Port the API listens on (default 8000) |
| `CORS_ORIGINS` | Backend | Allowed frontend origins, comma-separated |
| `ASSEMBLYAI_API_KEY` | Backend | Speech-to-text + LLM Gateway + Voice Agent auth. **Required only for Live Analysis / voice.** Without it the app runs in sample mode. |
| `ASSEMBLYAI_BASE_URL` | Backend | Speech-to-text base URL |
| `ASSEMBLYAI_LLM_MODEL` | Backend | Model for analysis (default `gemini-2.5-flash-lite`) |
| `ASSEMBLYAI_LLM_FALLBACK_MODEL` | Backend | Cross-provider fallback (default `claude-sonnet-4-6`; empty disables) |
| `ASSEMBLYAI_LLM_BASE_URL` | Backend | LLM Gateway base URL |
| `ASSEMBLYAI_LLM_MAX_TOKENS` | Backend | Analysis max output tokens |
| `VOICE_AGENT_BASE_URL` | Backend | Voice Agent token minting base URL |
| `VOICE_AGENT_WS_URL` | Backend | Voice Agent WebSocket endpoint |
| `VOICE_AGENT_TOKEN_TTL_SECONDS` | Backend | Minted Voice Agent token TTL |
| `CALL_STORAGE_DIR` | Backend | Local call JSON store location |
| `VITE_API_BASE_URL` | Frontend | Base URL of the backend API |

## Useful Commands

```bash
# Backend
uv run uvicorn server.main:app --reload      # run dev server
uv run pytest -q                             # run backend tests

# Frontend
cd apps/web
npm run dev        # dev server
npm run build      # type-check + production build
npm run lint       # lint with oxlint
```

## Phase Status

- **Phases 1–3:** Upload → transcription → ground truth → debrief → Deal
  Reality (voice + typed), evidence linking.
- **Phase 4:** Call detail UI (transcript, ground truth, evidence).
- **Phase 5A/5B:** accessibility/honesty hardening; deterministic demo call.
- **Phase 5C:** real live-analysis path (LLM Gateway model config, cross-provider
  fallback, explicit speech models) alongside the keyless sample demo.
- **Next:** Phase 6 demo engineering.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full pipeline design
and [docs/INTERROGATION.md](docs/INTERROGATION.md) for the Voice Agent
protocol and tool contract.
