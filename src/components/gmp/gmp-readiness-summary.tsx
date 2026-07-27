"use client";

import React from "react";

type ReadinessSummaryProps = {
  readiness?: {
    scoringModelVersion?: string;
    overallScore?: number;
    planningReadiness?: number;
    knowledgeReadiness?: number;
    seoReadiness?: number;
    evidenceReadiness?: number;
    linkingReadiness?: number;
    blockingIssues?: string[];
    warnings?: string[];
    recommendations?: string[];
  } | null;
  canRunReadiness: boolean;
  onRunReadiness: () => void;
};

export function GmpReadinessSummary({ readiness, canRunReadiness, onRunReadiness }: ReadinessSummaryProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Readiness</p>
      <h3 className="mt-1 text-lg font-semibold text-white">Operator readiness summary</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Overall" value={`${readiness?.overallScore ?? 0}%`} />
        <Metric label="Planning" value={`${readiness?.planningReadiness ?? 0}%`} />
        <Metric label="Knowledge" value={`${readiness?.knowledgeReadiness ?? 0}%`} />
        <Metric label="SEO" value={`${readiness?.seoReadiness ?? 0}%`} />
        <Metric label="Evidence" value={`${readiness?.evidenceReadiness ?? 0}%`} />
        <Metric label="Linking" value={`${readiness?.linkingReadiness ?? 0}%`} />
      </div>
      <div className="mt-4 space-y-3 text-sm text-zinc-300">
        <PanelList title="Blocking issues" items={readiness?.blockingIssues ?? []} emptyLabel="No blocking issues." tone="rose" />
        <PanelList title="Warnings" items={readiness?.warnings ?? []} emptyLabel="No warnings." tone="amber" />
        <PanelList title="Recommendations" items={readiness?.recommendations ?? []} emptyLabel="No recommendations." tone="cyan" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-[0.3em] text-zinc-500">Model {readiness?.scoringModelVersion ?? "n/a"}</span>
        {canRunReadiness ? (
          <button type="button" onClick={onRunReadiness} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">
            Refresh readiness
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function PanelList({ title, items, emptyLabel, tone }: { title: string; items: string[]; emptyLabel: string; tone: "rose" | "amber" | "cyan"; }) {
  const colorClass = tone === "rose" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : "text-cyan-300";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      <p className="font-medium text-white">{title}</p>
      {items.length > 0 ? (
        <ul className={`mt-2 space-y-1 ${colorClass}`}>
          {items.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-zinc-500">{emptyLabel}</p>
      )}
    </div>
  );
}
