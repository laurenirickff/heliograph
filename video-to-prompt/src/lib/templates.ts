import { Action } from "./types";

export type FormatterOptions = {
  addErrorHandlingFooter?: boolean;
  includeVisualContext?: boolean;
  mergeMicroSteps?: boolean;
};

function mergeAdjacentMicroSteps(actions: Action[]): Action[] {
  if (!actions.length) return actions;
  const merged: Action[] = [];
  for (const action of actions) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      ((prev.action === "click" && action.action === "wait") || (prev.action === "type" && action.action === "wait")) &&
      !action.value && !action.businessLogic
    ) {
      // drop standalone trivial wait after click/type
      continue;
    }
    merged.push(action);
  }
  return merged;
}

export function formatBrowserUse(actions: Action[], opts: FormatterOptions = {}): string {
  const effective = opts.mergeMicroSteps ? mergeAdjacentMicroSteps(actions) : actions;
  const intro = "You are automating a workflow in our web application. Follow these steps carefully:\n\n";

  const steps = effective
    .map((action, index) => {
      const stepNumber = index + 1;
      let instruction = "";

      switch (action.action) {
        case "navigate":
          {
            const url = safeInline(action.value) || "the target URL";
            const narration = neutralizeNarration(safeInline(action.narrationContext));
            instruction = `${stepNumber}. Navigate to ${url}.${narration ? ` Context: ${narration}.` : ""}`;
          }
          break;
        case "click":
          {
            const label = sanitizeForQuotes(safeInline(action.target?.description)) || "the element";
            const visual = opts.includeVisualContext ? sanitizeForQuotes(safeInline(action.target?.visualContext)) : undefined;
            const narration = neutralizeNarration(safeInline(action.narrationContext));
            instruction = `${stepNumber}. ${visual ? `Click the '${label}' in the '${visual}'.` : `Click the '${label}'.`}` +
              `${narration ? ` Context: ${narration}.` : ""}` +
              `${formatSelectorsHint(action.target?.possibleSelectors)}`;
          }
          break;
        case "type":
          {
            const field = sanitizeForQuotes(safeInline(action.target?.description)) || "the field";
            const val = sanitizeForQuotes(safeInline(action.value)) || "the required text";
            const visual = opts.includeVisualContext ? sanitizeForQuotes(safeInline(action.target?.visualContext)) : undefined;
            const business = trimTrailingPunctuation(safeInline(action.businessLogic));
            instruction = `${stepNumber}. ${visual ? `Type '${val}' into the '${field}' in the '${visual}', exactly as shown.` : `Type '${val}' into the '${field}', exactly as shown.`}` +
              `${business ? ` ${business}.` : ""}` +
              `${formatSelectorsHint(action.target?.possibleSelectors)}`;
          }
          break;
        case "wait":
          {
            const desc = safeInline(action.waitCondition?.description) || "the expected condition";
            instruction = `${stepNumber}. Wait for ${desc}.` +
              `${action.waitCondition?.visualCue ? ` You should see ${safeInline(action.waitCondition.visualCue)}.` : ""}` +
              ` Do not proceed until this validation is complete.`;
          }
          break;
        case "verify":
          {
            const what = safeInline(action.target?.description) || "the expected information is correct";
            instruction = `${stepNumber}. Verify that ${what}.` +
              `${action.waitCondition?.visualCue ? ` Look for: ${safeInline(action.waitCondition.visualCue)}.` : ""}` +
              ` Do not proceed until validated.`;
          }
          break;
        case "select":
          {
            const option = sanitizeForQuotes(safeInline(action.value)) || "the appropriate option";
            const from = sanitizeForQuotes(safeInline(action.target?.description)) || "the dropdown";
            const visual = opts.includeVisualContext ? sanitizeForQuotes(safeInline(action.target?.visualContext)) : undefined;
            instruction = `${stepNumber}. ${visual ? `Select the '${option}' option from the '${from}' in the '${visual}'.` : `Select the '${option}' option from the '${from}'.`}` +
              `${formatSelectorsHint(action.target?.possibleSelectors)}`;
          }
          break;
        case "conditional":
          instruction = `${stepNumber}. If applicable: ${neutralizeNarration(safeInline(action.narrationContext)) || "follow the conditional logic described."}`;
          break;
      }

      return instruction;
    })
    .join("\n\n");

  const errorHandling = opts.addErrorHandlingFooter !== false
    ? "\n\nImportant: If any step fails or shows an error (red text, error message, or unexpected behavior), stop and report the specific error message and which step failed."
    : "";

  return intro + steps + errorHandling;
}

export function formatAirTop(actions: Action[], _opts: FormatterOptions = {}): string {
  const metadata = actions[0]?.narrationContext
    ? `# Task Context\n${actions[0].narrationContext}\n\n---\n`
    : "";

  const steps = actions
    .map((action) => {
      const lines: string[] = [`action: ${action.action}`];

      if (action.target?.possibleSelectors?.length) {
        lines.push(`selector: ${action.target.possibleSelectors.join(", ")}`);
        lines.push(`fallback: ${action.target.description}`);
      }

      if (action.value) {
        if (action.action === "navigate") {
          lines.push(`url: ${action.value}`);
        } else if (action.action === "type") {
          lines.push(`value: ${action.value}`);
          lines.push(`clear_first: true`);
        } else if (action.action === "select") {
          lines.push(`option: ${action.value}`);
        }
      }

      if (action.waitCondition) {
        const cue = action.waitCondition.visualCue || action.waitCondition.description;
        if (cue) {
          lines.push(`wait_for: ${cue}`);
          lines.push(`timeout: ${action.action === "wait" ? "10000" : "5000"}`);
        }
      }

      if (action.businessLogic) {
        lines.push(`# ${action.businessLogic}`);
      }

      return lines.join("\n");
    })
    .join("\n---\n");

  return metadata + steps;
}

function safeInline(input?: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  const lowered = trimmed.toLowerCase();
  if (lowered === "null" || lowered === "undefined" || lowered === "n/a") return "";
  return trimmed;
}

function sanitizeForQuotes(input?: string): string | undefined {
  if (!input) return undefined;
  // Replace single quotes to avoid breaking our quoted strings; prefer typographic apostrophe for readability
  return input.replace(/'/g, "’");
}

function neutralizeNarration(input?: string): string | undefined {
  if (!input) return undefined;
  let text = input.trim();
  // Strip common first-person prefixes
  text = text.replace(/^(i\s*will|i\'ll|i\s*am\s*going\s*to|we\s*will|we\'ll|let\'s)\s+/i, "");
  // Lowercase initial pronouns if left dangling
  text = text.replace(/^I\s+/g, "");
  return trimTrailingPunctuation(text);
}

function trimTrailingPunctuation(input?: string): string | undefined {
  if (!input) return undefined;
  return input.replace(/[\s\.,;:!?]+$/g, "");
}

function formatSelectorsHint(selectors?: string[]): string {
  if (!selectors || !selectors.length) return "";
  const cleaned = selectors.map((s) => safeInline(s)).filter(Boolean) as string[];
  if (!cleaned.length) return "";
  return ` Try selectors: ${cleaned.join(", ")}.`;
}


