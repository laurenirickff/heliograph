// Default extraction prompts used by both server and client. Keep this file free of
// environment-dependent code so it can be safely imported in the browser.

export const EXTRACTION_PROMPT_STRICT = `
Extract browser automation steps from this workflow video using BOTH visual cues and narration.

Context: The recording comes from a specific customer/project. Generalize context-specific identifiers and values into neutral placeholders or role-based references unless the literal value is clearly required to complete the workflow. This includes not only customer details, but also project IDs, ticket/case numbers, run IDs, repository names, file names/paths, hostnames, environment/base URLs, account/invoice numbers, dates/timestamps, and email subjects.
Placeholder convention: Use angle-bracketed tokens for variable data (e.g., <customer_name>, <customer_email>, <company_domain>, <account_id>, <project_id>, <ticket_number>, <resource_name>, <date>) instead of hard-coded example values seen in the video. Do not invent specific values.
UI text vs data values: Quote exact UI labels and button text; for user-entered or content values, use placeholders unless verbatim values are essential and explicitly required by the step.
On-screen values: When a value should be taken from the UI, instruct to use the value "as shown" and specify where to read it (e.g., "use the project ID as shown in the header of the details panel") rather than copying the example literal (e.g., avoid "project ID 12345").

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
 - Generalize context-specific values in fields like value, narrationContext, and businessLogic to placeholders (e.g., <project_id>, <account_id>, <customer_email>) unless a literal value is explicitly necessary. When a value should be read from the UI, indicate "as shown" and where to read it.
`;

export const EXTRACTION_PROMPT_FLEX = `
Extract browser automation steps from this workflow video using BOTH visual cues and narration.

Context: The recording comes from a specific customer/project. Generalize any context-specific identifiers and values (customer details, project IDs, ticket/case numbers, run IDs, repository names, file names/paths, hostnames, environment/base URLs, account/invoice numbers, dates/timestamps, email subjects) into neutral placeholders or role-based references unless the literal value is clearly required.
Placeholder convention: Use angle-bracketed tokens for variable data (e.g., <customer_name>, <customer_email>, <company_domain>, <account_id>, <project_id>, <ticket_number>, <resource_name>, <date>) instead of hard-coded example values. Do not invent specific values.
UI text vs data values: Quote exact UI labels and button text; for user-entered or content values, use placeholders unless verbatim values are essential and explicitly required by the step.
On-screen values: When a value is visible in the UI, specify to use the value "as shown" and where to read it, rather than hard-coding the example value.

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
 - When including example text or values, generalize any context-specific details to placeholders (e.g., <project_id>, <account_id>, <customer_email>) unless the literal value is essential to achieve the demonstrated outcome. Prefer instructions that reference values "as shown" and the location to read them from.
`;

// --------------------
// Evaluator prompt and builder
// --------------------

export const EVALUATOR_PROMPT = `You are an evaluator. You do NOT have access to the video. Judge multiple candidate outputs generated from the same video and the same instructions (the ASK).

Your tasks:
1) Ranked-choice (IRV) ballot: Provide a strict ranked list of ONLY acceptable candidates, best to worst.
2) Diagnostics: For each candidate, list brief strengths/issues that reference the ASK when applicable.

Key definitions:
- Acceptable: materially adheres to the ASK, covers the important items emphasized by the ASK, contains no major contradictions with the ASK, and is internally consistent. Minor stylistic differences are fine.
- Unacceptable: misses a clearly important requirement from the ASK; contradicts itself or the ASK; introduces instructions the ASK did not authorize; fabricates constraints not present in the ASK; largely off-topic; or is a material outlier versus other candidates in a way that is not supported by the ASK.
- Ambiguity handling: When the ASK is ambiguous, prefer candidates that make reasonable, clearly stated interpretations without contradicting the ASK. Do not invent facts beyond what a reasonable reading of the ASK permits.

Cross-candidate consistency rules:
- Compare each candidate not only to the ASK but also to the other candidates. Exact matches are NOT expected. Differences in tone, ordering, naming, and formatting are irrelevant.
- Red flag (addition): If a candidate introduces a material step/fact/constraint that is NOT supported by the ASK and is NOT present in most other candidates, treat it as likely fabricated and mark the candidate unacceptable unless there is clear ASK support.
- Red flag (omission): If a candidate omits a material element that the ASK requires, or that appears in most other candidates and is compatible with the ASK, treat that omission as a serious issue likely rendering the candidate unacceptable.
- Consensus as signal, not ground truth: Use cross-candidate agreement as a reliability signal to detect outliers, but the ASK remains the source of truth. Accept genuine alternative interpretations only when consistent with the ASK.

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
  - Exclude any candidate that triggers a cross-candidate red flag (fabricated-looking addition or omission of a material element) unless the ASK clearly permits that divergence.

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
- When relevant, note cross-candidate observations in issues (e.g., "cross-candidate: only this candidate adds 'X'", "cross-candidate: omits step present in most others").
- Judge based on the ASK and the candidate texts only; do not infer unseen video details.`;

export function buildEvaluatorPrompt(originalPrompt: string, candidates: Array<{ index: number; text: string }>): string {
  const ask = originalPrompt;
  const blocks = candidates
    .map((c) => `[` + c.index + `]\n` + c.text)
    .join("\n\n");
  return EVALUATOR_PROMPT.replace("ORIGINAL_PROMPT_TEXT", ask).replace("CANDIDATES_BLOCKS", blocks);
}


