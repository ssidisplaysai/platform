"use client";

import React from "react";

function asComparableText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(asComparableText).join(" | ");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

type VersionCompareProps = {
  title: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  beforeLabel?: string;
  afterLabel?: string;
};

export function GmpVersionCompare({
  title,
  before,
  after,
  beforeLabel = "Previous",
  afterLabel = "Current",
}: VersionCompareProps) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const entries = [...keys].sort().map((key) => {
    const previousValue = before ? before[key] : undefined;
    const nextValue = after ? after[key] : undefined;
    const previousText = asComparableText(previousValue);
    const nextText = asComparableText(nextValue);
    const changed = previousText !== nextText;
    const removed = previousValue !== undefined && nextValue === undefined;
    const added = previousValue === undefined && nextValue !== undefined;

    return {
      key,
      previousText,
      nextText,
      changed,
      removed,
      added,
    };
  });

  const hasDiff = entries.some((entry) => entry.changed || entry.added || entry.removed);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Version Comparison</p>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] uppercase tracking-[0.24em] text-zinc-400">
          {beforeLabel} → {afterLabel}
        </span>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        {hasDiff ? entries.map((entry) => (
          <div key={entry.key} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-white">{entry.key}</p>
              {entry.added ? <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-300">Added</span> : null}
              {entry.removed ? <span className="rounded-full bg-rose-500/15 px-2 py-1 text-[11px] font-medium text-rose-300">Removed</span> : null}
              {entry.changed && !entry.added && !entry.removed ? <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-300">Changed</span> : null}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">{beforeLabel}</p>
                <p className="mt-1 whitespace-pre-wrap text-zinc-300">{entry.previousText || "—"}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">{afterLabel}</p>
                <p className="mt-1 whitespace-pre-wrap text-zinc-300">{entry.nextText || "—"}</p>
              </div>
            </div>
          </div>
        )) : (
          <p className="text-sm text-zinc-400">No field changes to compare.</p>
        )}
      </div>
    </section>
  );
}
