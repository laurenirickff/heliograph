# Heliograph

Heliograph turns narrated workflow videos into ready‑to‑use prompts.

It extracts the intent from a short screen recording, then uses a multi‑agent pipeline to propose several candidate prompts and select the best one via ranked‑choice (IRV) voting. The web app lives in `video-to-prompt/`.

## What it does (as a user)

- Upload a short workflow video (MP4/MOV/WebM, ≤500MB)
- Pick a prompt preset (e.g., Browser‑Use MCP) and optionally edit the text shown in the editor
- Optionally adjust Advanced settings:
  - Generators (N): how many independent candidates to produce
  - Deciders (K): how many judges evaluate and rank acceptable candidates
  - Models for generators and deciders
- Click Generate. You will see:
  - Activity stream as the pipeline runs (upload → generators → deciders → aggregation)
  - A summary of decider rankings and average ranks
  - The Best Result (copy/download), plus download buttons for the prompt+result and for all candidates

## How it works (multi‑tier agents)

1) Generators (N)
   - Each generator receives the same uploaded video and the same preset text you edited.
   - They produce N freeform candidate outputs in parallel.

2) Deciders (K)
   - Each decider independently evaluates the candidate set against the original “ASK” (your edited preset text).
   - A decider returns a strict ranking of only the candidates it deems acceptable. Unacceptable candidates are not ranked.

3) IRV aggregation and acceptability
   - We compute acceptability counts (how many deciders ranked each candidate at all).
   - Candidates that reach an acceptability threshold (≥2 deciders) are eligible for Instant‑Runoff Voting.
   - IRV proceeds round‑by‑round until a strict majority is reached; ties are broken deterministically by lowest index when needed.
   - If no candidate is acceptable or no consensus emerges, the app falls back to returning all candidates concatenated so you can review and choose.

4) Observability and downloads
   - A server‑sent event (SSE) activity log streams the pipeline’s progress with generator/decider names and vote snapshots.
   - The UI exposes downloads for the best result, the best result with the ASK, and a complete “all results and prompt” bundle including average rankings.

## Prompt presets (editable)

- Browser‑Use MCP: Goal‑oriented, robust steps suitable for Browser‑Use agents with MCP hand‑offs
- Browser‑Use MCP — Shadowing: Extract the demonstrated end‑to‑end flow from a clean demo
- Browser‑Use MCP — Discovery: Reconcile messy narration/interviews into a primary flow with explicit decision points
- Deterministic UI Steps (AirTop): Click‑by‑click deterministic instructions for stable workflows with strong visual cues

These presets are just text. The exact content you see in the editor is what is sent to the model.

## API surface

- POST `/api/analyze` (multipart/form-data)
  - Fields: `video` (File), `preset`, `promptText`, `generators`, `deciders`, `generatorModel`, `deciderModel`, `temperature`, `maxOutputTokens`, `runId`
  - Behavior:
    - If no advanced fields provided, runs a single‑shot generation.
    - Otherwise runs the N‑generator / K‑decider pipeline with IRV aggregation and returns:
      - `prompt` (best or concatenated fallback), `meta`, `candidates`, `generatorNames`, `averageRankings`
- GET `/api/logs/[runId]/stream` (SSE): live activity events for the UI’s activity panel
- POST `/api/logs/[runId]/emit` (dev‑only): emit a test event in development
- GET `/api/healthcheck`: returns 200 OK

## Limits and requirements

- Video formats: MP4, MOV, WebM
- Max size: 500MB
- Google Gemini Files API is used; you must provide `GEMINI_API_KEY`.

## Quickstart

```bash
# Enter the app directory
cd video-to-prompt

# Install dependencies
npm install

# Configure environment
cp env.example .env.local
# then set GEMINI_API_KEY in .env.local

# Run in development
npm run dev
# Open http://localhost:3000
```

## Environment
Create a `.env.local` file in `video-to-prompt/` with:

```
GEMINI_API_KEY=your_api_key
```

Obtain a key from Google AI Studio.

## Healthcheck

`GET /api/healthcheck` returns 200 OK.

## Dev Runbook

### Clean restart on port 3000

```bash
# From the repo root
cd video-to-prompt

# Kill anything on 3000 and any lingering Next dev processes
(lsof -ti tcp:3000 || true) | xargs -r kill -9; pkill -f "next dev" || true; pkill -f "/node .*next" || true

# Start dev server
npm run dev
```

- If port 3000 is busy, Next.js will start on the next available port (e.g., 3001). Use the printed URL.
- You can also set a specific port: `PORT=3001 npm run dev`.

### Activity log SSE (dev diagnostics)

Stream events for a given `runId`:

```bash
curl -sN http://localhost:3000/api/logs/test-run/stream | head -n 10 | cat
```

Emit a test event (dev-only endpoint; returns 404 in production):

```bash
curl -s -X POST "http://localhost:3000/api/logs/test-run/emit" \
  -H "Content-Type: application/json" \
  -d '{
    "phase": "generators",
    "type": "start",
    "message": "dev emit test",
    "data": { "N": 3, "model": "gemini-2.5-flash", "generators": ["strict", "flex", "shadow"] }
  }'
```

Open a second terminal for the stream while emitting to observe events.

## Notes

- Copy to clipboard and download as .txt for both the best result and the full bundle
- Dark/light theme toggle and responsive layout for quick review

---

For app source and additional docs, see `video-to-prompt/`.
