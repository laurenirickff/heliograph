// High-level, prompt-only presets for generating tool-ready instructions
// directly from a workflow video. These are sent verbatim to the model
// alongside the attached video.

export type PromptPresetKey =
  | "browser-use"
  | "browser-use-shadowing"
  | "browser-use-discovery"
  | "airtop";

export const TEMPLATE_INFO: Record<PromptPresetKey, { label: string; description: string }> = {
  "browser-use": {
    label: "Browser-Use MCP",
    description: "General web workflow automation with clear steps for Browser-Use agents.",
  },
  "browser-use-shadowing": {
    label: "Browser-Use MCP — Shadowing",
    description: "Extract clean, goal-oriented steps from a demo where the workflow is performed end-to-end.",
  },
  "browser-use-discovery": {
    label: "Browser-Use MCP — Discovery",
    description: "Synthesize a canonical flow from messy interview-style videos; handle contradictions and branching.",
  },
  airtop: {
    label: "Deterministic UI Steps",
    description: "Precise, click-by-click instructions for stable workflows with strong visual cues and explicit waits.",
  },
};

export const BROWSER_USE_PRESET = `
You will watch a workflow video recorded for a specific customer/project and produce a concise, goal-oriented sub-prompt fragment for an agent that uses a Browser-Use tool and can request human help via MCP. The result will be embedded inside a larger agent prompt, so keep it self-contained and focused on the workflow shown.

Generalization policy: Replace customer-specific identifiers (e.g., names, emails, domains, company names, account IDs) with neutral placeholders or role-based references. Prefer wording like "search the customer's name" instead of a specific name, unless the literal value is clearly required to complete the workflow.

Output format: Markdown only.
- Use '###' headings exactly: "### Goal", "### Steps", "### Stop conditions", "### Error handling".
- Under "### Steps", write a numbered list (1., 2., 3., …). No JSON, no code fences.
- Steps must be goal-oriented and robust to UI variation. Prefer descriptive visuals and outcomes over brittle, pixel-perfect clicks.
- Include gate handling (cookie/consent, login) only if shown or clearly necessary.
- Stay within the shown domain(s); avoid destructive/financial actions unless explicitly demonstrated.

Guidance for each step:
- Use the following bold labels within a step as needed:
  - **Subgoal**: <the immediate objective of this step>
  - **Observe**: <what to look for>
    - Visual: <role> '<visible text>' in the <page region> near '<landmark>' (icon: <icon if any>, color: <color if distinctive>). Add one distinguishing detail if there are similar elements.
  - **Act**: <what to do; avoid fragile selectors; keep actions resilient>
  - **Decision**: <brief branching logic if paths diverge; specify cues for which branch to take>
  - **If uncertain**: Ask the human via MCP for clarification; provide a concise summary of options and what you need to proceed.
  - **Verify**: <success cues or result to confirm before moving on>

Data or credentials:
- If a required input is missing (e.g., login details), include a step that halts and states exactly what is needed.
 - When referring to customer data, use generalized placeholders unless the exact literal is essential.

Example shape:

### Goal
<one sentence summary of the workflow’s end-state>

### Steps
1. <plain step or>
   - **Subgoal**: ...
   - **Observe**: ...
     - Visual: <e.g., Button 'Submit' in the top-right toolbar near the user avatar (icon: paper plane, color: blue)>
   - **Act**: ...
   - **Decision**: If <cue A>, do X; if <cue B>, do Y.
   - **If uncertain**: Ask the human via MCP with a brief clarifying question and pause.
   - **Verify**: ...
2. ...

### Stop conditions
- Success criteria met (state the final observable outcome)
- Repeated ambiguity or inconsistent cues after 2 attempts — pause and request human guidance via MCP

### Error handling
If any step fails or an error appears, stop and report the step number and the exact on-screen message. If recovery is reasonable (retry, refresh, navigate back), suggest it; otherwise request human guidance via MCP.
`;

