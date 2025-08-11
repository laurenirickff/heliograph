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

// --------------------
// Decider prompt and builder
// --------------------

export const DECIDER_PROMPT = `You are an evaluator. You do NOT have access to the video. Judge multiple candidate outputs generated from the same video and the same instructions (the ASK).

Your tasks:
1) Ranked-choice (IRV) ballot: Provide a strict ranked list of ONLY acceptable candidates, best to worst.
2) Diagnostics: For each candidate, list brief strengths/issues that reference the ASK when applicable.

Key definitions:
- Acceptable: materially adheres to the ASK, covers the important items emphasized by the ASK, contains no major contradictions with the ASK, and is internally consistent. Minor stylistic differences are fine.
- Unacceptable: misses a clearly important requirement from the ASK; contradicts itself or the ASK; introduces instructions the ASK did not authorize; fabricates constraints not present in the ASK; largely off-topic.
- Ambiguity handling: When the ASK is ambiguous, prefer candidates that make reasonable, clearly stated interpretations without contradicting the ASK. Do not invent facts beyond what a reasonable reading of the ASK permits.
- Cross-candidate consistency: Differences in style/ordering are irrelevant. Flag only material conflicts on ASK must-haves.

Inputs:
- ASK (exact instructions shown to generators):
<<<ASK_START
ORIGINAL_PROMPT_TEXT
ASK_END>>>

- Candidates (free-form). Indexing starts at 0:
<<<CANDIDATES_START
CANDIDATES_BLOCKS
CANDIDATES_END>>>

Voting rules (ranked-choice / IRV compliant):
- Do NOT rank any candidate you consider unacceptable.
- If acceptable candidates exist:
  - Include ALL acceptable indices in the ranking as a strict, tie-free order (best to worst).

Output format (STRICT JSON; no prose outside JSON):
{
  "ranking": number[],
  "perCandidate": Array<{
    "index": number,
    "strengths": string[],
    "issues": string[]
  }>
}

Constraints:
- Return ONLY valid JSON matching the schema. No markdown or explanations outside JSON.
- Keep strengths/issues concise and reference ASK phrases where useful (e.g., "covers ASK: '...'", "misses ASK: '...'").
- Judge based on the ASK and the candidate texts only; do not infer unseen video details.`;

export function buildDeciderPrompt(originalPrompt: string, candidates: Array<{ index: number; text: string }>): string {
  const ask = originalPrompt;
  const blocks = candidates
    .map((c) => `[` + c.index + `]\n` + c.text)
    .join("\n\n");
  return DECIDER_PROMPT.replace("ORIGINAL_PROMPT_TEXT", ask).replace("CANDIDATES_BLOCKS", blocks);
}


