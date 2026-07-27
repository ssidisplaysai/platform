"use client";

import React from "react";

type TimelineEvent = {
  label: string;
  at: string;
  detail?: string;
  state?: string;
};

type GovernanceTimelineProps = {
  title: string;
  events: TimelineEvent[];
};

export function GmpGovernanceTimeline({ title, events }: GovernanceTimelineProps) {
  const ordered = [...events].sort((left, right) => Date.parse(left.at) - Date.parse(right.at));

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Governance Timeline</p>
      <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {ordered.length > 0 ? ordered.map((event) => (
          <div key={`${event.label}-${event.at}`} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-white">{event.label}</p>
              {event.state ? <span className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] uppercase tracking-[0.24em] text-zinc-400">{event.state}</span> : null}
            </div>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-zinc-500">{new Date(event.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            {event.detail ? <p className="mt-1 text-sm text-zinc-300">{event.detail}</p> : null}
          </div>
        )) : (
          <p className="text-sm text-zinc-400">No governance events recorded.</p>
        )}
      </div>
    </section>
  );
}
