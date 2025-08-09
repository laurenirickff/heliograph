"use client";

import { useState } from "react";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingView } from "@/components/processing-view";
import { PromptOutput } from "@/components/prompt-output";
import { TemplateSelector } from "@/components/template-selector";
import { ControlsSimple } from "@/components/controls-simple";
import { EffectivePreview } from "@/components/effective-preview";
import { getPresetText } from "@/lib/presets";

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
      <h1 className="text-2xl font-semibold mb-6">VideoToPrompt</h1>

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
