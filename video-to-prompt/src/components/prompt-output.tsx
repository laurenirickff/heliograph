"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

type Props = {
  prompt: string;
  filename?: string;
};

export function PromptOutput({ prompt, filename = "prompt.txt" }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-full">
      <Card className="p-4 pt-3 relative">
        <div className="text-lg md:text-xl font-semibold text-[#B8831F] dark:text-[#F1C453] mb-2">Best Result</div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCopy}
          aria-label="Copy result"
          title={copied ? "Copied" : "Copy"}
          className="absolute top-2 right-2 z-10 opacity-70 hover:opacity-100 focus:opacity-100"
        >
          <Copy className="size-4" aria-hidden />
        </Button>
        <pre className="whitespace-pre-wrap text-sm">{prompt}</pre>
      </Card>
    </div>
  );
}


