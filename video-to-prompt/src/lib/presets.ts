// High-level, prompt-only presets for generating tool-ready instructions
// directly from a workflow video. These are sent verbatim to the model
// alongside the attached video.

export type PromptPresetKey = "browser-use" | "airtop";

export const BROWSER_USE_PRESET = `
You will watch a workflow video and produce a concise, executable prompt fragment for a generic Browser-Use agent.

Output format: Markdown only.
- Use '###' headings exactly: "### Goal", "### Steps", "### Stop conditions", "### Error handling".
- Under "### Steps", write a numbered list (1., 2., 3., …). No JSON, no code fences.
- When a step requires interaction, structure it with bold labels within the list item:
  - **Observe**: <what to look for>
    - Include a clear visual description of the target using this pattern: <role> '<visible text>' in the <page region> near '<landmark>' (icon: <icon if any>, color: <color if distinctive>). Add one distinguishing detail if there are similar elements.
  - **Act**: <what to do>
  - **Verify**: <what success looks like>
- Prefer descriptive element labels and visual context; add selector hints only if reliable.
- Include gate handling (cookie/consent, login) only if shown or clearly necessary.
- Stay within the shown domain(s); avoid destructive/financial actions unless explicitly shown.

If a required input is missing (e.g., credentials), include a step that halts and states what is needed.

Example shape:

### Goal
<one sentence summary>

### Steps
1. <plain step or>
   - **Observe**: ...
     - Visual: <e.g., Button 'Submit' in the top-right toolbar near the user avatar (icon: paper plane, color: blue)>
   - **Act**: ...
   - **Verify**: ...
2. ...

### Stop conditions
- Success criteria met
- Limits reached (e.g., no new results twice)

### Error handling
If any step fails or an error appears, stop and report the step number and the exact on-screen message.
`;

export const AIRTOP_PRESET = `
You will watch a workflow video and produce AirTop-compatible action blocks that an operator can follow.

Output requirements:
- For each step, write a compact block with fields, separated by a line containing only --- between steps.
- Fields to use when applicable (omit unknowns):
  action: <navigate|click|type|select|wait|verify|conditional>
  selector: <CSS/XPath if reliable>
  fallback: <concise element description if selector is missing or brittle>
  url/value/option: <depending on action>
  wait_for: <visual cue or condition>
  timeout: <milliseconds, 3000–10000 typical>
  # <optional brief comment or business constraint>

Style:
- Plain text only. No JSON, no code fences, no headings.
- Prefer reliable selectors; otherwise provide a fallback description.
- Include waits for transitions where needed with realistic timeouts.
`;

export function getPresetText(key: PromptPresetKey): string {
  switch (key) {
    case "airtop":
      return AIRTOP_PRESET.trim();
    case "browser-use":
    default:
      return BROWSER_USE_PRESET.trim();
  }
}


