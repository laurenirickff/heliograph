"use client";

import { useEffect, useState } from "react";
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
  // Keep the inline SolarCorner a fixed, stable size so typography changes
  // don't alter the icon dimensions or alignment.
  useEffect(() => {
    const rowEl = document.getElementById("header-row");
    if (!rowEl) return;
    rowEl.style.setProperty("--logo-circle-d", `150px`);
  }, []);

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
    <div className="mx-auto w-full max-w-[min(var(--content-max),calc(100vw-2*var(--page-gutter)))] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-0 md:pt-1 pb-6 relative z-10">
      {/* Header: sun and title side-by-side like a logo */}
      <header className="relative">
        <div className="flex items-end gap-3 md:gap-4">
          {/* Compute the logo circle target height based on header text block */}
          <div className="flex items-center gap-3 md:gap-4" style={{
            // CSS var used by SolarCorner inline scaling; updated by effect below
            // Fallback keeps a sensible size before hydration
            ['--logo-circle-d' as any]: '150px'
          }} id="header-row">
            <SolarCorner variant="inline" />
            <div className="flex-1" id="header-text">
              <h1
                className={`${fraunces.className} text-[56px] md:text-[104px] leading-[1.03] font-semibold tracking-[-0.01em] text-[#B8831F] dark:text-[#F1C453]`}
              >
                Heliograph
              </h1>
              <p className="mt-1 text-[20px] md:text-[34px] font-semibold tracking-tight leading-[1.15] text-[#B8831F] dark:text-[#F1C453] opacity-80">
                Transform videos to prompts
              </p>
            </div>
          </div>
          <div className="ml-auto self-start">
            <ThemeToggle />
          </div>
        </div>
      </header>
      {/* Tightened spacing: remove extra spacer blocks under the header */}

      {/* Steps: vertically stacked full-width */}
      {state === "idle" && (
        <Card className="p-4 w-full mt-0 relative z-10">
          <div className="space-y-1">
            <div>
              <h2 className="text-base font-medium">Step 1: Upload your video</h2>
              <p className="text-sm leading-snug text-muted-foreground">Add a short recording of the workflow you want to turn into a prompt.</p>
            </div>
            <UploadZone onSelect={setSelectedFile} showActionButton={false} />
          </div>
        </Card>
      )}

      <Card className="p-4 w-full mt-3 relative z-10">
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
