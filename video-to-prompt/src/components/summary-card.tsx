"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivityEvent } from "@/lib/run-log";
import { Card } from "@/components/ui/card";

type Props = {
  runId: string;
};

export function SummaryCard({ runId }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const es = new EventSource(`/api/logs/${encodeURIComponent(runId)}/stream`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as ActivityEvent;
        setEvents((prev) => [...prev, data]);
      } catch {}
    };
    return () => es.close();
  }, [runId]);

  const content = useMemo(() => {
    const summary = (events as ActivityEvent[] & { findLast?: (fn: (e: ActivityEvent) => boolean) => ActivityEvent | undefined })
      .findLast?.((e: ActivityEvent) => e.phase === "result" && e.type === "summary")
      || [...events].reverse().find((e) => e.phase === "result" && e.type === "summary");
    if (!summary) return null;
    const data = summary.data as Record<string, unknown> | undefined;
    const winner = (data?.winner as string) ?? undefined;
    const deciders = (data?.deciders as string[]) ?? undefined;
    const averages = (data?.averages as string) ?? undefined;

    return (
      <div className="space-y-2">
        {winner && <div className="text-sm"><span className="font-medium">Winner:</span> {winner}</div>}
        {averages && (
          <div className="text-sm"><span className="font-medium">Average rankings:</span> {averages}</div>
        )}
        {Array.isArray(deciders) && deciders.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-1">Per-decider rankings</div>
            <ul className="list-disc pl-5 text-xs space-y-0.5">
              {deciders.map((line, i) => (
                <li key={i} className="leading-snug">{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }, [events]);

  if (!content) return null;

  return (
    <Card className="p-4">
      <div className="text-lg md:text-xl font-semibold text-[#B8831F] dark:text-[#F1C453] mb-2">Summary</div>
      {content}
    </Card>
  );
}


