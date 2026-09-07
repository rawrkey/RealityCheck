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
| **Voice Interrogation** | Challenge the rep's interpretation by comparing their claims against the evidence and asking pointed questions. | **Planned / Future** – `server/services/analysis/`. |
| **Evidence Retrieval** | Pull specific quotes/timestamps that support or contradict claims. | **Implemented** – `server/services/evidence/`. |
| **Deal Reality** | Present the aligned view: what the rep believed, what the evidence shows, whether they align, and the resulting deal risk. | **Planned / Future**. |
| **Coaching / Next Actions** | Recommend concrete next actions for the rep and deal. | **Planned / Future**. |

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
│   │   └── storage/    # Local JSON-file call store
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
3. **What the salesperson later claims** — **Phase 3**, not built yet.

Every extracted fact carries `evidence_utterance_ids` pointing back to the
transcript. `server/services/evidence/` turns those ids (or keyword queries)
into `EvidenceItem`s the UI can render as "why does the AI believe this?".

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

## Future Phases

- **Phase 3:** Voice Interrogation (capture the rep's claims), **Deal Reality**
  view (perception vs evidence alignment, deal risk), and evidence-anchored
  coaching/next-action recommendations.
- **Phase 4:** User accounts / authentication and end-to-end demo workflows.
