import type { NextRequest } from "next/server";
import { runLog, ActivityEvent } from "@/lib/run-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toSse(event: ActivityEvent): string {
  // Keep payload compact; stringify once
  const data = JSON.stringify(event);
  return `data: ${data}\n\n`;
}

export async function GET(
  _req: NextRequest,
  context: unknown,
) {
  const params = (typeof context === "object" && context && "params" in (context as Record<string, unknown>))
    ? ((context as { params?: { runId?: string } }).params || {})
    : {};
  const runId = params.runId || "";
  if (!runId) {
    return new Response("Missing runId", { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      // Initial snapshot
      const snapshot = runLog.snapshot(runId);
      if (snapshot.length) {
        const buf = encoder.encode(snapshot.map(toSse).join(""));
        controller.enqueue(buf);
      }

      // Keep-alive every 25s
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(":ok\n\n"));
      }, 25000);

      // Live subscription
      const unsubscribe = runLog.subscribe(runId, (event) => {
        controller.enqueue(encoder.encode(toSse(event)));
      });

      // Cleanup on cancel
      controller.enqueue(encoder.encode(":stream-start\n\n"));
      controller.enqueue(encoder.encode(`event: ready\ndata: {"ok":true}\n\n`));
      (controller as unknown as { _cleanup?: () => void })._cleanup = () => {
        clearInterval(keepAlive);
        unsubscribe();
        runLog.cleanupExpired();
      };
    },
    cancel() {
      // Will be handled by _cleanup on close
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // disable buffering on some proxies
    },
  });
}


