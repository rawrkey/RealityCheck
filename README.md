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

**Phase 2 — Ground Truth pipeline.** The backend can now upload a sales-call
audio file, transcribe it with speaker labels (AssemblyAI), run ground-truth
analysis (AssemblyAI LLM Gateway, structured output), and expose searchable
transcript evidence. A working demo flow exists in the frontend. Voice
interrogation and the Deal Reality view are Phase 3.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Speech-to-Text | AssemblyAI |
| Analysis LLM | AssemblyAI LLM Gateway (OpenAI-compatible) |

## Repository Structure

```
realitycheck/
├── apps/
│   └── web/            # React + TypeScript + Vite frontend
├── server/
│   ├── api/routes/     # FastAPI route modules (calls, health)
│   ├── services/
│   │   ├── assemblyai/ # Speech-to-text (AssemblyAI SDK)
│   │   ├── analysis/   # Ground-truth extraction (LLM Gateway + prompt)
│   │   ├── evidence/   # Evidence retrieval
│   │   ├── calls/      # Call pipeline orchestration
│   │   └── storage/    # Local JSON-file call store
│   ├── main.py         # FastAPI app entrypoint
│   └── config.py       # Environment/config via pydantic-settings
├── shared/
│   └── schemas/        # Shared Pydantic domain types
├── data/
│   └── demo/           # Sample call recordings (audio gitignored)
├── docs/
│   └── ARCHITECTURE.md # High-level pipeline architecture
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

## API Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness probe |
| POST | `/api/calls` | Upload + process a call (multipart `file`) |
| GET | `/api/calls` | List calls (lightweight) |
| GET | `/api/calls/{id}` | Full processed call |
| GET | `/api/calls/{id}/transcript` | Normalized transcript |
| GET | `/api/calls/{id}/evidence` | Evidence by `query` / `analysis_item_id` / `utterance_id` |

## Environment Variables

Copy `.env.example` to `.env` (backend) or `apps/web/.env.local` (frontend)
and edit as needed. **Never commit real API keys.**

| Variable | Where | Purpose |
| --- | --- | --- |
| `PORT` | Backend | Port the API listens on (default 8000) |
| `CORS_ORIGINS` | Backend | Allowed frontend origins, comma-separated |
| `ASSEMBLYAI_API_KEY` | Backend | Speech-to-text + LLM Gateway auth |
| `ASSEMBLYAI_BASE_URL` | Backend | Speech-to-text base URL |
| `ASSEMBLYAI_LLM_MODEL` | Backend | Model for analysis (default `gemini-2.5-flash-lite`) |
| `ASSEMBLYAI_LLM_BASE_URL` | Backend | LLM Gateway base URL |
| `ASSEMBLYAI_LLM_MAX_TOKENS` | Backend | Analysis max output tokens |
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

- **Phase 3:** **Voice Interrogation** (capture the rep's claims after the
  call), **Deal Reality** (perception vs evidence alignment + deal risk), and
  evidence-anchored coaching/next-action recommendations.
- **Phase 4:** Authentication and end-to-end demo workflows.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full pipeline design.
