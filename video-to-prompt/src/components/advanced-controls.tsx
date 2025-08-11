"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EXTRACTION_PROMPT_FLEX } from "@/lib/prompts";

type NormalizeMode = "strict" | "lenient" | "none";
type TemplateType = "browser-use" | "airtop";

export type GuidedOptions = {
  includeSelectors: boolean;
  includeNarration: boolean;
  includeWaits: boolean;
  allowBranches: boolean; // only relevant for non-normalized
  maxSteps?: number;
  verbosity: "compact" | "normal" | "detailed";
  language?: string;
  addErrorHandlingFooter: boolean; // formatter option
  includeVisualContext: boolean; // formatter option
  mergeMicroSteps: boolean; // formatter option
};

const DEFAULT_OPTIONS: GuidedOptions = {
  includeSelectors: true,
  includeNarration: true,
  includeWaits: true,
  allowBranches: true,
  verbosity: "normal",
  addErrorHandlingFooter: true,
  includeVisualContext: true,
  mergeMicroSteps: false,
};

function storageKey(template: TemplateType, normalize: NormalizeMode) {
  return `vtp:prompt:${template}:${normalize}`;
}

function optionsKey(template: TemplateType, normalize: NormalizeMode) {
  return `vtp:options:${template}:${normalize}`;
}

type Props = {
  template: TemplateType;
  normalize: NormalizeMode;
  onChange: (payload: { extractionPrompt: string; options: GuidedOptions }) => void;
};

export function AdvancedControls({ template, normalize, onChange }: Props) {
  // In strict/lenient, the text area acts as an optional preamble (schema is always attached server-side)
  const defaultPrompt = normalize === "none" ? EXTRACTION_PROMPT_FLEX : "";
  const [extractionPrompt, setExtractionPrompt] = useState<string>(defaultPrompt);
  const [options, setOptions] = useState<GuidedOptions>(DEFAULT_OPTIONS);

  // Load from localStorage per (template, normalize)
  useEffect(() => {
    const key = storageKey(template, normalize);
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    setExtractionPrompt(saved && saved.length > 0 ? saved : defaultPrompt);
    const optKey = optionsKey(template, normalize);
    const savedOpts = typeof window !== "undefined" ? window.localStorage.getItem(optKey) : null;
    setOptions(savedOpts ? { ...DEFAULT_OPTIONS, ...JSON.parse(savedOpts) } : DEFAULT_OPTIONS);
  }, [template, normalize, defaultPrompt]);

  // Persist
  useEffect(() => {
    const key = storageKey(template, normalize);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, extractionPrompt);
    }
  }, [extractionPrompt, template, normalize]);

  useEffect(() => {
    const key = optionsKey(template, normalize);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(options));
    }
  }, [options, template, normalize]);

  // Bubble up changes
  useEffect(() => {
    onChange({ extractionPrompt, options });
  }, [extractionPrompt, options, onChange]);

  const charCount = extractionPrompt.length;
  const tooLong = charCount > 10000;

  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>
          {normalize === "none" ? "Extraction Prompt" : "Extraction Preamble (optional)"}
          <span className="ml-2 text-xs text-muted-foreground">
            {normalize === "none"
              ? "Full prompt sent to the model."
              : "Will be prepended before the fixed strict schema to steer extraction."}
          </span>
        </Label>
        <textarea
          className="w-full h-40 rounded border p-2 text-sm font-mono"
          value={extractionPrompt}
          onChange={(e) => setExtractionPrompt(e.target.value)}
          placeholder={normalize === "none" ? undefined : "Optional guidance, constraints, or domain context..."}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{charCount} chars {tooLong ? "(too long)" : ""}</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setExtractionPrompt(defaultPrompt)}
            >
              {normalize === "none" ? "Reset to default" : "Clear"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setOptions({
                ...options,
                verbosity: "compact",
                includeVisualContext: false,
                mergeMicroSteps: true,
                addErrorHandlingFooter: false,
              })}
            >
              Preset: Concise
            </Button>
            <Button variant="secondary" onClick={() => setOptions({
              ...options,
              verbosity: "detailed",
              includeWaits: true,
              addErrorHandlingFooter: true,
            })}>
              Preset: QA-heavy
            </Button>
            {normalize === "none" && (
              <Button
                variant="secondary"
                onClick={() => setOptions({
                  ...options,
                  allowBranches: true,
                  verbosity: "normal",
                })}
              >
                Preset: Branch-aware
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Guided options (extraction)
            <span className="ml-2 text-xs text-muted-foreground">These influence the model&apos;s extraction directly.</span>
          </Label>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={options.includeSelectors} onChange={(e) => setOptions({ ...options, includeSelectors: e.target.checked })} />
            <span className="text-sm">Include selectors</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={options.includeNarration} onChange={(e) => setOptions({ ...options, includeNarration: e.target.checked })} />
            <span className="text-sm">Include narration context</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={options.includeWaits} onChange={(e) => setOptions({ ...options, includeWaits: e.target.checked })} />
            <span className="text-sm">Include waits/verification</span>
          </div>
          {normalize === "none" && (
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={options.allowBranches} onChange={(e) => setOptions({ ...options, allowBranches: e.target.checked })} />
              <span className="text-sm">Allow branches/alternatives/notes</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm w-28">Max steps</span>
            <input
              type="number"
              className="w-24 rounded border p-1 text-sm"
              value={options.maxSteps ?? ''}
              onChange={(e) => setOptions({ ...options, maxSteps: e.target.value ? Number(e.target.value) : undefined })}
              min={1}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm w-28">Verbosity</span>
            <select
              className="rounded border p-1 text-sm"
              value={options.verbosity}
              onChange={(e) => setOptions({ ...options, verbosity: e.target.value as GuidedOptions["verbosity"] })}
            >
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm w-28">Language</span>
            <input
              type="text"
              className="rounded border p-1 text-sm"
              placeholder="English"
              value={options.language ?? ''}
              onChange={(e) => setOptions({ ...options, language: e.target.value || undefined })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Formatter options
            <span className="ml-2 text-xs text-muted-foreground">Deterministic shaping of the final prompt.</span>
          </Label>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={options.addErrorHandlingFooter} onChange={(e) => setOptions({ ...options, addErrorHandlingFooter: e.target.checked })} />
            <span className="text-sm">Add error-handling footer</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={options.includeVisualContext} onChange={(e) => setOptions({ ...options, includeVisualContext: e.target.checked })} />
            <span className="text-sm">Include visual context in steps</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={options.mergeMicroSteps} onChange={(e) => setOptions({ ...options, mergeMicroSteps: e.target.checked })} />
            <span className="text-sm">Merge micro-steps</span>
          </div>
        </div>
      </div>
    </Card>
  );
}


