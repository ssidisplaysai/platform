"use client";

import React from "react";

type SummaryProps = {
  pagesReady: number;
  pagesBlocked: number;
  missingBriefs: number;
  missingPlans: number;
  missingSections: number;
  averageReadiness: number;
  relationshipHealth: number;
  linkHealth: number;
  orphanPages: number;
  duplicateCanonicals: number;
  latestExecutions: Array<{ executionId?: string; status?: string; operationType?: string; createdAt?: string }>;
};

export function GmpArchitectureSummary(props: SummaryProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Architecture Health</p>
      <h3 className="mt-1 text-lg font-semibold text-white">Planning dashboard</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pages Ready" value={props.pagesReady} />
        <Metric label="Pages Blocked" value={props.pagesBlocked} />
        <Metric label="Missing Briefs" value={props.missingBriefs} />
        <Metric label="Missing Plans" value={props.missingPlans} />
        <Metric label="Missing Sections" value={props.missingSections} />
        <Metric label="Average Readiness" value={`${props.averageReadiness}%`} />
        <Metric label="Relationship Health" value={`${props.relationshipHealth}%`} />
        <Metric label="Link Health" value={`${props.linkHealth}%`} />
        <Metric label="Orphans" value={props.orphanPages} />
        <Metric label="Duplicate Canonicals" value={props.duplicateCanonicals} />
      </div>
      <div className="mt-4 space-y-2">
        {props.latestExecutions.map((execution) => (
          <div key={execution.executionId ?? `${execution.operationType}-${execution.createdAt ?? "latest"}`} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-300">
            <p className="font-medium text-white">{execution.operationType ?? "GOP execution"}</p>
            <p className="text-zinc-400">{execution.executionId ?? "n/a"} • {execution.status ?? "unknown"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{String(value)}</p>
    </div>
  );
}
