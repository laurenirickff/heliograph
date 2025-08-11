/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import { Action, AggregateDecision, DeciderVote, GeneratorOutput } from "./types";
import { appendLog } from "./run-log";
import { EXTRACTION_PROMPT_STRICT, buildDeciderPrompt } from "./prompts";

interface UploadResponseMeta {
  file: {
    name?: string;
    uri?: string;
    mimeType?: string;
  };
}

interface FileMeta {
  name?: string;
  uri?: string;
  mimeType?: string;
  state?: string;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 800): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

let aiInstance: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (aiInstance) return aiInstance;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required. Set it in .env.local and restart the dev server.");
  }
  aiInstance = new GoogleGenAI({ apiKey });
  return aiInstance;
}

// Default prompts moved to ./prompts to allow client-side import

export async function analyzeVideo(file: File): Promise<Action[]> {
  function inferMimeTypeFromName(name?: string): string | undefined {
    if (!name) return undefined;
    const lower = name.toLowerCase();
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".webm")) return "video/webm";
    return undefined;
  }
  // Determine the most accurate mime type we can before upload
  const fileName: string | undefined = (file as unknown as { name?: string }).name;
  const uploadMime =
    file.type && file.type !== "application/octet-stream"
      ? file.type
      : inferMimeTypeFromName(fileName) || "video/mp4";

  // Upload via Files API
  const uploaded = (await withRetry(() =>
    getAI().files.upload({
      file,
      config: { mimeType: uploadMime },
    }),
  )) as UploadResponseMeta;
  // Minimal logging without unsafe casts
  console.debug("Gemini upload response (truncated)", {
    hasFile: Boolean(uploaded?.file),
    name: uploaded?.file?.name,
    mimeType: uploaded?.file?.mimeType,
  });

  // Resolve URI and mimeType robustly
  const uploadedAny = uploaded as unknown as { file?: FileMeta } & FileMeta;
  // Support both shapes: { file: {...} } or plain {...}
  const uploadedFile: FileMeta | undefined = uploadedAny.file ?? {
    name: uploadedAny.name,
    uri: uploadedAny.uri,
    mimeType: uploadedAny.mimeType,
  };

  let fileUri: string | undefined = uploadedFile?.uri;
  let fileMime: string | undefined =
    uploadedFile?.mimeType && uploadedFile.mimeType !== "application/octet-stream"
      ? uploadedFile.mimeType
      : file.type && file.type !== "application/octet-stream"
        ? file.type
        : inferMimeTypeFromName(uploadedFile?.name || (file as unknown as { name?: string }).name) || undefined;
  if (!fileMime) fileMime = "video/mp4"; // conservative default for .mp4 uploads

  // Fallback: fetch metadata by name if uri was not present
  const uploadedName = uploadedFile?.name;
  if (uploadedName) {
    // Poll until file becomes ACTIVE and uri is available (videos can take longer)
    for (let attempts = 0; attempts < 60; attempts++) {
      const fetched = (await withRetry(() =>
        getAI().files.get({ name: uploadedName }),
      )) as UploadResponseMeta | FileMeta;
      const fetchedFile: FileMeta = (fetched as UploadResponseMeta).file ?? (fetched as FileMeta);
      console.debug("Gemini files.get", {
        name: fetchedFile?.name,
        state: fetchedFile?.state,
        hasUri: Boolean(fetchedFile?.uri),
        mimeType: fetchedFile?.mimeType,
      });
      fileUri = fetchedFile?.uri ?? fileUri;
      fileMime =
        fetchedFile?.mimeType && fetchedFile.mimeType !== "application/octet-stream"
          ? fetchedFile.mimeType
          : fileMime;
      if (fetchedFile?.state === "ACTIVE" && fileUri) break;
      if (fetchedFile?.state === "FAILED" || fetchedFile?.state === "DELETED") {
        throw new Error(`Uploaded file state ${fetchedFile.state}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!fileUri || !fileMime) {
    throw new Error("Uploaded file missing uri or mimeType");
  }

  // Generate content referencing the uploaded file
  // Force a supported video mime if upstream returns octet-stream
  const effectiveMime =
    fileMime === "application/octet-stream" ? inferMimeTypeFromName(uploadedFile?.name) || "video/mp4" : fileMime;
  const requestContents = createUserContent([
    createPartFromUri(fileUri as string, effectiveMime as string),
    EXTRACTION_PROMPT_STRICT,
  ]);
  console.debug("Gemini generateContent request", {
    model: "gemini-2.5-flash",
    mime: effectiveMime,
    uriSample: fileUri?.slice(0, 16) + "...",
  });
  const response = await withRetry(() =>
    getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: requestContents,
    }),
  );

  // Extract text from response across SDK variants
  let text: string = "";
  const maybeTextFunc = (response as unknown as { text?: (() => string) | string }).text;
  if (typeof maybeTextFunc === "function") {
    text = maybeTextFunc();
  } else if (typeof maybeTextFunc === "string") {
    text = maybeTextFunc;
  } else {
    type Part = { text?: string };
    type Candidate = { content?: { parts?: Part[] } };
    const candidates = (response as unknown as { candidates?: Candidate[] }).candidates;
    if (Array.isArray(candidates)) {
      const parts: Part[] = candidates[0]?.content?.parts ?? [];
      const firstText = parts.find((p) => typeof p?.text === "string");
      if (firstText?.text) text = firstText.text;
    }
  }
  try {
    const raw = JSON.parse(text) as unknown;
    const actions = normalizeActions(raw);
    return actions;
  } catch {
    // Try to extract JSON from fenced code blocks if present
    const match = text.match(/```json[\s\S]*?```/i) || text.match(/\[[\s\S]*\]/);
    if (match) {
      const cleaned = match[0]
        .replace(/^```json\n?/i, "")
        .replace(/```$/, "")
        .trim();
      const raw = JSON.parse(cleaned) as unknown;
      const actions = normalizeActions(raw);
      return actions;
    }
    throw new Error("Failed to parse model response as JSON");
  }
}

export type NormalizationStats = {
  rawSteps: number;
  normalizedSteps: number;
  filteredSteps: number;
  droppedUnknownKeyCount: number;
  preservedUnknownKeyCount: number;
  parseSource: "plain" | "fenced";
};

export type AnalyzeDetailedResult = {
  actions: Action[];
  raw: unknown;
  stats: NormalizationStats;
};

/**
 * Flexible analysis that accepts a custom extraction prompt and returns both
 * the raw parsed JSON and the normalized actions.
 */
export async function analyzeVideoDetailed(
  file: File,
  extractionPrompt: string,
  includeExtras: boolean = false,
): Promise<AnalyzeDetailedResult> {
  function inferMimeTypeFromName(name?: string): string | undefined {
    if (!name) return undefined;
    const lower = name.toLowerCase();
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".webm")) return "video/webm";
    return undefined;
  }

  const fileName: string | undefined = (file as unknown as { name?: string }).name;
  const uploadMime =
    file.type && file.type !== "application/octet-stream"
      ? file.type
      : inferMimeTypeFromName(fileName) || "video/mp4";

  const uploaded = (await withRetry(() =>
    getAI().files.upload({
      file,
      config: { mimeType: uploadMime },
    }),
  )) as UploadResponseMeta;

  const uploadedAny = uploaded as unknown as { file?: FileMeta } & FileMeta;
  const uploadedFile: FileMeta | undefined = uploadedAny.file ?? {
    name: uploadedAny.name,
    uri: uploadedAny.uri,
    mimeType: uploadedAny.mimeType,
  };

  let fileUri: string | undefined = uploadedFile?.uri;
  let fileMime: string | undefined =
    uploadedFile?.mimeType && uploadedFile.mimeType !== "application/octet-stream"
      ? uploadedFile.mimeType
      : file.type && file.type !== "application/octet-stream"
        ? file.type
        : inferMimeTypeFromName(uploadedFile?.name || (file as unknown as { name?: string }).name) || undefined;
  if (!fileMime) fileMime = "video/mp4";

  const uploadedName = uploadedFile?.name;
  if (uploadedName) {
    for (let attempts = 0; attempts < 60; attempts++) {
      const fetched = (await withRetry(() =>
        getAI().files.get({ name: uploadedName }),
      )) as UploadResponseMeta | FileMeta;
      const fetchedFile: FileMeta = (fetched as UploadResponseMeta).file ?? (fetched as FileMeta);
      fileUri = fetchedFile?.uri ?? fileUri;
      fileMime =
        fetchedFile?.mimeType && fetchedFile.mimeType !== "application/octet-stream"
          ? fetchedFile.mimeType
          : fileMime;
      if (fetchedFile?.state === "ACTIVE" && fileUri) break;
      if (fetchedFile?.state === "FAILED" || fetchedFile?.state === "DELETED") {
        throw new Error(`Uploaded file state ${fetchedFile.state}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!fileUri || !fileMime) {
    throw new Error("Uploaded file missing uri or mimeType");
  }

  const effectiveMime =
    fileMime === "application/octet-stream" ? inferMimeTypeFromName(uploadedFile?.name) || "video/mp4" : fileMime;
  const requestContents = createUserContent([
    createPartFromUri(fileUri as string, effectiveMime as string),
    extractionPrompt,
  ]);
  const response = await withRetry(() =>
    getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: requestContents,
    }),
  );

  // Extract text
  let text: string = "";
  const maybeTextFunc = (response as unknown as { text?: (() => string) | string }).text;
  if (typeof maybeTextFunc === "function") {
    text = maybeTextFunc();
  } else if (typeof maybeTextFunc === "string") {
    text = maybeTextFunc;
  } else {
    type Part = { text?: string };
    type Candidate = { content?: { parts?: Part[] } };
    const candidates = (response as unknown as { candidates?: Candidate[] }).candidates;
    if (Array.isArray(candidates)) {
      const parts: Part[] = candidates[0]?.content?.parts ?? [];
      const firstText = parts.find((p) => typeof p?.text === "string");
      if (firstText?.text) text = firstText.text;
    }
  }

  // Parse as JSON with fenced-block fallback
  let raw: unknown;
  let parseSource: NormalizationStats["parseSource"] = "plain";
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    const match = text.match(/```json[\s\S]*?```/i) || text.match(/\[[\s\S]*\]/);
    if (match) {
      const cleaned = match[0]
        .replace(/^```json\n?/i, "")
        .replace(/```$/, "")
        .trim();
      raw = JSON.parse(cleaned) as unknown;
      parseSource = "fenced";
    } else {
      throw new Error("Failed to parse model response as JSON");
    }
  }

  const { actions, stats } = normalizeActionsAndStats(raw, includeExtras, parseSource);
  return { actions, raw, stats };
}

