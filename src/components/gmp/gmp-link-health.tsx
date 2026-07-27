"use client";

import React from "react";

type GmpLinkHealthProps = {
  score: number;
  inboundLinks: Record<string, string[]>;
  outboundLinks: Record<string, string[]>;
  issues: Array<{
    ruleId: string;
    severity: string;
    reason: string;
    suggestedResolution: string;
  }>;
};

export function GmpLinkHealth({ score, inboundLinks, outboundLinks, issues }: GmpLinkHealthProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Link Health</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">Internal-link intelligence</h3>
        <span className="text-3xl font-semibold text-white">{score}%</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ListCard title="Inbound" items={Object.values(inboundLinks).flat()} />
        <ListCard title="Outbound" items={Object.values(outboundLinks).flat()} />
      </div>
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

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      <p className="font-medium text-white">{title}</p>
      <p className="mt-2 text-sm text-zinc-400">{items.length} link(s)</p>
      <p className="mt-2 text-xs text-zinc-500">{items.length > 0 ? items.join(", ") : "None"}</p>
    </div>
  );
}
