import React from "react";

type ProgressSummary = {
  queuedItems: number;
  runningItems: number;
  completedItems: number;
  failedItems: number;
  retryableItems: number;
  blockedItems: number;
  verificationStatus: string;
  rollbackAvailability: boolean;
  attemptCount: number;
  latestFailure?: { failureCategory?: string; failureMessage?: string };
};

type ReleaseProgressContract = {
  release?: {
    releaseStatus: string;
    approvedBy?: string;
    scheduledAt?: string | null;
    gopExecutionId?: string;
  };
  summary: ProgressSummary;
  modelVersion?: string;
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export function GmpReleaseProgress({ progress }: { progress: ReleaseProgressContract | null | undefined }) {
  if (!progress) return <p className="text-sm text-zinc-400">Release progress unavailable.</p>;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Release Progress</h2>
        <p className="text-xs text-zinc-400">{progress.modelVersion ?? "unknown-model"}</p>
      </div>
      <p className="mt-2 text-sm text-zinc-400">Status: {progress.release?.releaseStatus ?? "unknown"} • Approval: {progress.release?.approvedBy ? `approved by ${progress.release.approvedBy}` : "pending"}</p>
      <p className="text-sm text-zinc-400">Scheduled: {progress.release?.scheduledAt ?? "none"} • GOP execution: {progress.release?.gopExecutionId ?? "not started"}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Queued" value={progress.summary.queuedItems} />
        <Stat label="Running" value={progress.summary.runningItems} />
        <Stat label="Completed" value={progress.summary.completedItems} />
        <Stat label="Failed" value={progress.summary.failedItems} />
        <Stat label="Retryable" value={progress.summary.retryableItems} />
        <Stat label="Blocked" value={progress.summary.blockedItems} />
        <Stat label="Attempts" value={progress.summary.attemptCount} />
        <Stat label="Verification" value={progress.summary.verificationStatus} />
        <Stat label="Rollback" value={progress.summary.rollbackAvailability ? "Available" : "Not available"} />
      </div>

      {progress.summary.latestFailure ? (
        <div className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Latest Failure</p>
          <p className="text-sm text-rose-200">{progress.summary.latestFailure.failureCategory ?? "UNKNOWN"} • {progress.summary.latestFailure.failureMessage ?? "No message"}</p>
        </div>
      ) : null}
    </section>
  );
}
