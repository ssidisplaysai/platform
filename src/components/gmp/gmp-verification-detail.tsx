import React from "react";

type VerificationContract = {
  verificationStatus: string;
  expectedState: Record<string, unknown>;
  remoteState: Record<string, unknown>;
  differences: Array<Record<string, unknown>>;
  blockingDifferences: Array<Record<string, unknown>>;
  warnings: string[];
  verifiedAt: string;
  verificationModelVersion: string;
  metadata?: Record<string, unknown>;
};

export function GmpVerificationDetail({ verification }: { verification: VerificationContract | null | undefined }) {
  if (!verification) {
    return <p className="text-sm text-zinc-400">No verification record is available yet.</p>;
  }

  const normalizedExpected = verification.metadata?.normalizedExpected;
  const normalizedRemote = verification.metadata?.normalizedRemote;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-semibold text-white">Verification Detail</h2>
      <p className="mt-1 text-sm text-zinc-400">{verification.verificationStatus} • {verification.verifiedAt} • {verification.verificationModelVersion}</p>
      <p className="text-xs text-zinc-400">Normalization model: {String(verification.metadata?.normalizationModelVersion ?? "none")}</p>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Expected Raw State</p>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(verification.expectedState, null, 2)}</pre>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Remote Raw State</p>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(verification.remoteState, null, 2)}</pre>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Expected Normalized State</p>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(normalizedExpected ?? {}, null, 2)}</pre>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Remote Normalized State</p>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(normalizedRemote ?? {}, null, 2)}</pre>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Blocking Differences</p>
          {verification.blockingDifferences.length === 0 ? <p className="text-sm text-zinc-400">None</p> : verification.blockingDifferences.map((entry, index) => <p key={index} className="text-sm text-rose-300">{JSON.stringify(entry)}</p>)}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Warnings and Non-blocking Differences</p>
          {verification.warnings.map((entry) => <p key={entry} className="text-sm text-amber-300">Warning: {entry}</p>)}
          {verification.differences.map((entry, index) => <p key={index} className="text-sm text-zinc-300">{JSON.stringify(entry)}</p>)}
        </div>
      </div>
    </section>
  );
}