export const BROWSER_USE_SHADOW_PRESET = `
You will watch a workflow video, recorded for a specific customer/project, where someone cleanly demonstrates the workflow end-to-end (possibly narrating). Produce a concise, goal-oriented sub-prompt fragment for an agent that uses a Browser-Use tool and can request human help via MCP. Focus on what was actually demonstrated; avoid inventing steps.

Generalization policy: Replace customer-specific identifiers (e.g., names, emails, domains, company names, account IDs) with neutral placeholders or role-based references unless the literal value is clearly required.

Output format: Markdown only.
- Use '###' headings exactly: "### Goal", "### Steps", "### Stop conditions", "### Error handling".
- Under "### Steps", write a numbered list (1., 2., 3., …). No JSON, no code fences.
- Steps must be goal-oriented and robust to UI variation. Prefer descriptive visuals and outcomes over pixel-perfect clicks.
- Capture optional paths only if explicitly shown; otherwise keep to the demonstrated path.
- Stay within the shown domain(s); avoid destructive/financial actions unless explicitly demonstrated.

Guidance for each step:
- Use these bold labels as needed:
  - **Subgoal**: <immediate objective>
  - **Observe**: <what to look for>
    - Visual: <role> '<visible text>' in the <page region> near '<landmark>' (icon: <icon if any>, color: <color if distinctive>)
  - **Act**: <what to do; resilient phrasing>
  - **Decision**: <branching only if it appears in the video>
  - **If uncertain**: Ask the human via MCP and pause
  - **Verify**: <success cue>

Data or credentials:
- If required inputs are missing, include a step that halts and states exactly what is needed.
 - When referring to customer data, use generalized placeholders unless the exact literal is essential.

### Goal
<one sentence summary of the workflow’s end-state>

### Steps
1. <as above>
2. ...

### Stop conditions
- Success criteria met
- Missing info or unclear UI — request human guidance via MCP

### Error handling
On errors, report the step and exact on-screen message; retry simple recoveries (refresh/back) if appropriate, otherwise request human help via MCP.
`;

export const BROWSER_USE_DISCOVERY_PRESET = `
You will watch a discovery-style video (e.g., interviews, messy narration, multiple speakers) recorded for a specific customer/project. Extract a clear, goal-oriented sub-prompt fragment for an agent that uses a Browser-Use tool and can request human help via MCP. Expect contradictions, incomplete details, and multiple branching paths; reconcile them into a primary flow with explicit decision points and fallbacks.

Generalization policy: Replace customer-specific identifiers (e.g., names, emails, domains, company names, account IDs) with neutral placeholders or role-based references unless the literal value is necessary to reach the shown outcome.

Output format: Markdown only.
- Use '###' headings exactly: "### Goal", "### Steps", "### Stop conditions", "### Error handling".
- Under "### Steps", write a numbered list (1., 2., 3., …). No JSON, no code fences.
- Steps must be robust to ambiguity and UI variation. Identify cues that disambiguate branches and explicitly state when to escalate to a human.
- Capture assumptions only when necessary and keep them minimal and testable.

Guidance for each step:
- Use these bold labels as needed:
  - **Subgoal**: <immediate objective>
  - **Observe**: <cues that help choose paths>
    - Visual: <role> '<visible text>' in the <page region> near '<landmark>' (icon: <icon>, color: <color>)
  - **Act**: <resilient action>
  - **Decision**: If <cue A>, take path X; if <cue B>, take path Y. Note what to do if neither cue appears.
  - **If uncertain**: Summarize the ambiguity and ask the human via MCP; pause.
  - **Verify**: <success cue or checkpoint>

Data or credentials:
- If critical inputs are missing or conflicting, pause and request human input via MCP, listing the exact fields you need.
 - When referring to customer data, use generalized placeholders unless the exact literal is essential.

### Goal
<concise description of the desired end-state, including any constraints mentioned>

### Steps
1. <as above>
2. ...

### Stop conditions
- Success criteria met
- Conflicting instructions or unresolved ambiguity after 2 attempts — escalate via MCP and pause

### Error handling
If any step fails or contradictory states are detected, report the step and message, propose a safe recovery if clear, otherwise request human guidance via MCP.
`;

export const AIRTOP_PRESET = `
You will watch a workflow video recorded for a specific customer/project and produce precise, deterministic, click-by-click instructions suitable for automation or human operators. Assume the workflow is stable and unambiguous; prefer explicit targets and outcomes over general guidance.

Generalization policy: Replace customer-specific identifiers (e.g., names, emails, domains, company names, account IDs) with neutral placeholders or role-based references, unless the literal value is clearly necessary to perform the demonstrated step.

Output requirements:
- For each step, write a compact block with fields, separated by a line containing only --- between steps.
- Fields to use when applicable (omit unknowns):
  action: <navigate|click|type|select|wait|verify>
  visual: <role> '<visible text>' in the <region> near '<landmark>' (icon: <icon>, color: <color>)
  selector: <CSS/XPath if reliable>
  url/value/option: <depending on action>
  wait_for: <explicit visual cue or condition>
  timeout: <milliseconds, 3000–10000 typical>
  # <optional brief note or constraint>

Style:
- Plain text only. No JSON, no code fences, no headings.
- Be specific and consistent. Use exact labels/text shown on screen, include strong visual cues, and prefer reliable selectors when available.
- Include necessary waits for transitions with realistic timeouts.
  - When citing data values, prefer placeholders for customer-specific details unless the exact literal is essential to the step.
`;

export function getPresetText(key: PromptPresetKey): string {
  switch (key) {
    case "airtop":
      return AIRTOP_PRESET.trim();
    case "browser-use-shadowing":
      return BROWSER_USE_SHADOW_PRESET.trim();
    case "browser-use-discovery":
      return BROWSER_USE_DISCOVERY_PRESET.trim();
    case "browser-use":
    default:
      return BROWSER_USE_PRESET.trim();
  }
}


