// Default extraction prompts used by both server and client. Keep this file free of
// environment-dependent code so it can be safely imported in the browser.

export const EXTRACTION_PROMPT_STRICT = `
Extract browser automation steps from this workflow video using BOTH visual cues and narration.

You MUST output a pure JSON array (no surrounding prose) where each item matches this schema exactly:
{
  "action": "navigate" | "click" | "type" | "wait" | "verify" | "conditional" | "select",
  "target"?: {
    "description": string,               // human-readable element description
    "visualContext"?: string,            // where it appears on the page (e.g., "top-right toolbar")
    "possibleSelectors"?: string[]       // optional CSS/XPath selectors
  },
  "value"?: string,                      // URL, text to type, or option to select
  "narrationContext"?: string,           // narrator explanation
  "businessLogic"?: string,              // rationale or constraints
  "waitCondition"?: {
    "description"?: string,              // what we wait for
    "visualCue"?: string                  // the visible signal confirming success
  }
}

Strict requirements:
- Use the exact key names above (narrationContext, waitCondition). Do NOT use synonyms like "context", "note", or "waitFor".
- Omit unknown fields entirely rather than using null or empty strings.
- Prefer specific, concise target.description labels (e.g., "Take Action button").
`;

export const EXTRACTION_PROMPT_FLEX = `
Extract browser automation steps from this workflow video using BOTH visual cues and narration.

You MUST output a pure JSON array (no surrounding prose). Be permissive in capturing nuance and ambiguity. For each step, include keys that help downstream tools reason well. Recommended keys (optional, not exhaustive):
{
  "action": string,                       // action label (e.g., navigate, click, type, wait, verify, select, conditional, etc.)
  "target"?: {
    "description"?: string,               // human-readable element description
    "visualContext"?: string,             // e.g., "top-right toolbar"
    "possibleSelectors"?: string[]
  },
  "value"?: string,                       // URL, typed text, or option to select
  "narrationContext"?: string,            // narrator explanation or rationale
  "businessLogic"?: string,               // constraints or reasons
  "waitCondition"?: {
    "description"?: string,
    "visualCue"?: string
  },
  "confidence"?: number,                  // 0..1 confidence (if available)
  "alternatives"?: any[],                 // alternate interpretations
  "notes"?: string,                       // freeform notes, quotes, or uncertainty
  "branches"?: Array<{                    // conditional flows, if any
    "condition": string,
    "steps": any[]
  }>
}

Guidance:
- Keep outputs concise but informative. Use camelCase keys. Avoid nulls/empty strings; omit unknowns instead.
- Ensure the top-level is a JSON array only; do not include markdown or commentary outside the JSON.
`;


