import React from "react";

type TimelineEntry = {
  timestamp: string;
  operation: string;
  status: string;
  actor?: string;
  objectReference?: string;
  executionReference?: string;
  outcome?: string;
  failureCategory?: string;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function GmpPublicationTimeline({ entries }: { entries: TimelineEntry[] | null | undefined }) {
  if (!entries || entries.length === 0) {
    return <p className="text-sm text-zinc-400">No publication timeline events available.</p>;
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-semibold text-white">Publication Timeline</h2>
      <div className="mt-3 space-y-2">
        {entries.map((entry, index) => (
          <div key={`${entry.timestamp}-${entry.operation}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-white">{entry.operation} • {entry.status}</p>
            <p className="text-xs text-zinc-400">{formatDate(entry.timestamp)}</p>
            <p className="mt-1 text-xs text-zinc-300">Actor: {entry.actor ?? "system"} • Object: {entry.objectReference ?? "n/a"}</p>
            <p className="text-xs text-zinc-300">Execution: {entry.executionReference ?? "n/a"} • Outcome: {entry.outcome ?? "n/a"}</p>
            {entry.failureCategory ? <p className="text-xs text-rose-300">Failure category: {entry.failureCategory}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
