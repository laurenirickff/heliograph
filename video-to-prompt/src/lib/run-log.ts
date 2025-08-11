/*
  In-memory activity log for analysis runs. Designed to be lightweight and survive
  Next.js dev hot-reloads by storing the singleton on globalThis.
*/

export type ActivityPhase =
  | "init"
  | "upload"
  | "generators"
  | "evaluators"
  | "aggregation"
  | "result"
  | "error";

export type ActivityEvent = {
  timestamp: number;
  phase: ActivityPhase;
  type: string;
  message: string;
  data?: Record<string, unknown>;
};

type Subscriber = (event: ActivityEvent) => void;

type RunLogRecord = {
  events: ActivityEvent[];
  subscribers: Set<Subscriber>;
  lastAccessTs: number;
};

class InMemoryRunLog {
  private runs: Map<string, RunLogRecord> = new Map();
  private readonly maxEventsPerRun = 500;
  private readonly ttlMs = 30 * 60 * 1000; // 30 minutes

  private getOrCreate(runId: string): RunLogRecord {
    let rec = this.runs.get(runId);
    if (!rec) {
      rec = { events: [], subscribers: new Set(), lastAccessTs: Date.now() };
      this.runs.set(runId, rec);
    }
    rec.lastAccessTs = Date.now();
    return rec;
  }

  append(runId: string, event: ActivityEvent): void {
    if (!runId) return;
    const rec = this.getOrCreate(runId);
    rec.events.push(event);
    if (rec.events.length > this.maxEventsPerRun) {
      rec.events.splice(0, rec.events.length - this.maxEventsPerRun);
    }
    for (const sub of rec.subscribers) {
      try {
        sub(event);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  snapshot(runId: string): ActivityEvent[] {
    if (!runId) return [];
    const rec = this.getOrCreate(runId);
    return rec.events.slice();
  }

  subscribe(runId: string, subscriber: Subscriber): () => void {
    const rec = this.getOrCreate(runId);
    rec.subscribers.add(subscriber);
    return () => {
      rec.subscribers.delete(subscriber);
      rec.lastAccessTs = Date.now();
    };
  }

  cleanupExpired(): void {
    const now = Date.now();
    for (const [runId, rec] of this.runs.entries()) {
      if (rec.subscribers.size > 0) continue;
      if (now - rec.lastAccessTs > this.ttlMs) {
        this.runs.delete(runId);
      }
    }
  }
}

// Ensure a single instance across hot reloads
const globalKey = "__INMEM_RUN_LOG__" as const;
declare const global: typeof globalThis & { [globalKey]?: InMemoryRunLog };

export const runLog: InMemoryRunLog = (global[globalKey] ||= new InMemoryRunLog());

// Helper to append an event with convenience defaults
export function appendLog(
  runId: string | undefined,
  phase: ActivityPhase,
  type: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!runId) return;
  runLog.append(runId, {
    timestamp: Date.now(),
    phase,
    type,
    message,
    data,
  });
}


