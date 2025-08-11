"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  const onDownload = () => {
    const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full">
      <Card className="p-4">
        <pre className="whitespace-pre-wrap text-sm">{prompt}</pre>
      </Card>
      <div className="mt-4 flex gap-2 justify-end">
        <Button variant="secondary" onClick={onDownload}>
          Download .txt
        </Button>
        <Button onClick={onCopy}>{copied ? "Copied" : "Copy"}</Button>
      </div>
    </div>
  );
}


