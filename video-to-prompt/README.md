Heliograph turns narrated workflow videos into ready‑to‑use prompts using a simple, preset‑driven flow.

## Setup

1) Install dependencies

```bash
npm install
```

2) Configure API key

Create `.env.local` in the project root with:

```
GEMINI_API_KEY=your_api_key
```

Obtain a key from Google AI Studio.

3) Develop

```bash
npm run dev
```

Open http://localhost:3000

## Healthcheck

`GET /api/healthcheck` returns 200 OK.

## Dev runbook

### Clean restart on port 3000

```bash
# Kill anything on 3000 and any lingering Next dev processes
(lsof -ti tcp:3000 || true) | xargs -r kill -9; pkill -f "next dev" || true; pkill -f "/node .*next" || true

# Start dev server
npm run dev
```

- If port 3000 is busy, Next.js will start on the next available port (e.g., 3001). Use the printed URL.
- You can also set a specific port: `PORT=3001 npm run dev`.

### Healthcheck

```bash
curl -sSf http://localhost:3000/api/healthcheck
```

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

- Supports MP4, MOV, WebM up to 500MB
- Two prompt presets: Browser‑Use MCP and AirTop (fully editable)
- Copy to clipboard and Download as .txt
- Uses Gemini 2.5 Flash via Files API (requires `GEMINI_API_KEY`)

## Usage

1) Select a prompt preset (Browser‑Use MCP or AirTop)
2) Edit the preset text as you like (this is the exact text sent to the model)
3) Upload a video (MP4/MOV/WebM, ≤500MB)
4) Receive the generated prompt text and copy or download it

## Goals

- Build a simple, elegant tool that turns workflow videos into strong, ready‑to‑use prompts across multiple AI tools.
- Provide curated presets that work out‑of‑the‑box, while keeping full prompt editability.
- Keep the request clear and auditable: what you see in the editor is exactly what is sent.

## What Users Get

- Tool‑ready outputs via curated presets (no deterministic formatter pipeline).
- A single editable prompt that controls everything, with minimal UI friction.
- The ability to fully override the preset when needed.

## Guiding Principles

- Influence the cause, not the symptom: strong presets and prompt copy guide outcomes.
- Simple first: minimal controls, maximal clarity.
- Robustness: always return a useful prompt and surface any errors clearly.
