"use client";

import { useState } from "react";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingView } from "@/components/processing-view";
import { PromptOutput } from "@/components/prompt-output";
import { TemplateSelector } from "@/components/template-selector";
import { ControlsSimple } from "@/components/controls-simple";
import { EffectivePreview } from "@/components/effective-preview";
import { getPresetText } from "@/lib/presets";
import { ThemeToggle } from "@/components/theme-toggle";
import { SolarCorner } from "@/components/solar-corner";

export default function Home() {
  const [template, setTemplate] = useState<"browser-use" | "airtop">("browser-use");
  const [state, setState] = useState<"idle" | "uploading" | "processing" | "complete">("idle");
  const [prompt, setPrompt] = useState("");
  const [promptText, setPromptText] = useState<string>(getPresetText(template));

  const handleUpload = async (file: File) => {
    setState("uploading");

    const formData = new FormData();
    formData.append("video", file);
    formData.append("preset", template);
    formData.append("promptText", promptText);

    setState("processing");
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (response.ok) {
      setPrompt(data.prompt);
      setState("complete");
    } else {
      setPrompt(`Error: ${data.error || "Unknown error"}`);
      setState("complete");
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <SolarCorner />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Heliograph</h1>
        <ThemeToggle />
      </div>

      {/* Tagline: Transform sun to morse code -> video to prompts */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-xl border bg-card/70 px-3 py-1.5 text-foreground/80 shadow-sm ring-1 ring-inset ring-ring/10 backdrop-blur-sm">
          <span className="text-xs uppercase tracking-wider">Transform</span>
          <span className="text-sm">
            <span className="line-through decoration-foreground/40 decoration-2">sun</span>
            <span className="mx-1 font-medium">video</span>
            <span className="mx-1">to</span>
            <span className="line-through decoration-foreground/40 decoration-2">morse code</span>
            <span className="mx-1 font-medium">prompts</span>
          </span>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <TemplateSelector
          value={template}
          onChange={(t) => {
            // Update template first, then seed prompt only if user hasn't edited or when switching presets
            setTemplate(t);
            setPromptText(getPresetText(t));
          }}
        />
        <ControlsSimple initialPrompt={promptText} onChange={({ promptText }) => setPromptText(promptText)} />
        <EffectivePreview promptText={promptText} />
      </div>

      {state === "idle" && <UploadZone onUpload={handleUpload} />}
      {state === "processing" && <ProcessingView />}
      {state === "complete" && (
        <div className="w-full space-y-4">
          <PromptOutput prompt={prompt} />
        </div>
      )}
    </div>
  );
}
