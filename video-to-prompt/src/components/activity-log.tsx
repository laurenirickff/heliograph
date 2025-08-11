"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityEvent } from "@/lib/run-log";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

type Props = {
  runId: string;
  initial?: ActivityEvent[];
  collapsedByDefault?: boolean;
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ActivityLog({ runId, initial = [], collapsedByDefault = false }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>(initial);
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const esRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Start SSE subscription
    const url = `/api/logs/${encodeURIComponent(runId)}/stream`;
    const es = new EventSource(url);
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as ActivityEvent;
        setEvents((prev) => [...prev, data]);
      } catch {
        // ignore keep-alives and malformed lines
      }
    };
    es.onerror = () => {
      // Browser will auto-reconnect; no-op
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [runId]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const rows = useMemo(() => {
    // Derive simple progress context
    let totalGenerators = 0;
    let totalDeciders = 0;
    let completedGenerators = 0; // derived via seenGen
    let completedDeciders = 0; // derived via seenDec
    const seenGen: Set<number> = new Set();
    const seenDec: Set<number> = new Set();

    const derived = events.map((e) => ({ e }));
    // Capture name lists if provided
    let generatorNames: string[] | null = null;
    let deciderNames: string[] | null = null;
    for (const { e } of derived) {
      if (e.phase === "generators" && e.type === "start") totalGenerators = (e.data?.N as number) || totalGenerators;
      if (e.phase === "deciders" && e.type === "start") totalDeciders = (e.data?.K as number) || totalDeciders;
      if (
        e.phase === "generators" &&
        e.type === "start"
      ) {
        const d = e.data as Record<string, unknown> | undefined;
        const gens = d?.generators as unknown;
        if (Array.isArray(gens)) generatorNames = (gens as unknown[]).map((v) => String(v));
      }
      if (
        e.phase === "deciders" &&
        e.type === "start" &&
        Array.isArray((e.data as Record<string, unknown>)?.deciders as unknown[])
      ) {
        deciderNames = (e.data as Record<string, unknown>).deciders as string[];
      }
      if (e.phase === "generators" && e.type === "generator_done") {
        const idx = Number(e.data?.index);
        if (!Number.isNaN(idx) && !seenGen.has(idx)) {
          seenGen.add(idx);
          completedGenerators = seenGen.size;
        }
      }
      if (e.phase === "deciders" && e.type === "vote") {
        const j = Number(e.data?.j);
        if (!Number.isNaN(j) && !seenDec.has(j)) {
          seenDec.add(j);
          completedDeciders = seenDec.size;
        }
      }
    }

    const renderRanking = (arr: unknown): string | null => {
      if (!Array.isArray(arr)) return null;
      const nums = arr.filter((x) => typeof x === "number") as number[];
      if (!nums.length) return null;
      if (generatorNames) {
        const names = nums.map((idx) => (generatorNames as string[])[idx] ?? String(idx));
        return names.join(" > ");
      }
      return nums.join(" > ");
    };

    const renderAcceptableCounts = (arr: unknown): string | null => {
      if (!Array.isArray(arr)) return null;
      const nums = arr.filter((x) => typeof x === "number") as number[];
      if (!nums.length) return null;
      return nums.map((c, i) => `${i}:${c}`).join("  ");
    };

    const toggle = (idx: number) => setExpanded((m) => ({ ...m, [idx]: !m[idx] }));

    return events.map((e, idx) => {
      let message = e.message;
      let details: string | null = null;
      if (e.phase === "generators" && e.type === "start") {
        const n = e.data?.N as number | undefined;
        const model = e.data?.model as string | undefined;
        const d = e.data as Record<string, unknown> | undefined;
        const gensVal = d?.generators as unknown;
        const list = Array.isArray(gensVal) ? (gensVal as unknown[]).map((v) => String(v)).join(", ") : null;
        message = `Starting ${n ?? "?"} generators${model ? ` (${model})` : ""}${list ? ` — ${list}` : ""}`;
      } else if (e.phase === "generators" && e.type === "generator_done") {
        const n = totalGenerators || (e.data?.N as number | undefined) || 0;
        const index = e.data?.index as number | undefined;
        const name = (e.data as Record<string, unknown>)?.name as string | undefined;
        const len = e.data?.length as number | undefined;
        message = `Generator ${name ?? index ?? "?"} completed (${seenGen.size}/${n})${typeof len === "number" ? `, ${len} chars` : ""}`;
      } else if (e.phase === "deciders" && e.type === "start") {
        const k = e.data?.K as number | undefined;
        const model = e.data?.model as string | undefined;
        const d = e.data as Record<string, unknown> | undefined;
        const decsVal = d?.deciders as unknown;
        const list = Array.isArray(decsVal) ? (decsVal as unknown[]).map((v) => String(v)).join(", ") : null;
        message = `Starting ${k ?? "?"} deciders${model ? ` (${model})` : ""}${list ? ` — ${list}` : ""}`;
      } else if (e.phase === "deciders" && e.type === "vote") {
        const j = e.data?.j as number | undefined;
        const decName = (e.data as Record<string, unknown>)?.name as string | undefined;
        const r = renderRanking(e.data?.ranking);
        message = `Decider ${decName ?? j ?? "?"} ranking${r ? ": " + r : " returned"} (${seenDec.size}/${totalDeciders || "?"})`;
      } else if (e.phase === "aggregation" && e.type === "acceptable_counts") {
        const r = renderAcceptableCounts(e.data?.acceptableCounts);
        message = `Acceptable counts${r ? ": " + r : " computed"}`;
      } else if (e.phase === "aggregation" && e.type === "winner") {
        const w = e.data?.winnerIndex as number | undefined;
        const wName = typeof w === "number" && generatorNames ? generatorNames[w] : undefined;
        message = `Winner selected: ${wName ?? (typeof w === "number" ? `candidate ${w}` : "?")}`;
      } else if (e.phase === "aggregation" && e.type === "snapshots") {
        const snaps = e.data?.deciderRankingSnapshots as unknown;
        const lines = Array.isArray(snaps) ? snaps.map((r, i) => `D${i}: ${renderRanking(r) ?? ""}`).join("\n") : null;
        details = lines ?? null;
        message = `Collected decider rankings`;
      } else if (e.phase === "result" && e.type === "success_meta") {
        const ms = e.data?.elapsedMs as number | undefined;
        message = `Preparing success response${typeof ms === "number" ? ` (${(ms / 1000).toFixed(1)}s)` : ""}`;
      } else if (e.phase === "result" && e.type === "success") {
        const idxWinner = e.data?.chosenIndex as number | undefined;
        const tie = e.data?.wasTieBroken as boolean | undefined;
        message = `Completed with winner (index ${typeof idxWinner === "number" ? idxWinner : "?"})${typeof tie === "boolean" ? `, tie broken: ${tie}` : ""}`;
      } else if (e.phase === "result" && e.type === "fallback") {
        const reason = e.data?.reason as string | undefined;
        message = `Completed without consensus${reason ? `: ${reason}` : ""}`;
      }

      const hasData = e.data && Object.keys(e.data).length > 0;
      const showToggle = hasData && details !== null;
      const showDetails = expanded[idx] && (details || hasData);
      return (
        <div key={idx} className="text-xs leading-relaxed py-0.5">
          <span className="text-muted-foreground">[{formatTime(e.timestamp)}]</span>{" "}
          <span className="font-medium">{e.phase}</span>{" "}
          <span className="text-muted-foreground">{e.type}</span>{": "}
          <span>{message}</span>
          {showToggle && (
            <button className="ml-2 underline text-[10px] text-muted-foreground" onClick={() => toggle(idx)}>
              {expanded[idx] ? "Hide details" : "Show details"}
            </button>
          )}
          {showDetails && (
            <pre className="block whitespace-pre-wrap text-[10px] mt-0.5 text-muted-foreground">
              {details ?? JSON.stringify(e.data)}
            </pre>
          )}
        </div>
      );
    });
  }, [events, expanded]);

  const copyAll = async () => {
    const lines = events.map((e) => {
      const ts = new Date(e.timestamp).toISOString();
      const base = `[${ts}] ${e.phase} ${e.type}: ${e.message}`;
      const details = e.data && Object.keys(e.data).length > 0 ? `\n${JSON.stringify(e.data)}` : "";
      return base + details;
    }).join("\n");
    await navigator.clipboard.writeText(lines);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Activity</div>
        <button
          className="text-xs underline text-muted-foreground"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>
      {!collapsed && (
        <Card className="p-3 max-h-64 overflow-auto relative" ref={scrollRef as React.RefObject<HTMLDivElement>}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={copyAll}
            aria-label="Copy activity log"
            title="Copy"
            className="absolute top-2 right-2 z-10 opacity-70 hover:opacity-100 focus:opacity-100"
          >
            <Copy className="size-4" aria-hidden />
          </Button>
          {rows.length ? rows : (
            <div className="text-xs text-muted-foreground">Waiting for events…</div>
          )}
        </Card>
      )}
    </div>
  );
}


