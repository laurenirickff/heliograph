import type { NextRequest } from "next/server";
import { appendLog, ActivityPhase } from "@/lib/run-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, context: unknown) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  const params = (typeof context === "object" && context && "params" in (context as Record<string, unknown>))
    ? ((context as { params?: { runId?: string } }).params || {})
    : {};
  const runId = params.runId || "";
  if (!runId) return new Response("Missing runId", { status: 400 });
  try {
    type BodyPayload = {
      phase?: ActivityPhase;
      type?: string;
      message?: string;
      data?: Record<string, unknown>;
    };

    let body: BodyPayload = {} as BodyPayload;
    try {
      body = (await req.json()) as BodyPayload;
    } catch {
      body = {} as BodyPayload;
    }

    const phase: ActivityPhase = body.phase ?? "init";
    const type: string = body.type ?? "dev_emit";
    const message: string = body.message ?? "dev test event";
    const data = body.data;
    appendLog(runId, phase, type, message, data);
    return Response.json({ ok: true });
  } catch (err) {
    return new Response((err as Error).message, { status: 400 });
  }
}


