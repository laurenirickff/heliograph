import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import { Action } from "./types";
import { EXTRACTION_PROMPT_STRICT } from "./prompts";

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

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is required. Set it in .env.local and restart the dev server.",
  );
}
const ai = new GoogleGenAI({ apiKey });

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
    ai.files.upload({
      file,
      config: { mimeType: uploadMime },
    }),
  )) as UploadResponseMeta;
  console.debug("Gemini upload response (truncated)", {
    hasFile: Boolean((uploaded as any)?.file || (uploaded as any)?.uri),
    name: (uploaded as any)?.file?.name ?? (uploaded as any)?.name,
    mimeType: (uploaded as any)?.file?.mimeType ?? (uploaded as any)?.mimeType,
    uriPresent: Boolean((uploaded as any)?.file?.uri ?? (uploaded as any)?.uri),
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
        ai.files.get({ name: uploadedName }),
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
    ai.models.generateContent({
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
    ai.files.upload({
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
        ai.files.get({ name: uploadedName }),
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
    ai.models.generateContent({
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
    ai.files.upload({
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
      const fetched = (await withRetry(() => ai.files.get({ name: uploadedName }))) as UploadResponseMeta | FileMeta;
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
    ai.models.generateContent({
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


