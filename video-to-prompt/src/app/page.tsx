"use client";

import { useEffect, useState } from "react";
import { Fraunces } from "next/font/google";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingView } from "@/components/processing-view";
import { PromptOutput } from "@/components/prompt-output";
import { TemplateSelector } from "@/components/template-selector";
import { ControlsSimple } from "@/components/controls-simple";
import { getPresetText } from "@/lib/presets";
import { estimatePipelineCost, formatUSD } from "@/lib/pricing";
import { EVALUATOR_PROMPT } from "@/lib/prompts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { SolarCorner } from "@/components/solar-corner";
import { ActivityLog } from "@/components/activity-log";
import { SummaryCard } from "@/components/summary-card";

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
  const [allCandidates, setAllCandidates] = useState<{ index: number; text: string }[] | null>(null);
  const [generatorNames, setGeneratorNames] = useState<string[] | null>(null);
  const [averageRankings, setAverageRankings] = useState<{ index: number; name: string; avg: number | null; votes: number }[] | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  type Meta = { reason?: string } | null;
  const [meta, setMeta] = useState<Meta>(null);
  const [promptText, setPromptText] = useState<string>(getPresetText(template));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const [generators, setGenerators] = useState<number>(5);
  const [evaluators, setEvaluators] = useState<number>(3);
  const [generatorModel, setGeneratorModel] = useState<string>("gemini-2.5-flash");
  const [evaluatorModel, setEvaluatorModel] = useState<string>("gemini-1.5-pro");
  // Keep the inline SolarCorner a fixed, stable size so typography changes
  // don't alter the icon dimensions or alignment.
  useEffect(() => {
    const rowEl = document.getElementById("header-row");
    if (!rowEl) return;
    rowEl.style.setProperty("--logo-circle-d", `150px`);
  }, []);

  const downloadText = (content: string, name: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derive video duration locally when a file is selected so estimator can use it
  useEffect(() => {
    if (!selectedFile) {
      setVideoDurationSec(null);
      return;
    }
    let revoked = false;
    const url = URL.createObjectURL(selectedFile);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    const onLoaded = () => {
      if (!isNaN(video.duration)) setVideoDurationSec(video.duration);
      if (!revoked) URL.revokeObjectURL(url);
      revoked = true;
    };
    video.addEventListener("loadedmetadata", onLoaded);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      if (!revoked) URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  const handleUpload = async (file: File) => {
    setState("uploading");
    const newRunId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setRunId(newRunId);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("preset", template);
    formData.append("promptText", promptText);
    formData.append("generators", String(generators));
    formData.append("evaluators", String(evaluators));
    formData.append("generatorModel", generatorModel);
    formData.append("evaluatorModel", evaluatorModel);
    formData.append("runId", newRunId);

    setState("processing");
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (response.ok) {
      setPrompt(data.prompt);
      setMeta(data.meta || null);
      setAllCandidates(Array.isArray(data.candidates) ? data.candidates : null);
      setGeneratorNames(Array.isArray(data.generatorNames) ? data.generatorNames : null);
      setAverageRankings(Array.isArray(data.averageRankings) ? data.averageRankings : null);
      setState("complete");
    } else {
      setPrompt(`Error: ${data.error || "Unknown error"}`);
      setMeta(null);
      setAllCandidates(null);
      setGeneratorNames(null);
      setAverageRankings(null);
      setState("complete");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[min(var(--content-max),calc(100vw-2*var(--page-gutter)))] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-0 md:pt-1 pb-6 relative z-10">
      {/* Header: sun and title side-by-side like a logo */}
      <header className="relative">
        <div className="flex items-end gap-3 md:gap-4">
          {/* Compute the logo circle target height based on header text block */}
          <div className="flex items-center gap-0 md:gap-0" style={{
            // CSS var used by SolarCorner inline scaling; updated by effect below
            // Fallback keeps a sensible size before hydration
            ['--logo-circle-d' as unknown as string]: '150px'
          }} id="header-row">
            <SolarCorner variant="inline" />
            <div className="flex-1 -ml-5 md:-ml-8" id="header-text">
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

      {state === "idle" && (
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
      )}

      {state === "idle" && (
        <Card className="p-4 w-full mt-6 relative z-10">
          <div className="mb-3">
            <h2 className="text-base font-medium">Step 3: Advanced settings</h2>
            <p className="text-sm text-muted-foreground">Configure the number of generators and evaluators, and choose models.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="generators">Generators (N)</Label>
              <input
                id="generators"
                type="number"
                min={1}
                max={10}
                value={generators}
                onChange={(e) => setGenerators(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                className="w-full rounded border px-3 py-2 text-sm bg-transparent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evaluators">Evaluators (K)</Label>
              <input
                id="evaluators"
                type="number"
                min={1}
                max={7}
                value={evaluators}
                onChange={(e) => setEvaluators(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
                className="w-full rounded border px-3 py-2 text-sm bg-transparent"
              />
            </div>
            <div className="space-y-2">
              <Label>Generator model</Label>
              <Select value={generatorModel} onValueChange={setGeneratorModel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash" subtitle="Video-capable, fast">gemini-2.5-flash</SelectItem>
                  <SelectItem value="gemini-2.5-flash-lite" subtitle="Lowest latency, cost‑efficient">gemini-2.5-flash-lite</SelectItem>
                  <SelectItem value="gemini-2.5-pro" subtitle="Higher reasoning">gemini-2.5-pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Evaluator model</Label>
              <Select value={evaluatorModel} onValueChange={setEvaluatorModel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash" subtitle="Fast">gemini-2.5-flash</SelectItem>
                  <SelectItem value="gemini-2.5-flash-lite" subtitle="Lowest latency, cost‑efficient">gemini-2.5-flash-lite</SelectItem>
                  <SelectItem value="gemini-2.5-pro" subtitle="Higher reasoning">gemini-2.5-pro</SelectItem>
                  <SelectItem value="gemini-1.5-pro" subtitle="Higher reasoning, text-only">gemini-1.5-pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Pricing estimate (appears once a video is selected) */}
          {selectedFile && videoDurationSec && videoDurationSec > 0 && (
            <div className="mt-4 border-t pt-4">
              {(() => {
                const estimate = estimatePipelineCost({
                  videoDurationSec,
                  generators,
                  evaluators,
                  generatorModel,
                  evaluatorModel,
                  promptText,
                  evaluatorPromptBaseChars: EVALUATOR_PROMPT.length,
                });
                if (!estimate) return null;
                const mins = (videoDurationSec / 60);
                return (
                  <div className="text-sm">
                    <div className="flex items-baseline justify-between">
                      <div className="font-medium">Estimated cost</div>
                      <div className="text-base font-semibold">{formatUSD(estimate.totalUSD)}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded border p-3">
                        <div className="font-medium mb-1">Generators ({generators} × {generatorModel})</div>
                        <div className="text-muted-foreground">
                          <div>Video: {mins.toFixed(1)} min × {generatorModel} rate → {formatUSD(estimate.details.generator.perCall.videoUSD)}</div>
                          <div>Input: ~{estimate.details.tokens.promptTokens} tok → {formatUSD(estimate.details.generator.perCall.inUSD)}</div>
                          <div>Output: ~{estimate.details.tokens.avgGeneratorOutTokens} tok → {formatUSD(estimate.details.generator.perCall.outUSD)}</div>
                          <div className="mt-1">Per call: {formatUSD(estimate.details.generator.perCall.totalUSD)}</div>
                          <div>Total: {formatUSD(estimate.details.generator.totalUSD)}</div>
                        </div>
                      </div>
                      <div className="rounded border p-3">
                        <div className="font-medium mb-1">Evaluators ({evaluators} × {evaluatorModel})</div>
                        <div className="text-muted-foreground">
                          <div>Input per call: ~{estimate.details.tokens.evaluatorInTokensPerCall} tok → {formatUSD(estimate.details.evaluator.perCall.inUSD)}</div>
                          <div>Output per call: ~{estimate.details.tokens.evaluatorOutTokensPerCall} tok → {formatUSD(estimate.details.evaluator.perCall.outUSD)}</div>
                          <div className="mt-1">Per call: {formatUSD(estimate.details.evaluator.perCall.totalUSD)}</div>
                          <div>Total: {formatUSD(estimate.details.evaluator.totalUSD)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Ballpark only. Based on video length and prompt size; actual model usage may vary.
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </Card>
      )}

      {state === "idle" && (
        <Card className="p-4 w-full mt-6 relative z-10">
          <div className="mb-3">
            <h2 className="text-base font-medium">Step 4: Generate your result</h2>
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
        {state === "processing" && (
          <div className="space-y-3">
            <ProcessingView />
            {runId && <SummaryCard runId={runId} />}
            {runId && <ActivityLog runId={runId} />}
          </div>
        )}
        {state === "complete" && (
          <div className="w-full space-y-4">
            {/* Primary actions at top-left */}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => downloadText(prompt, "best-result.txt")}
              >
                Download Best Result
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const combined = `Prompt sent to agent:\n\n${promptText}\n\n---\n\nBest result:\n\n${prompt}`;
                  downloadText(combined, "best-result-and-prompt.txt");
                }}
              >
                Download Best Result and Prompt
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  // Build an "all results and prompt" text file
                  const header = `Prompt sent to agent:\n\n${promptText}`;
                  const averagesSection = Array.isArray(averageRankings)
                    ? `\n\nAverage rankings:\n${averageRankings
                        .slice()
                        .sort((a, b) => {
                          const av = a.avg ?? Infinity;
                          const bv = b.avg ?? Infinity;
                          return av - bv;
                        })
                        .map((r) => `- ${r.name}: ${r.avg === null ? "—" : r.avg.toFixed(2)} (${r.votes} votes)`) 
                        .join("\n")}`
                    : "";
                  const divider = "\n\n==============================\n\n";
                  const candidatesSection = Array.isArray(allCandidates) && Array.isArray(generatorNames)
                    ? allCandidates
                        .slice()
                        .sort((a, b) => a.index - b.index)
                        .map((c) => {
                          const name = generatorNames?.[c.index] ?? `Candidate ${c.index}`;
                          const avg = averageRankings?.find((r) => r.index === c.index)?.avg ?? null;
                          const votes = averageRankings?.find((r) => r.index === c.index)?.votes ?? 0;
                          const scoreLine = avg === null ? "—" : `${avg.toFixed(2)} (${votes} votes)`;
                          return `${name} [${c.index}] — Avg rank: ${scoreLine}\n\n${c.text}`;
                        })
                        .join(divider)
                    : `Best result:\n\n${prompt}`;
                  const combined = `${header}${averagesSection}\n\n---\n\nAll results:\n\n${candidatesSection}`;
                  downloadText(combined, "all-results-and-prompt.txt");
                }}
              >
                Download All Results and Prompt
              </Button>
            </div>

            {/* Summary section above Best Result; title within card */}
            {runId && <SummaryCard runId={runId} />}
            {/* Best Result card includes its header inside component */}
            <PromptOutput prompt={prompt} filename={meta?.reason ? "all-candidates.txt" : "prompt.txt"} />
            {runId && <ActivityLog runId={runId} collapsedByDefault />}
          </div>
        )}
      </div>
    </div>
  );
}
