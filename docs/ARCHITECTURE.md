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
| **Original Sales Call** | A recorded audio of a sales call (uploaded by the rep or pulled via the CRM). | **Planned / Future** |
| **Speech-to-Text** | Transcribe the call audio into a timestamped transcript. | **Planned / Future** – will use the **AssemblyAI** integration (`server/services/assemblyai/`). |
| **Ground Truth Analysis** | Analyze the transcript to extract factual points: commitments, objections, next steps, budget, timeline, decision makers. | **Planned / Future** – `server/services/analysis/`. |
| **Voice Interrogation** | Challenge the rep's interpretation by comparing their claims against the evidence and asking pointed questions. | **Planned / Future** – `server/services/analysis/`. |
| **Evidence Retrieval** | Pull specific quotes/timestamps from the transcript that support or contradict the rep's beliefs. | **Planned / Future** – `server/services/evidence/`. |
| **Deal Reality** | Present the aligned view: what the rep believed, what the evidence shows, whether they align, and the resulting deal risk. | **Planned / Future**. |
| **Coaching / Next Actions** | Recommend concrete next actions for the rep and deal. | **Planned / Future**. |

## Repository Layout

```
realitycheck/
├── apps/
│   └── web/            # React + TypeScript + Vite frontend
├── server/
│   ├── api/            # FastAPI route definitions (thin layer)
│   │   └── routes/     # One module per resource
│   ├── services/       # Business logic (AI, STT, analysis)
│   │   ├── assemblyai/ # Planned: speech-to-text
│   │   ├── analysis/   # Planned: ground truth / interrogation
│   │   └── evidence/   # Planned: evidence retrieval
│   └── main.py         # FastAPI app entrypoint
├── shared/
│   └── schemas/        # Shared Pydantic domain types
├── data/demo/          # Sample call recordings/transcripts
└── docs/               # Architecture & project docs
```

## Design Principles

- **Frontend and backend run independently.** The only contract between them
  is the HTTP API (see `shared/schemas/` and the `VITE_API_BASE_URL` env var).
- **`server/api` stays thin.** Route modules only wire HTTP concerns; business
  logic lives in `server/services/*`, keeping `main.py` small.
- **No fake AI.** Services that are not yet built raise clearly and are marked
  **Planned / Future**; nothing in Phase 1 pretends to do AI.
- **Monorepo-friendly packaging.** Python and JS tooling are isolated per app.

## What Is Implemented (Phase 1)

- Backend FastAPI app with a `GET /health` endpoint.
- Frontend React/Vite shell with a landing page and a "Start a Demo" CTA.
- Directory scaffolding and shared schema placeholders.
- All AI / evidence / AssemblyAI stages are **not** implemented yet.

## Future Phases

- **Phase 2:** AssemblyAI speech-to-text, transcript ingestion, and the
  analysis/interrogation pipeline.
- **Phase 3:** Deal Reality view, evidence retrieval UI, coaching
  recommendations, and the full product data model in `shared/schemas/`.
- **Phase 4:** User accounts / authentication and demo workflows.
