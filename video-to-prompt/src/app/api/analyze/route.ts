import { analyzeWithIRV, generateTextWithVideo } from "@/lib/gemini";
import { appendLog } from "@/lib/run-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(request: Request) {
  const formData = await request.formData();
  const video = formData.get("video");
  const _preset = (formData.get("preset") as string) || "browser-use";
  const promptText = (formData.get("promptText") as string) || "";
  const generators = formData.get("generators");
  const evaluators = formData.get("evaluators");
  const generatorModel = (formData.get("generatorModel") as string) || undefined;
  const evaluatorModel = (formData.get("evaluatorModel") as string) || undefined;
  const temperature = formData.get("temperature");
  const maxOutputTokens = formData.get("maxOutputTokens");
  const runId = (formData.get("runId") as string) || undefined;

  if (!video || !(video instanceof File)) {
    return Response.json({ error: "Missing video file" }, { status: 400 });
  }

  function sanitizePrompt(input: string): string {
    const maxLen = 12000;
    if (!input || !input.trim()) return "";
    // strip non-printable except standard whitespace
    const stripped = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    const trimmed = stripped.trim();
    return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
  }

  try {
    const effectivePrompt = sanitizePrompt(promptText);
    if (!effectivePrompt) {
      return Response.json({ error: "Missing prompt text" }, { status: 400 });
    }
    // If no advanced settings provided, keep legacy single-shot behavior for backward compat
    const hasAdvanced = Boolean(generators || evaluators || generatorModel || evaluatorModel || temperature || maxOutputTokens);
    if (!hasAdvanced) {
      appendLog(runId, "init", "single", "Single-shot generation started");
      const prompt = await generateTextWithVideo(video, effectivePrompt);
      appendLog(runId, "result", "single_done", "Single-shot generation completed");
      return Response.json({ prompt });
    }

    // New IRV pipeline
    appendLog(runId, "init", "run_started", "IRV analysis started", {
      generators: generators ? Number(generators) : undefined,
      evaluators: evaluators ? Number(evaluators) : undefined,
      generatorModel,
      evaluatorModel,
      temperature: temperature ? Number(temperature) : undefined,
      maxOutputTokens: maxOutputTokens ? Number(maxOutputTokens) : undefined,
    });

    const result = await analyzeWithIRV(video, effectivePrompt, {
      generators: generators ? Number(generators) : undefined,
      evaluators: evaluators ? Number(evaluators) : undefined,
      generatorModel,
      evaluatorModel,
      temperature: temperature ? Number(temperature) : undefined,
      maxOutputTokens: maxOutputTokens ? Number(maxOutputTokens) : undefined,
      runId,
    });

    if (result.type === "success") {
      appendLog(runId, "result", "success", "IRV analysis completed with winner", {
        chosenIndex: result.data.meta.chosenIndex,
        acceptableCounts: result.data.meta.acceptableCounts,
        wasTieBroken: result.data.meta.wasTieBroken,
      });
      return Response.json({
        prompt: result.data.prompt,
        meta: result.data.meta,
        candidates: result.data.candidates,
        generatorNames: result.data.generatorNames,
        averageRankings: result.data.averageRankings,
      });
    } else {
      // Non-consensus: return 200 with concatenated outputs; UI will present download
      appendLog(runId, "result", "fallback", "IRV analysis completed without consensus", {
        acceptableCounts: result.data.meta.acceptableCounts,
        reason: result.data.meta.reason,
      });
      return Response.json({
        prompt: result.data.prompt,
        meta: result.data.meta,
        candidates: result.data.candidates,
        generatorNames: result.data.generatorNames,
        averageRankings: result.data.averageRankings,
        error: "No consensus",
      });
    }
  } catch (error) {
    console.error("/api/analyze failed:", error);
    const messageStr = error instanceof Error ? error.message : String(error);
    appendLog(runId, "error", "exception", "Analyze failed", { message: messageStr });
    const isProd = process.env.NODE_ENV === "production";
    const message = !isProd
      ? (error instanceof Error ? error.message : String(error))
      : "Failed to analyze video";
    return Response.json({ error: message }, { status: 500 });
  }
}


