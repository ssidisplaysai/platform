import React from "react";

type ReleaseItem = {
  releaseItemId: string;
  publishingPackageId: string;
  dependencyReferences: string[];
  sequence: number;
  status: string;
};

type DependencyPlan = {
  items: ReleaseItem[];
  resolvedExecutionOrder: string[];
  parallelizableGroups: string[][];
  missingDependencies: string[];
  circularDependencies: boolean;
  blockedDependents: string[];
  sequenceConflicts: string[];
  validationModelVersion: string;
  executionPolicy: string;
  concurrencyPolicy: string;
};

export function GmpReleaseDependencyPlan({ plan }: { plan: DependencyPlan | null | undefined }) {
  if (!plan) {
    return <p className="text-sm text-zinc-400">Dependency plan unavailable.</p>;
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Release Dependency Plan</h2>
        <p className="text-xs text-zinc-400">{plan.validationModelVersion} • {plan.concurrencyPolicy}</p>
      </div>

      <p className="mt-2 text-sm text-zinc-400">Execution policy: {plan.executionPolicy}</p>

      <div className="mt-3 space-y-2">
        {plan.items.map((item) => (
          <div key={item.releaseItemId} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-white">{item.releaseItemId}</p>
            <p className="text-xs text-zinc-400">Package {item.publishingPackageId} • Sequence {item.sequence} • {item.status}</p>
            <p className="mt-1 text-xs text-zinc-300">Dependencies: {item.dependencyReferences.length > 0 ? item.dependencyReferences.join(", ") : "none"}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Resolved Order</p>
          <ol className="mt-1 list-decimal pl-5 text-sm text-zinc-200">
            {plan.resolvedExecutionOrder.map((entry) => <li key={entry}>{entry}</li>)}
          </ol>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Parallelizable Groups</p>
          {plan.parallelizableGroups.length === 0 ? <p className="text-sm text-zinc-400">None</p> : plan.parallelizableGroups.map((group, index) => <p key={`${index}-${group.join("-")}`} className="text-sm text-zinc-300">Group {index + 1}: {group.join(", ")}</p>)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Missing Dependencies</p>
          {plan.missingDependencies.length === 0 ? <p className="text-sm text-zinc-400">None</p> : plan.missingDependencies.map((entry) => <p key={entry} className="text-sm text-rose-300">{entry}</p>)}
          {plan.circularDependencies ? <p className="text-sm text-rose-300">Circular dependencies detected.</p> : null}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Blocked or Conflicted</p>
          {plan.blockedDependents.map((entry) => <p key={entry} className="text-sm text-amber-300">Blocked dependent: {entry}</p>)}
          {plan.sequenceConflicts.map((entry) => <p key={entry} className="text-sm text-amber-300">Sequence conflict: {entry}</p>)}
          {plan.blockedDependents.length === 0 && plan.sequenceConflicts.length === 0 ? <p className="text-sm text-zinc-400">None</p> : null}
        </div>
      </div>
    </section>
  );
}
