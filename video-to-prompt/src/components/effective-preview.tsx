"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  promptText: string;
};

export function EffectivePreview({ promptText }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium">Effective request to AI</span>
          <span className="ml-2 text-muted-foreground">(video is attached separately)</span>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide" : "Show"}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3">
          <Card className="p-3">
            <pre className="whitespace-pre-wrap text-xs">{promptText}</pre>
          </Card>
        </div>
      )}
    </Card>
  );
}


