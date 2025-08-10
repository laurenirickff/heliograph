"use client";

import { useState } from "react";
import { Fraunces } from "next/font/google";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingView } from "@/components/processing-view";
import { PromptOutput } from "@/components/prompt-output";
import { TemplateSelector } from "@/components/template-selector";
import { ControlsSimple } from "@/components/controls-simple";
import { getPresetText } from "@/lib/presets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SolarCorner } from "@/components/solar-corner";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], display: "swap" });

export default function Home() {
  const [template, setTemplate] = useState<
    | "browser-use"
    | "browser-use-shadowing"
    | "browser-use-discovery"
    | "airtop"
  >("browser-use");
  const [state, setState] = useState<"idle" | "uploading" | "processing" | "complete">("idle");
  const [prompt, setPrompt] = useState("");
  const [promptText, setPromptText] = useState<string>(getPresetText(template));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
      <div className="mx-auto w-full max-w-[min(1800px,calc(100vw-4rem))] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-4 pb-12 relative z-10">
      <SolarCorner />
      <div className="relative mb-4 mt-8 md:mt-10 pl-[max(14rem,calc(var(--solar-anchor-x)+72px))] xl:pl-0">
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
      <div className="mb-8 pl-[max(14rem,calc(var(--solar-anchor-x)+72px))] xl:pl-0">
        <p className="mt-1 text-[clamp(16px,1.8vw,20px)] font-semibold tracking-tight leading-snug text-[#B8831F] dark:text-[#F1C453] opacity-80">
          Transform videos to prompts
        </p>
      </div>

      {/* Steps: vertically stacked full-width */}
      {state === "idle" && (
        <Card className="p-4 w-full relative z-10">
          <div className="space-y-1">
            <div>
              <h2 className="text-base font-medium">Step 1: Upload your video</h2>
              <p className="text-sm leading-snug text-muted-foreground">Add a short recording of the workflow you want to turn into a prompt.</p>
            </div>
            <UploadZone onSelect={setSelectedFile} showActionButton={false} />
          </div>
        </Card>
      )}

      <Card className="p-4 w-full mt-6 relative z-10">
        <div className="space-y-1">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">Step 2: Prompt</h2>
              <TemplateSelector
                inline
                label="Template"
                value={template}
                onChange={(t) => {
                  // Update template first, then seed prompt only if user hasn't edited or when switching presets
                  setTemplate(t);
                  setPromptText(getPresetText(t));
                }}
              />
            </div>
            <p className="text-sm leading-snug text-muted-foreground">Pick a template and adjust the prompt as needed.</p>
          </div>
          <ControlsSimple
            showLabel={false}
            initialPrompt={promptText}
            onChange={({ promptText }) => setPromptText(promptText)}
          />
        </div>
      </Card>

      {state === "idle" && (
        <Card className="p-4 w-full mt-6 relative z-10">
          <div className="mb-3">
            <h2 className="text-base font-medium">Step 3: Generate your result</h2>
            <p className="text-sm text-muted-foreground">We’ll process the video and return a ready-to-use prompt you can copy.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => selectedFile && handleUpload(selectedFile)} disabled={!selectedFile}>
              Generate Prompt
            </Button>
          </div>
        </Card>
      )}

      {/* Processing / Output occupy full width below steps */}
      <div className="mt-6">
        {state === "processing" && <ProcessingView />}
        {state === "complete" && (
          <div className="w-full space-y-4">
            <PromptOutput prompt={prompt} />
          </div>
        )}
      </div>
    </div>
  );
}
