"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type SimpleOptions = Record<string, never>;

type Props = {
  initialPrompt: string;
  onChange: (payload: { promptText: string }) => void;
};

export function ControlsSimple({ initialPrompt, onChange }: Props) {
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
    <Card className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Prompt to model</Label>
        <textarea
          className="w-full h-56 rounded border p-2 text-sm font-mono"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Edit the preset prompt here before generating…"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{charCount} chars</span>
          <Button variant="secondary" onClick={() => setPromptText("")}>Clear</Button>
        </div>
      </div>
    </Card>
  );
}


