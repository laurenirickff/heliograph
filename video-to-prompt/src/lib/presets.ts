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
Placeholder convention: Use angle-bracketed tokens for variable data, e.g., <customer_name>, <customer_email>, <company_domain>, <account_id>, <resource_name>, <date>. Do not invent specific values.
UI text vs data values: Quote exact UI labels and button text; for user-entered or content values, use placeholders unless verbatim values are essential to the demonstrated step.
Demo literals: If the demo shows example content (e.g., a person named "Bob Test"), write instructions using placeholders (e.g., <customer_name>) rather than that literal. Only mention the example as an observation cue if it helps recognition, not as the value to use.
Context-specific literals (beyond customer info): Generalize any instance- or environment-specific values, such as project IDs, ticket numbers, case numbers, run IDs, file names/paths, repository names, hostnames, environment/base URLs, account numbers, invoice numbers, dates/timestamps, and email subjects, unless the literal is clearly stable and necessary.
On-screen values: When a value should be taken from the UI, instruct to use the value "as shown" and where to find it (e.g., "search for the project ID as shown on the details panel header") rather than hard-coding the example (e.g., avoid "search project ID 12345").
Missing or off-screen values: If a required value is not visible or provided, add a step to request it via MCP, naming the exact field(s) needed.

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
Placeholder convention: Use angle-bracketed tokens for variable data, e.g., <customer_name>, <customer_email>, <company_domain>, <account_id>, <resource_name>, <date>. Do not invent specific values.
UI text vs data values: Quote exact UI labels and button text; for user-entered or content values, use placeholders unless verbatim values are essential to the demonstrated step.
Demo literals: If the demo shows example content (e.g., a name like "Bob Test"), generalize to placeholders (e.g., <customer_name>) and avoid hard-coding demo-specific values in actions.
Context-specific literals (beyond customer info): Generalize any instance- or environment-specific values, such as project IDs, ticket numbers, case numbers, run IDs, file names/paths, repository names, hostnames, environment/base URLs, account numbers, invoice numbers, dates/timestamps, and email subjects, unless the literal is clearly stable and necessary.
On-screen values: When the demonstrated step uses a value visible in the UI, instruct to use the value "as shown" and specify where to read it from (e.g., sidebar, header, table row) instead of hard-coding the example.
Missing or off-screen values: If a needed value isn't visible, include an MCP clarification step naming the exact field to request.

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
Placeholder convention: Use angle-bracketed tokens for variable data, e.g., <customer_name>, <customer_email>, <company_domain>, <account_id>, <resource_name>, <date>. Do not invent specific values.
UI text vs data values: Quote exact UI labels and button text; for user-entered or content values, use placeholders unless verbatim values are essential to the demonstrated step.
Demo literals: If demo content shows specific entities (e.g., "Bob Test"), generalize into placeholders. If ambiguity remains about which value to use, include an MCP clarification step specifying what field/value is needed.
Context-specific literals (beyond customer info): Generalize any instance- or environment-specific values, such as project IDs, ticket numbers, case numbers, run IDs, file names/paths, repository names, hostnames, environment/base URLs, account numbers, invoice numbers, dates/timestamps, and email subjects, unless the literal is clearly stable and necessary.
On-screen values: Prefer instructions that reference values "as shown" and where to observe them (e.g., table cell, details pane) rather than hard-coded examples.
Missing or conflicting values: If values are missing or contradictory, pause and request specifics via MCP, listing the exact fields.

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
Placeholder convention: Use angle-bracketed tokens for variable data, e.g., <customer_name>, <customer_email>, <company_domain>, <account_id>, <resource_name>, <date>. Do not invent specific values.
UI text vs data values: Quote exact UI labels and button text; for text inputs, options, and URLs, prefer placeholders unless the literal is essential and stable. Do not hard-code demo example values into the actions.
Context-specific literals (beyond customer info): Generalize any instance- or environment-specific values, such as project IDs, ticket numbers, run IDs, file names/paths, repository names, hostnames, environment/base URLs, account numbers, invoice numbers, dates/timestamps, and email subjects, unless clearly stable and necessary.
On-screen values: When the step uses a value visible in the UI, set the instruction to use the value "as shown" and indicate where to read it, rather than hard-coding the example literal.
Missing values: If a required value isn't shown, add a line to request it (e.g., via MCP) naming the field.

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


