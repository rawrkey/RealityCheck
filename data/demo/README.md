# Demo Data

This folder contains sample sales-call material for local development of the
RealityCheck pipeline: **Ground Truth Analysis** → **Evidence** → **Voice
Interrogation** → **Deal Reality**.

## Providing a demo audio file

RealityCheck processes real audio through the AssemblyAI speech-to-text API.
To run a real demo end-to-end:

1. Put a short sales-call recording here, e.g. `data/demo/recorded_call.mp3`
   (wav/mp3/m4a/aac/flac/ogg are all fine).
2. Set your API key: `cp .env.example .env`, then add your `ASSEMBLYAI_API_KEY`.
3. Start the backend, then upload the file through the UI, or:
   ```bash
   curl -X POST http://localhost:8000/api/calls \
     -F "file=@data/demo/recorded_call.mp3"
   ```
4. Fetch the result:
   - `GET /api/calls` — list calls
   - `GET /api/calls/{id}` — full transcript + analysis
   - `GET /api/calls/{id}/evidence?query=security` — evidence search

## Debriefing the rep (Phase 3)

After the call is processed, run the interrogation from the UI
(**Run voice interrogation →** on the call, or `#/calls/{id}/debrief`):

- With `ASSEMBLYAI_API_KEY` set, the browser connects a live **AssemblyAI Voice
  Agent**, streams the rep's mic audio, and relays `retrieve_evidence` tool
  calls to `POST /api/calls/{id}/interrogation/tool`.
- Without a key, the app falls back to a **manual debrief** form (type the
  rep's answers); claim extraction and Deal Reality use deterministic
  fallbacks, so the whole flow still runs end-to-end.

The output lives under `#/calls/{id}/reality`.

## Notes / security

- **Never commit real customer recordings.** Binary audio under this folder is
  gitignored regardless of name, but please also avoid committing transcripts
  with real names/numbers.
- Processed call JSON is stored under `data/demo/calls/`, which is gitignored.
- The text lines above are guidance, not a fixture pretending to be a
  transcription. We intentionally do **not** ship fake "AI" output; the real
  transcript comes from the AssemblyAI pipeline.

## Frontend fixture (optional)

If you want to mock the frontend without a backend or API key, you can use the
TypeScript types in `apps/web/src/lib/types.ts` as the shape for a local
sample object. Label any such object clearly as a **fixture** in the code.
