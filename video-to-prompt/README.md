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

## Notes

- Supports MP4, MOV, WebM up to 100MB
- Two prompt presets: Browser‑Use MCP and AirTop (fully editable)
- Copy to clipboard and Download as .txt
- Uses Gemini 2.5 Flash via Files API (requires `GEMINI_API_KEY`)

## Usage

1) Select a prompt preset (Browser‑Use MCP or AirTop)
2) Edit the preset text as you like (this is the exact text sent to the model)
3) Upload a video (MP4/MOV/WebM, ≤100MB)
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