export function normalizeActions(raw: unknown, includeExtras: boolean = false): Action[] {
  return normalizeActionsAndStats(raw, includeExtras, "plain").actions;
}

function normalizeActionsAndStats(
  raw: unknown,
  includeExtras: boolean,
  parseSource: NormalizationStats["parseSource"],
): { actions: Action[]; stats: NormalizationStats } {
  if (!Array.isArray(raw))
    return {
      actions: [],
      stats: {
        rawSteps: 0,
        normalizedSteps: 0,
        filteredSteps: 0,
        droppedUnknownKeyCount: 0,
        preservedUnknownKeyCount: 0,
        parseSource,
      },
    };
  const sanitized: Action[] = [];
  let droppedUnknownKeyCount = 0;
  let preservedUnknownKeyCount = 0;
  let filteredSteps = 0;

  for (const item of raw as any[]) {
    if (!item) continue;

    // Accept multiple aliases for action
    const actionRaw: unknown = item.action || item.type || item.stepType;
    const action: string | undefined = typeof actionRaw === "string" ? actionRaw.toLowerCase().trim() : undefined;
    if (!action || !["navigate", "click", "type", "wait", "verify", "conditional", "select"].includes(action)) {
      filteredSteps++;
      continue;
    }

    // Target normalization: allow string or object or selector-only
    let target: Action["target"] | undefined = undefined;
    const t = item.target ?? item.element ?? item.selector ?? item.label;
    if (t) {
      if (typeof t === "string") {
        const d = cleanStr(t);
        if (d) target = { description: d };
      } else if (typeof t === "object") {
        const description = cleanStr(t.description || t.label || t.name || t.text);
        const visualContext = cleanStr(t.visualContext || t.location || t.position);
        const possibleSelectors: string[] | undefined = Array.isArray(t.possibleSelectors)
          ? (t.possibleSelectors
              .map((s: unknown) => cleanStr(typeof s === "string" ? s : String(s)))
              .filter((s: string | undefined): s is string => Boolean(s)))
          : (typeof t.selector === "string"
              ? (cleanStr(t.selector) ? [cleanStr(t.selector) as string] : undefined)
              : undefined);
        if (description || visualContext || (possibleSelectors && possibleSelectors.length)) {
          target = {
            ...(description ? { description } : {}),
            ...(visualContext ? { visualContext } : {}),
            ...(possibleSelectors && possibleSelectors.length ? { possibleSelectors } : {}),
          } as any;
        }
      }
    }

    // Value normalization
    const value: string | undefined = cleanStr(item.value || item.text || item.url || item.input);

    // Narration context normalization
    const narrationContext: string | undefined = cleanStr(
      item.narrationContext || item.context || item.note || item.explanation,
    );

    // Business logic normalization
    const businessLogic: string | undefined = cleanStr(item.businessLogic || item.reason || item.rationale);

    // Wait condition normalization: allow string or object under various keys
    let waitCondition: Action["waitCondition"] | undefined = undefined;
    const w = item.waitCondition || item.waitFor || item.wait || item.until;
    if (w) {
      if (typeof w === "string") {
        const d = cleanStr(w);
        if (d) waitCondition = { description: d };
      } else if (typeof w === "object") {
        const description = cleanStr(w.description || w.text || w.message);
        const visualCue = cleanStr(w.visualCue || w.cue || w.selector || w.signal);
        if (description || visualCue) {
          waitCondition = { ...(description ? { description } : {}), ...(visualCue ? { visualCue } : {}) };
        }
      }
    }

    // extras (lenient mode): collect top-level unknown keys not used above
    let extras: Record<string, unknown> | undefined;
    if (includeExtras && item && typeof item === "object") {
      const knownTopLevel = new Set([
        "action",
        "type",
        "stepType",
        "target",
        "element",
        "selector",
        "label",
        "value",
        "text",
        "url",
        "input",
        "narrationContext",
        "context",
        "note",
        "explanation",
        "businessLogic",
        "reason",
        "rationale",
        "waitCondition",
        "waitFor",
        "wait",
        "until",
        "confidence",
        "alternatives",
        "notes",
        "branches",
      ]);
      for (const [key, val] of Object.entries(item as Record<string, unknown>)) {
        if (!knownTopLevel.has(key)) {
          extras = extras || {};
          extras[key] = val;
          preservedUnknownKeyCount++;
        }
      }
    } else if (item && typeof item === "object") {
      const knownTopLevel = new Set([
        "action",
        "type",
        "stepType",
        "target",
        "element",
        "selector",
        "label",
        "value",
        "text",
        "url",
        "input",
        "narrationContext",
        "context",
        "note",
        "explanation",
        "businessLogic",
        "reason",
        "rationale",
        "waitCondition",
        "waitFor",
        "wait",
        "until",
        "confidence",
        "alternatives",
        "notes",
        "branches",
      ]);
      for (const key of Object.keys(item as Record<string, unknown>)) {
        if (!knownTopLevel.has(key)) {
          droppedUnknownKeyCount++;
        }
      }
    }

    sanitized.push({
      action: action as Action["action"],
      ...(target ? { target } : {}),
      ...(value ? { value } : {}),
      ...(narrationContext ? { narrationContext } : {}),
      ...(businessLogic ? { businessLogic } : {}),
      ...(waitCondition ? { waitCondition } : {}),
      ...(includeExtras && extras ? { extras } : {}),
    });
  }

  return {
    actions: sanitized,
    stats: {
      rawSteps: Array.isArray(raw) ? raw.length : 0,
      normalizedSteps: sanitized.length,
      filteredSteps,
      droppedUnknownKeyCount,
      preservedUnknownKeyCount,
      parseSource,
    },
  };
}

