"use client";

import React from "react";

type Props = {
  parentTree: Record<string, string[]>;
  childTree: Record<string, string[]>;
  siblingGroups: Record<string, string[]>;
  clusterGroups: Record<string, string[]>;
  circularReferences: string[][];
};

export function GmpPageGraph({ parentTree, childTree, siblingGroups, clusterGroups, circularReferences }: Props) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Page Graph</p>
      <h3 className="mt-1 text-lg font-semibold text-white">Deterministic page topology</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Box title="Parent Tree" value={Object.keys(parentTree).length} />
        <Box title="Child Tree" value={Object.keys(childTree).length} />
        <Box title="Sibling Groups" value={Object.keys(siblingGroups).length} />
        <Box title="Cluster Groups" value={Object.keys(clusterGroups).length} />
        <Box title="Circular References" value={circularReferences.length} />
      </div>
    </section>
  );
}

function Box({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">{title}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
