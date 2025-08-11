import { analyzeWithIRV, generateTextWithVideo } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(request: Request) {
  const formData = await request.formData();
  const video = formData.get("video");
  const _preset = (formData.get("preset") as string) || "browser-use";
  const promptText = (formData.get("promptText") as string) || "";
  const generators = formData.get("generators");
  const deciders = formData.get("deciders");
  const generatorModel = (formData.get("generatorModel") as string) || undefined;
  const deciderModel = (formData.get("deciderModel") as string) || undefined;
  const temperature = formData.get("temperature");
  const maxOutputTokens = formData.get("maxOutputTokens");

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
    const hasAdvanced = Boolean(generators || deciders || generatorModel || deciderModel || temperature || maxOutputTokens);
    if (!hasAdvanced) {
      const prompt = await generateTextWithVideo(video, effectivePrompt);
      return Response.json({ prompt });
    }

    // New IRV pipeline
    const result = await analyzeWithIRV(video, effectivePrompt, {
      generators: generators ? Number(generators) : undefined,
      deciders: deciders ? Number(deciders) : undefined,
      generatorModel,
      deciderModel,
      temperature: temperature ? Number(temperature) : undefined,
      maxOutputTokens: maxOutputTokens ? Number(maxOutputTokens) : undefined,
    });

    if (result.type === "success") {
      return Response.json({ prompt: result.data.prompt, meta: result.data.meta });
    } else {
      // Non-consensus: return 200 with concatenated outputs; UI will present download
      return Response.json({ prompt: result.data.prompt, meta: result.data.meta, error: "No consensus" });
    }
  } catch (error) {
    console.error("/api/analyze failed:", error);
    const isProd = process.env.NODE_ENV === "production";
    const message = !isProd
      ? (error instanceof Error ? error.message : String(error))
      : "Failed to analyze video";
    return Response.json({ error: message }, { status: 500 });
  }
}


