import React from "react";

type ReconciliationContract = {
  reconciliationStatus?: string;
  driftDetected?: boolean;
  driftReasons?: string[];
  metadata?: Record<string, unknown>;
  detectedAt?: string;
};

type VerificationDiffContract = {
  differences?: Array<Record<string, unknown>>;
  blockingDifferences?: Array<Record<string, unknown>>;
};

export function GmpReconciliationDifferences({
  reconciliation,
  verification,
  canResolve,
  canForceRepublish,
}: {
  reconciliation: ReconciliationContract | null | undefined;
  verification: VerificationDiffContract | null | undefined;
  canResolve: boolean;
  canForceRepublish: boolean;
}) {
  const differences = verification?.differences ?? [];
  const blocking = verification?.blockingDifferences ?? [];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-semibold text-white">Reconciliation Workspace</h2>
      <p className="mt-1 text-sm text-zinc-400">{reconciliation?.reconciliationStatus ?? "unknown"} • drift: {reconciliation?.driftDetected ? "detected" : "not detected"}</p>
      <p className="text-xs text-zinc-400">Detected: {reconciliation?.detectedAt ?? "n/a"} • Resolution: {String(reconciliation?.metadata?.resolutionState ?? "UNRESOLVED")}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Blocking Differences</p>
          {blocking.length === 0 ? <p className="text-sm text-zinc-400">None</p> : blocking.map((entry, index) => <p key={index} className="text-sm text-rose-300">{JSON.stringify(entry)}</p>)}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Differences</p>
          {differences.length === 0 ? <p className="text-sm text-zinc-400">None</p> : differences.map((entry, index) => <p key={index} className="text-sm text-zinc-300">{JSON.stringify(entry)}</p>)}
        </div>
      </div>

      {canResolve ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded border border-zinc-700 px-2 py-1 text-zinc-300">Accept Remote Change</span>
          <span className="rounded border border-zinc-700 px-2 py-1 text-zinc-300">Republish Genesis State</span>
          <span className="rounded border border-zinc-700 px-2 py-1 text-zinc-300">Defer</span>
          <span className="rounded border border-zinc-700 px-2 py-1 text-zinc-300">Ignore by Policy</span>
          <span className="rounded border border-zinc-700 px-2 py-1 text-zinc-300">Create New Publishing Package</span>
          <span className="rounded border border-zinc-700 px-2 py-1 text-zinc-300">Initiate Rollback</span>
          {canForceRepublish ? <span className="rounded border border-rose-700 px-2 py-1 text-rose-300">Force Republish</span> : <span className="rounded border border-zinc-800 px-2 py-1 text-zinc-500">Force Republish (insufficient permission)</span>}
        </div>
      ) : (
        <p className="mt-4 text-xs text-zinc-500">Read-only reconciliation view.</p>
      )}
    </section>
  );
}
