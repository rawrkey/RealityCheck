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

**Phase 1 — Project foundation.** Directory structure, runnable frontend and
backend shells, health endpoint, and documentation. No AI functionality is
implemented yet; AI stages are explicitly marked as **planned / future**.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Speech-to-Text | AssemblyAI (planned, not implemented) |

## Repository Structure

```
realitycheck/
├── apps/
│   └── web/            # React + TypeScript + Vite frontend
├── server/
│   ├── api/routes/     # FastAPI route modules
│   ├── services/       # Business logic (AI, STT, analysis, evidence)
│   ├── main.py         # FastAPI app entrypoint
│   └── ...
├── shared/
│   └── schemas/        # Shared Pydantic domain types
├── data/
│   └── demo/           # Sample call recordings/transcripts (placeholders)
├── docs/
│   └── ARCHITECTURE.md # High-level pipeline architecture
├── .env.example
├── .gitignore
└── pyproject.toml      # Python backend dependencies (uv)
```

## Local Setup

### Prerequisites

- **Node.js** 20+ and npm
- **Python** 3.11+
- [uv](https://docs.astral.sh/uv/) (recommended for Python dependencies)

### Backend

```bash
# From the repository root
uv sync                      # install dependencies into a virtualenv
cp .env.example .env         # configure environment (optional in dev)
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

## Environment Variables

Copy `.env.example` to `.env` (backend) or `apps/web/.env.local` (frontend)
and edit as needed. **Never commit real API keys.**

| Variable | Where | Purpose |
| --- | --- | --- |
| `PORT` | Backend | Port the API listens on (default 8000) |
| `CORS_ORIGINS` | Backend | Allowed frontend origins, comma-separated |
| `VITE_API_BASE_URL` | Frontend | Base URL of the backend API |
| `ASSEMBLYAI_API_KEY` | Backend | Planned for Phase 2 — not used yet |

## Useful Commands

```bash
# Backend
uv run uvicorn server.main:app --reload      # run dev server

# Frontend
cd apps/web
npm run dev        # dev server
npm run build      # type-check + production build
npm run lint       # lint with oxlint
```

## Future Implementation Phases

- **Phase 2:** AssemblyAI **speech-to-text**, transcript ingestion, and the
  **ground-truth analysis** / **voice interrogation** pipeline.
- **Phase 3:** **Deal Reality** view, **evidence retrieval** UI, coaching
  recommendations, and the full product data model.
- **Phase 4:** Authentication and end-to-end demo workflows.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full pipeline design.
