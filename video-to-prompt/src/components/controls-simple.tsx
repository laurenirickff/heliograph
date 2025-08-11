"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";

export type SimpleOptions = Record<string, never>;

type Props = {
  initialPrompt: string;
  onChange: (payload: { promptText: string }) => void;
  showLabel?: boolean;
  labelText?: string;
};

export function ControlsSimple({ initialPrompt, onChange, showLabel = true, labelText = "Prompt" }: Props) {
  const [promptText, setPromptText] = useState<string>(initialPrompt);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Avoid redundant updates that can create render loops when parent re-renders
    setPromptText((prev) => (prev === initialPrompt ? prev : initialPrompt));
  }, [initialPrompt]);

  useEffect(() => {
    // Intentionally exclude onChange to avoid effect retrigger on changing function identity
    onChange({ promptText });
  }, [promptText]);

  // No global overlays; expansion simply increases the editor height within the flow

  // Auto-size the textarea when expanded so there is no internal scrollbar
  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    if (isExpanded) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    } else {
      // Reset inline height when contracting so CSS controls size and scrolling
      el.style.height = "";
    }
  }, [isExpanded, promptText]);

  // Character counter removed per UX simplification

  return (
    <div className="space-y-2">
      {showLabel ? <Label htmlFor="prompt-editor-textarea">{labelText}</Label> : null}
      <div className="relative group">
        <textarea
          id="prompt-editor-textarea"
          ref={textAreaRef}
          className={
            "w-full rounded border p-3 pr-12 text-sm leading-relaxed font-mono prompt-editor-textarea " +
            (isExpanded
              ? "min-h-[60vh] max-h-none overflow-hidden resize-none"
              : "min-h-56 max-h-96 overflow-auto resize-none")
          }
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Adjust the instructions the AI will follow…"
          style={{ resize: "none" }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          aria-controls="prompt-editor-textarea"
          aria-label={isExpanded ? "Contract editor" : "Expand editor"}
          title={isExpanded ? "Contract editor" : "Expand editor"}
          className="absolute top-2 right-2 z-10 opacity-70 hover:opacity-100 focus:opacity-100"
        >
          {isExpanded ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
        </Button>
      </div>
      <style jsx>{`
        /* Scoped scrollbar styling for the prompt editor only */
        :global(.prompt-editor-textarea) {
          scrollbar-width: thin; /* Firefox */
          scrollbar-color: var(--border) transparent; /* Firefox */
        }
        :global(.prompt-editor-textarea::-webkit-scrollbar) {
          width: 10px;
          height: 10px;
        }
        :global(.prompt-editor-textarea::-webkit-scrollbar-track) {
          background: transparent;
        }
        :global(.prompt-editor-textarea::-webkit-scrollbar-thumb) {
          background-color: var(--border);
          border-radius: 9999px;
          border: 3px solid transparent; /* pill look */
          background-clip: content-box;
        }
        :global(.prompt-editor-textarea:hover::-webkit-scrollbar-thumb) {
          background-color: var(--muted);
        }
        /* Ensure dark mode aligns with theme tokens */
        :global(.dark .prompt-editor-textarea) {
          scrollbar-color: var(--border) transparent; /* Firefox */
        }
        :global(.dark .prompt-editor-textarea::-webkit-scrollbar-thumb) {
          background-color: var(--border);
        }
      `}</style>
      {/* Footer with char counter and clear action removed intentionally */}
    </div>
  );
}


