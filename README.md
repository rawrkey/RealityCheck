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

**Phase 3 — Voice Interrogation & Deal Reality.** The backend can upload a
sales-call audio file, transcribe it with speaker labels (AssemblyAI), run
ground-truth analysis (AssemblyAI LLM Gateway, structured output), and expose
searchable transcript evidence. A rep can now be debriefed after the call by a
live AssemblyAI Voice Agent (or manually in key-less demo mode); their claims
are extracted and aligned against the transcript evidence, and a **Deal
Reality** dashboard shows risk, blind spots, and recommended next actions.

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

## Running a Demo Call

1. Put a short recorded sales call at `data/demo/recorded_call.mp3`
   (wav/mp3/m4a/aac/flac/ogg all supported).
2. Ensure `ASSEMBLYAI_API_KEY` is in `.env`.
3. Start the backend, then upload from the UI, or:
   ```bash
   curl -X POST http://localhost:8000/api/calls \
     -F "file=@data/demo/recorded_call.mp3"
   ```
4. Read the result:
   - `GET /api/calls` — list
   - `GET /api/calls/{id}` — transcript + analysis
   - `GET /api/calls/{id}/evidence?query=security` — evidence search

### Running the debrief (Phase 3)

Once a processed call is ready:

1. From the UI, open the call and click **Run voice interrogation →** (or open
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
| `ASSEMBLYAI_API_KEY` | Backend | Speech-to-text + LLM Gateway + Voice Agent auth |
| `ASSEMBLYAI_BASE_URL` | Backend | Speech-to-text base URL |
| `ASSEMBLYAI_LLM_MODEL` | Backend | Model for analysis (default `gemini-2.5-flash-lite`) |
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

## Future Implementation Phases

- **Phase 4:** Authentication and end-to-end demo workflows.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full pipeline design
and [docs/INTERROGATION.md](docs/INTERROGATION.md) for the Phase 3 Voice
Agent protocol and tool contract.
