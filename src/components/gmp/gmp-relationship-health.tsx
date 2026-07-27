"use client";

import React from "react";

type GmpRelationshipHealthProps = {
  health: {
    score: number;
    reason: string;
    blockingIssues: string[];
    warnings: string[];
    recommendations: string[];
  };
  issues: Array<{
    ruleId: string;
    severity: string;
    reason: string;
    suggestedResolution: string;
    affectedPageIds: string[];
  }>;
};

export function GmpRelationshipHealth({ health, issues }: GmpRelationshipHealthProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Relationship Health</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">Architecture health</h3>
        <span className="text-3xl font-semibold text-white">{health.score}%</span>
      </div>
      <p className="mt-2 text-sm text-zinc-300">{health.reason}</p>
      <IssueList title="Blocking issues" items={health.blockingIssues} tone="rose" />
      <IssueList title="Warnings" items={health.warnings} tone="amber" />
      <IssueList title="Recommendations" items={health.recommendations} tone="cyan" />
      <div className="mt-4 space-y-2">
        {issues.map((issue) => (
          <div key={`${issue.ruleId}-${issue.reason}`} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-300">
            <p className="font-medium text-white">{issue.ruleId}</p>
            <p className="text-zinc-400">{issue.reason}</p>
            <p className="text-zinc-500">{issue.suggestedResolution}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function IssueList({ title, items, tone }: { title: string; items: string[]; tone: "rose" | "amber" | "cyan" }) {
  const color = tone === "rose" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : "text-cyan-300";
  return (
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      <p className="font-medium text-white">{title}</p>
      {items.length > 0 ? <ul className={`mt-2 space-y-1 ${color}`}>{items.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-zinc-500">None</p>}
    </div>
  );
}