function cleanStr(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const lowered = trimmed.toLowerCase();
  if (lowered === "null" || lowered === "undefined" || lowered === "n/a") return undefined;
  return trimmed;
}

// New: simple text generation path used by the simplified preset flow.
export async function generateTextWithVideo(file: File, promptText: string): Promise<string> {
  function inferMimeTypeFromName(name?: string): string | undefined {
    if (!name) return undefined;
    const lower = name.toLowerCase();
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".webm")) return "video/webm";
    return undefined;
  }

  const fileName: string | undefined = (file as unknown as { name?: string }).name;
  const uploadMime =
    file.type && file.type !== "application/octet-stream"
      ? file.type
      : inferMimeTypeFromName(fileName) || "video/mp4";

  const uploaded = (await withRetry(() =>
    getAI().files.upload({
      file,
      config: { mimeType: uploadMime },
    }),
  )) as UploadResponseMeta;

  const uploadedAny = uploaded as unknown as { file?: FileMeta } & FileMeta;
  const uploadedFile: FileMeta | undefined = uploadedAny.file ?? {
    name: uploadedAny.name,
    uri: uploadedAny.uri,
    mimeType: uploadedAny.mimeType,
  };

  let fileUri: string | undefined = uploadedFile?.uri;
  let fileMime: string | undefined =
    uploadedFile?.mimeType && uploadedFile.mimeType !== "application/octet-stream"
      ? uploadedFile.mimeType
      : file.type && file.type !== "application/octet-stream"
        ? file.type
        : inferMimeTypeFromName(uploadedFile?.name || (file as unknown as { name?: string }).name) || undefined;
  if (!fileMime) fileMime = "video/mp4";

  const uploadedName = uploadedFile?.name;
  if (uploadedName) {
    for (let attempts = 0; attempts < 60; attempts++) {
      const fetched = (await withRetry(() => getAI().files.get({ name: uploadedName }))) as UploadResponseMeta | FileMeta;
      const fetchedFile: FileMeta = (fetched as UploadResponseMeta).file ?? (fetched as FileMeta);
      fileUri = fetchedFile?.uri ?? fileUri;
      fileMime =
        fetchedFile?.mimeType && fetchedFile.mimeType !== "application/octet-stream"
          ? fetchedFile.mimeType
          : fileMime;
      if (fetchedFile?.state === "ACTIVE" && fileUri) break;
      if (fetchedFile?.state === "FAILED" || fetchedFile?.state === "DELETED") {
        throw new Error(`Uploaded file state ${fetchedFile.state}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!fileUri || !fileMime) {
    throw new Error("Uploaded file missing uri or mimeType");
  }

  const effectiveMime =
    fileMime === "application/octet-stream" ? inferMimeTypeFromName(uploadedFile?.name) || "video/mp4" : fileMime;
  const requestContents = createUserContent([
    createPartFromUri(fileUri as string, effectiveMime as string),
    promptText,
  ]);

  const response = await withRetry(() =>
    getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: requestContents,
    }),
  );

  // Extract text across SDK variants
  let text: string = "";
  const maybeTextFunc = (response as unknown as { text?: (() => string) | string }).text;
  if (typeof maybeTextFunc === "function") {
    text = maybeTextFunc();
  } else if (typeof maybeTextFunc === "string") {
    text = maybeTextFunc;
  } else {
    type Part = { text?: string };
    type Candidate = { content?: { parts?: Part[] } };
    const candidates = (response as unknown as { candidates?: Candidate[] }).candidates;
    if (Array.isArray(candidates)) {
      const parts: Part[] = candidates[0]?.content?.parts ?? [];
      const firstText = parts.find((p) => typeof p?.text === "string");
      if (firstText?.text) text = firstText.text;
    }
  }
  return text;
}

// --------------------
// Generators/Deciders/IRV Orchestration
// --------------------

// Friendly agent name helpers
const G_NAMES = [
  "Gary",
  "Glenda",
  "Gina",
  "Gavin",
  "Gerrit",
  "Grace",
  "Gordon",
  "Georgia",
  "Gretchen",
  "Gil",
  "Giselle",
] as const;
const D_NAMES = [
  "Danny",
  "Diana",
  "Derek",
  "Darla",
  "Diego",
  "Daphne",
  "Dillon",
  "Daisy",
  "Dominic",
  "Denise",
] as const;

function agentNameFrom(list: readonly string[], index: number): string {
  const base = list[index % list.length];
  if (index < list.length) return base;
  const cycle = Math.floor(index / list.length) + 1;
  return `${base}-${cycle}`;
}

function buildAgentNames(list: readonly string[], count: number, rotateOffset: number): string[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const base = Array.from({ length: n }, (_, i) => agentNameFrom(list, i));
  const off = ((rotateOffset % n) + n) % n;
  return base.map((_, i) => base[(off + i) % n]);
}

export async function uploadVideoAndResolveUri(
  file: File,
): Promise<{ fileUri: string; mimeType: string }> {
  function inferMimeTypeFromName(name?: string): string | undefined {
    if (!name) return undefined;
    const lower = name.toLowerCase();
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".webm")) return "video/webm";
    return undefined;
  }

  const fileName: string | undefined = (file as unknown as { name?: string }).name;
  const uploadMime =
    file.type && file.type !== "application/octet-stream"
      ? file.type
      : inferMimeTypeFromName(fileName) || "video/mp4";

  const uploaded = (await withRetry(() =>
    getAI().files.upload({
      file,
      config: { mimeType: uploadMime },
    }),
  2, 800)) as UploadResponseMeta; // single retry

  const uploadedAny = uploaded as unknown as { file?: FileMeta } & FileMeta;
  const uploadedFile: FileMeta | undefined = uploadedAny.file ?? {
    name: uploadedAny.name,
    uri: uploadedAny.uri,
    mimeType: uploadedAny.mimeType,
  };

  let fileUri: string | undefined = uploadedFile?.uri;
  let fileMime: string | undefined =
    uploadedFile?.mimeType && uploadedFile.mimeType !== "application/octet-stream"
      ? uploadedFile.mimeType
      : file.type && file.type !== "application/octet-stream"
        ? file.type
        : inferMimeTypeFromName(uploadedFile?.name || (file as unknown as { name?: string }).name) || undefined;
  if (!fileMime) fileMime = "video/mp4";

  const uploadedName = uploadedFile?.name;
  if (uploadedName) {
    for (let attempts = 0; attempts < 60; attempts++) {
      const fetched = (await withRetry(() =>
        getAI().files.get({ name: uploadedName }),
      2, 800)) as UploadResponseMeta | FileMeta;
      const fetchedFile: FileMeta = (fetched as UploadResponseMeta).file ?? (fetched as FileMeta);
      fileUri = fetchedFile?.uri ?? fileUri;
      fileMime =
        fetchedFile?.mimeType && fetchedFile.mimeType !== "application/octet-stream"
          ? fetchedFile.mimeType
          : fileMime;
      if (fetchedFile?.state === "ACTIVE" && fileUri) break;
      if (fetchedFile?.state === "FAILED" || fetchedFile?.state === "DELETED") {
        throw new Error(`Uploaded file state ${fetchedFile.state}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!fileUri || !fileMime) {
    throw new Error("Uploaded file missing uri or mimeType");
  }
  const effectiveMime =
    fileMime === "application/octet-stream" ? inferMimeTypeFromName(uploadedFile?.name) || "video/mp4" : fileMime;
  return { fileUri: fileUri as string, mimeType: effectiveMime as string };
}

export async function generateFreeformWithUploadedVideo(
  fileUri: string,
  mimeType: string,
  promptText: string,
  options?: { temperature?: number; maxOutputTokens?: number; model?: string },
): Promise<string> {
  const requestContents = createUserContent([
    createPartFromUri(fileUri as string, mimeType as string),
    promptText,
  ]);
  const model = options?.model || "gemini-2.5-flash";
  const response = await withRetry(() => getAI().models.generateContent({
    model,
    contents: requestContents,
    ...(options?.temperature || options?.maxOutputTokens
      ? { generationConfig: { temperature: options?.temperature, maxOutputTokens: options?.maxOutputTokens } }
      : {}),
  }), 2, 800);

  let text: string = "";
  const maybeTextFunc = (response as unknown as { text?: (() => string) | string }).text;
  if (typeof maybeTextFunc === "function") {
    text = maybeTextFunc();
  } else if (typeof maybeTextFunc === "string") {
    text = maybeTextFunc;
  } else {
    type Part = { text?: string };
    type Candidate = { content?: { parts?: Part[] } };
    const candidates = (response as unknown as { candidates?: Candidate[] }).candidates;
    if (Array.isArray(candidates)) {
      const parts: Part[] = candidates[0]?.content?.parts ?? [];
      const firstText = parts.find((p) => typeof p?.text === "string");
      if (firstText?.text) text = firstText.text;
    }
  }
  return text;
}

export async function runGenerators(
  file: File,
  promptText: string,
  options?: { generators?: number; temperature?: number; maxOutputTokens?: number; model?: string; runId?: string },
): Promise<GeneratorOutput[]> {
  const N = Math.max(1, Math.min(Number(options?.generators ?? 5), 10));
  const { fileUri, mimeType } = await uploadVideoAndResolveUri(file);
  console.info("runGenerators: starting", { N, model: options?.model || "gemini-2.5-flash" });
  const generatorNames = buildAgentNames(G_NAMES, N, Math.floor(Date.now() / 1000) % N);
  appendLog(options?.runId, "generators", "start", "Starting generators", { N, model: options?.model || "gemini-2.5-flash", generators: generatorNames });
  const tasks = Array.from({ length: N }).map((_, index) =>
    generateFreeformWithUploadedVideo(fileUri, mimeType, promptText, options)
      .then((text) => {
        appendLog(options?.runId, "generators", "generator_done", `Generator ${generatorNames[index]} completed`, { index, name: generatorNames[index], length: text.length });
        return { index, text } as GeneratorOutput;
      })
      .catch((err) => {
        appendLog(options?.runId, "error", "generator_error", `Generator ${generatorNames[index]} failed`, { index, name: generatorNames[index], message: err instanceof Error ? err.message : String(err) });
        throw err;
      }),
  );
  // Single retry semantics handled inside generateFreeformWithUploadedVideo via withRetry(2)
  const results = await Promise.all(tasks);
  console.info("runGenerators: completed");
  appendLog(options?.runId, "generators", "complete", "All generators completed", { N, generators: generatorNames });
  return results;
}

function parseJsonOrFenced(input: string): any {
  try {
    return JSON.parse(input);
  } catch {
    const match = input.match(/```json[\s\S]*?```/i) || input.match(/\{[\s\S]*\}/);
    if (match) {
      const cleaned = match[0].replace(/^```json\n?/i, "").replace(/```$/, "").trim();
      return JSON.parse(cleaned);
    }
    throw new Error("Failed to parse JSON from model response");
  }
}

export async function decideOnce(
  originalPrompt: string,
  candidates: GeneratorOutput[],
  options?: { model?: string; timeoutMs?: number },
): Promise<DeciderVote> {
  // Shuffle presentation order but keep canonical indices in brackets so no remap needed
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const prompt = buildDeciderPrompt(originalPrompt, shuffled.map((c) => ({ index: c.index, text: c.text })));
  const model = options?.model || "gemini-2.5-flash";
  const response = await withRetry(
    () => getAI().models.generateContent({ model, contents: createUserContent([prompt]) }),
    2,
    800,
  );
  let text: string = "";
  const maybeTextFunc = (response as unknown as { text?: (() => string) | string }).text;
  if (typeof maybeTextFunc === "function") {
    text = maybeTextFunc();
  } else if (typeof maybeTextFunc === "string") {
    text = maybeTextFunc;
  } else {
    type Part = { text?: string };
    type Candidate = { content?: { parts?: Part[] } };
    const candidatesResp = (response as unknown as { candidates?: Candidate[] }).candidates;
    if (Array.isArray(candidatesResp)) {
      const parts: Part[] = candidatesResp[0]?.content?.parts ?? [];
      const firstText = parts.find((p) => typeof p?.text === "string");
      if (firstText?.text) text = firstText.text;
    }
  }
  let parsed: { ranking?: number[]; perCandidate?: { index: number; strengths?: string[]; issues?: string[] }[] } | undefined;
  try {
    parsed = parseJsonOrFenced(text) as { ranking?: number[]; perCandidate?: { index: number; strengths?: string[]; issues?: string[] }[] };
  } catch {
    // Malformed JSON from decider; treat as empty ballot rather than throw
    parsed = { ranking: [], perCandidate: [] };
  }
  const ranking = Array.isArray(parsed?.ranking) ? parsed.ranking.filter((v) => Number.isInteger(v)) : [];
  // Sanitize ranking: de-duplicate and keep order
  const seen = new Set<number>();
  const cleanedRanking = ranking.filter((idx) => {
    if (seen.has(idx)) return false;
    seen.add(idx);
    return true;
  });
  const perCandidate = Array.isArray(parsed?.perCandidate)
    ? parsed.perCandidate.map((pc) => ({ index: pc.index, strengths: pc.strengths || [], issues: pc.issues || [] }))
    : [];
  return { ranking: cleanedRanking, perCandidate } as DeciderVote;
}

export async function runDeciders(
  originalPrompt: string,
  candidates: GeneratorOutput[],
  options?: { deciders?: number; model?: string; runId?: string },
): Promise<DeciderVote[]> {
  const K = Math.max(1, Math.min(Number(options?.deciders ?? 3), 7));
  console.info("runDeciders: starting", { K, model: options?.model || "gemini-2.5-flash" });
  const deciderNames = buildAgentNames(D_NAMES, K, (Math.floor(Date.now() / 1000) + 7) % K);
  appendLog(options?.runId, "deciders", "start", "Starting deciders", { K, model: options?.model || "gemini-2.5-flash", deciders: deciderNames });
  const tasks = Array.from({ length: K }).map((_, j) =>
    decideOnce(originalPrompt, candidates, { model: options?.model })
      .then((vote) => {
        appendLog(options?.runId, "deciders", "vote", `Decider ${deciderNames[j]} returned ranking`, { j, name: deciderNames[j], ranking: vote.ranking });
        return { status: "fulfilled" as const, value: vote };
      })
      .catch((err) => {
        appendLog(options?.runId, "error", "decider_error", `Decider ${deciderNames[j]} failed`, { j, name: deciderNames[j], message: err instanceof Error ? err.message : String(err) });
        return { status: "rejected" as const, reason: err };
      }),
  );
  const settled = await Promise.all(tasks);
  const votes = settled.filter((s) => s.status === "fulfilled").map((s) => (s as { status: "fulfilled"; value: DeciderVote }).value);
  console.info("runDeciders: completed");
  appendLog(options?.runId, "deciders", "complete", "All deciders completed", { K, deciders: deciderNames });
  return votes;
}

export function aggregateIRV(
  candidates: GeneratorOutput[],
  votes: DeciderVote[],
): AggregateDecision {
  const N = candidates.length;
  const acceptableCounts = new Array<number>(N).fill(0);
  for (const v of votes) {
    for (const idx of v.ranking) {
      if (idx >= 0 && idx < N) acceptableCounts[idx]++;
    }
  }
  const maxAccept = Math.max(0, ...acceptableCounts);
  if (maxAccept === 0) {
    return {
      hasAnyAcceptable: false,
      acceptableCounts,
      winnerIndex: null,
      wasTieBroken: false,
      rationale: ["No candidate received any acceptability rankings"],
    };
  }
  const eligible = new Set<number>();
  for (let i = 0; i < N; i++) if (acceptableCounts[i] >= 2) eligible.add(i);
  if (eligible.size === 0) {
    return {
      hasAnyAcceptable: true,
      acceptableCounts,
      winnerIndex: null,
      wasTieBroken: false,
      rationale: ["No candidate reached acceptability threshold (>=2 deciders)"],
    };
  }
  // Prepare ballots restricted to eligible set
  const ballots = votes.map((v) => v.ranking.filter((idx) => eligible.has(idx)));
  const current = new Set<number>(eligible);
  let wasTieBroken = false;
  while (current.size > 1) {
    const counts = new Map<number, number>();
    for (const idx of current) counts.set(idx, 0);
    for (const b of ballots) {
      const first = b.find((idx) => current.has(idx));
      if (first !== undefined) counts.set(first, (counts.get(first) || 0) + 1);
    }
    const totalVotes = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    // Majority check
    for (const [idx, c] of counts.entries()) {
      if (c > totalVotes / 2) {
        return {
          hasAnyAcceptable: true,
          acceptableCounts,
          winnerIndex: idx,
          wasTieBroken,
          rationale: ["Winner achieved strict majority in IRV round"],
        };
      }
    }
    // Find min count and eliminate lowest-index among ties
    let minCount = Infinity;
    for (const c of counts.values()) minCount = Math.min(minCount, c);
    const lowest = Array.from(counts.entries())
      .filter(([, c]) => c === minCount)
      .map(([idx]) => idx)
      .sort((a, b) => a - b)[0];
    current.delete(lowest);
    if (current.size === 1) break;
  }
  const remaining = Array.from(current.values()).sort((a, b) => a - b);
  const winnerIndex = remaining.length > 0 ? remaining[0] : null;
  if (remaining.length > 1) wasTieBroken = true;
  return {
    hasAnyAcceptable: true,
    acceptableCounts,
    winnerIndex,
    wasTieBroken,
    rationale: [remaining.length > 1 ? "Tie broken by lowest index" : "Winner by elimination without majority"],
  };
}

export async function analyzeWithIRV(
  file: File,
  originalPrompt: string,
  opts?: { generators?: number; deciders?: number; generatorModel?: string; deciderModel?: string; temperature?: number; maxOutputTokens?: number; runId?: string },
): Promise<
  | {
      type: "success";
      data: {
        prompt: string;
        candidates: GeneratorOutput[];
        generatorNames: string[];
        averageRankings: { index: number; name: string; avg: number | null; votes: number }[];
        meta: AggregateDecision & { chosenIndex: number; deciderRankingSnapshots: number[][] };
      };
    }
  | {
      type: "fallback";
      data: {
        prompt: string;
        candidates: GeneratorOutput[];
        generatorNames: string[];
        averageRankings: { index: number; name: string; avg: number | null; votes: number }[];
        meta: { acceptableCounts: number[]; deciderRankingSnapshots: number[][]; reason: string };
      };
    }
> {
  const start = Date.now();
  appendLog(opts?.runId, "init", "pipeline_start", "Pipeline started");
  const gens = await runGenerators(file, originalPrompt, {
    generators: opts?.generators,
    temperature: opts?.temperature ?? 0.45,
    maxOutputTokens: opts?.maxOutputTokens ?? 3000,
    model: opts?.generatorModel || "gemini-2.5-flash",
    runId: opts?.runId,
  });
  const votes = await runDeciders(originalPrompt, gens, { deciders: opts?.deciders, model: opts?.deciderModel || "gemini-2.5-flash", runId: opts?.runId });
  const deciderRankingSnapshots = votes.map((v) => v.ranking);
  appendLog(opts?.runId, "aggregation", "snapshots", "Collected decider rankings", { deciderRankingSnapshots });
  const agg = aggregateIRV(gens, votes);
  const elapsedMs = Date.now() - start;
  console.info("analyzeWithIRV: aggregation", { elapsedMs, winnerIndex: agg.winnerIndex, acceptableCounts: agg.acceptableCounts });
  appendLog(opts?.runId, "aggregation", "acceptable_counts", "Computed acceptable counts", { acceptableCounts: agg.acceptableCounts });
  if (agg.winnerIndex !== null) {
    appendLog(opts?.runId, "aggregation", "winner", "Winner selected", { winnerIndex: agg.winnerIndex });
  } else {
    appendLog(opts?.runId, "aggregation", "no_winner", "No winner selected; will fallback");
  }
  if (agg.winnerIndex !== null) {
    const chosen = gens.find((g) => g.index === agg.winnerIndex)!;
    appendLog(opts?.runId, "result", "success_meta", "Preparing success response", { elapsedMs });
    // Final friendly summary event and structured data for client downloads
    let generatorNames: string[] = [];
    let averageRankings: { index: number; name: string; avg: number | null; votes: number }[] = [];
    try {
      const N = gens.length;
      generatorNames = Array.from({ length: N }).map((_, i) => agentNameFrom(G_NAMES, i));
      // Build decider name list from count of snapshots
      const K = deciderRankingSnapshots.length;
      const deciderNames = Array.from({ length: K }).map((_, j) => agentNameFrom(D_NAMES, j));
      const deciderSummaries = deciderRankingSnapshots.map((ranking, j) => {
        const name = deciderNames[j];
        const ordered = ranking.map((idx) => generatorNames[idx]);
        const rankedLabel = ordered.join(", ");
        const unrankedNames = generatorNames.filter((_, idx) => !ranking.includes(idx));
        return `${name}: ${rankedLabel || "(no acceptable)"}${unrankedNames.length ? `; Unranked: ${unrankedNames.join(", ")}` : ""}`;
      });
      // Compute average rank per generator across ballots that include it
      const sumRanks: number[] = Array.from({ length: N }, () => 0);
      const countRanks: number[] = Array.from({ length: N }, () => 0);
      for (const r of deciderRankingSnapshots) {
        r.forEach((idx, pos) => {
          if (idx >= 0 && idx < N) {
            sumRanks[idx] += pos + 1; // 1-based for readability
            countRanks[idx] += 1;
          }
        });
      }
      const avgRankingsRaw = generatorNames.map((name, idx) => ({
        index: idx,
        name,
        avg: countRanks[idx] ? sumRanks[idx] / countRanks[idx] : null,
        votes: countRanks[idx],
      }));
      // Keep original index association; sorting only for summary string
      const avgRankingsSorted = [...avgRankingsRaw].sort((a, b) => {
        if (a.avg === null && b.avg === null) return 0;
        if (a.avg === null) return 1;
        if (b.avg === null) return -1;
        return a.avg - b.avg;
      });
      const avgSummary = avgRankingsSorted
        .map((r) => `${r.name}: ${r.avg === null ? "—" : r.avg.toFixed(2)} (${r.votes} votes)`) 
        .join("; ");
      appendLog(opts?.runId, "result", "summary", "Summary of decider rankings and averages", {
        winner: generatorNames[agg.winnerIndex],
        deciders: deciderSummaries,
        averages: avgSummary,
      });
      averageRankings = avgRankingsRaw;
    } catch {
      // ignore summary errors
    }
    // Provide all candidates and ranking data to the client for downloads
    const candidates = [...gens].sort((a, b) => a.index - b.index);
    return {
      type: "success",
      data: {
        prompt: chosen.text,
        candidates,
        generatorNames,
        averageRankings,
        meta: {
          ...agg,
          chosenIndex: agg.winnerIndex,
          deciderRankingSnapshots,
        },
      },
    };
  }
  // Fallback: concatenate outputs with simple dividers
  const divider = "\n\n==============================\n\n";
  const concatenated = gens
    .sort((a, b) => a.index - b.index)
    .map((g) => `Candidate [${g.index}]\n\n${g.text}`)
    .join(divider);
  appendLog(opts?.runId, "result", "fallback_meta", "Preparing fallback response", { elapsedMs });
  // Prepare names and average rankings for the fallback as well
  let generatorNames: string[] = [];
  let averageRankings: { index: number; name: string; avg: number | null; votes: number }[] = [];
  try {
    const N = gens.length;
    generatorNames = Array.from({ length: N }).map((_, i) => agentNameFrom(G_NAMES, i));
    const sumRanks: number[] = Array.from({ length: N }, () => 0);
    const countRanks: number[] = Array.from({ length: N }, () => 0);
    for (const r of deciderRankingSnapshots) {
      r.forEach((idx, pos) => {
        if (idx >= 0 && idx < N) {
          sumRanks[idx] += pos + 1;
          countRanks[idx] += 1;
        }
      });
    }
    averageRankings = generatorNames.map((name, idx) => ({
      index: idx,
      name,
      avg: countRanks[idx] ? sumRanks[idx] / countRanks[idx] : null,
      votes: countRanks[idx],
    }));
  } catch {
    // ignore
  }
  const candidates = [...gens].sort((a, b) => a.index - b.index);
  return {
    type: "fallback",
    data: {
      prompt: concatenated,
      candidates,
      generatorNames,
      averageRankings,
      meta: {
        acceptableCounts: agg.acceptableCounts,
        deciderRankingSnapshots,
        reason: agg.hasAnyAcceptable ? "No consensus among eligible candidates" : "No acceptable candidates",
      },
    },
  };
}


