"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type SimpleOptions = Record<string, never>;

type Props = {
  initialPrompt: string;
  onChange: (payload: { promptText: string }) => void;
  showLabel?: boolean;
  labelText?: string;
};

export function ControlsSimple({ initialPrompt, onChange, showLabel = true, labelText = "Prompt" }: Props) {
  const [promptText, setPromptText] = useState<string>(initialPrompt);

  useEffect(() => {
    // Avoid redundant updates that can create render loops when parent re-renders
    setPromptText((prev) => (prev === initialPrompt ? prev : initialPrompt));
  }, [initialPrompt]);

  useEffect(() => {
    // Intentionally exclude onChange to avoid effect retrigger on changing function identity
    onChange({ promptText });
  }, [promptText]);

  const charCount = promptText.length;

  return (
    <div className="space-y-2">
      {showLabel && <Label>{labelText}</Label>}
      <textarea
        className="w-full min-h-40 max-h-80 resize-y rounded border p-2 text-sm font-mono"
        value={promptText}
        onChange={(e) => setPromptText(e.target.value)}
        placeholder="Adjust the instructions the AI will follow…"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{charCount} chars</span>
        <Button variant="secondary" onClick={() => setPromptText("")}>Clear</Button>
      </div>
    </div>
  );
}


