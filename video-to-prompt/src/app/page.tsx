"use client";

import { useState } from "react";
import { Fraunces } from "next/font/google";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingView } from "@/components/processing-view";
import { PromptOutput } from "@/components/prompt-output";
import { TemplateSelector } from "@/components/template-selector";
import { ControlsSimple } from "@/components/controls-simple";
import { EffectivePreview } from "@/components/effective-preview";
import { getPresetText } from "@/lib/presets";
import { ThemeToggle } from "@/components/theme-toggle";
import { SolarCorner } from "@/components/solar-corner";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], display: "swap" });

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
    <div className="container mx-auto max-w-4xl px-8 pt-2 pb-8">
      <SolarCorner />
      <div className="relative mb-4 mt-8 md:mt-10">
        <div className="absolute right-0 top-0">
          <ThemeToggle />
        </div>
        <h1
          className={`${fraunces.className} text-5xl md:text-6xl font-semibold tracking-wide text-[#B8831F] dark:text-[#F1C453] pb-2 border-b border-amber-400/30 dark:border-amber-300/25`}
        >
          Heliograph
        </h1>
      </div>

      {/* Tagline: strong, simple subhead under title (no lines) */}
      <div className="mb-8">
        <p className="mt-1 text-[clamp(16px,1.8vw,20px)] font-semibold tracking-tight leading-snug text-[#B8831F] dark:text-[#F1C453] opacity-80">
          Transform videos to prompts
        </p>
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
