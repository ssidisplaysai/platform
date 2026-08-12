"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/glw/page-container";
import type { GenesisOperationsSnapshot } from "@/platform/gop/contracts";
import type { JobRecoveryAuditResult, JobRecoveryExecuteResult } from "@/lib/runtime/job-recovery";

type GopOperationsCenterProps = {
  initialSnapshot?: GenesisOperationsSnapshot;
};

export function createEmptyOperationsSnapshot(): GenesisOperationsSnapshot {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    workspaceId: "glw-led-display-warehouse",
    executions: [],
    queue: {
      state: "ACTIVE",
      depth: 0,
      activeByPriority: {
        LOW: 0,
        NORMAL: 0,
        HIGH: 0,
        URGENT: 0,
      },
      paused: false,
      retryDepth: 0,
      deadLetterDepth: 0,
      leasedDepth: 0,
      expiredLeases: 0,
    },
    workers: [],
    alerts: [],
    notifications: [],
    failedExecutions: [],
    retryQueue: [],
    activeApprovals: [],
    throughputPerMinute: 0,
    runningJobs: 0,
    health: {
      status: "HEALTHY",
      workerHeartbeatLagMs: 0,
      queueLatencyMs: 0,
      executionLatencyMs: 0,
      databaseHealthy: true,
      eventThroughputPerMinute: 0,
      callbackLatencyMs: 0,
      apiFailureRate: 0,
      updatedAt: now,
    },
    metrics: [],
  };
}

function formatRelative(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDurationMs(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0s";
  }

  if (value < 1000) {
    return `${value}ms`;
  }

  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm text-zinc-400">{detail}</p> : null}
    </div>
  );
}

export function GopOperationsCenter({ initialSnapshot }: GopOperationsCenterProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot ?? createEmptyOperationsSnapshot());
  const [recoveryAudit, setRecoveryAudit] = useState<JobRecoveryAuditResult | null>(null);
  const [lastRecoveryRun, setLastRecoveryRun] = useState<JobRecoveryExecuteResult | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const loadSnapshot = async () => {
      const response = await fetch("/api/gop/operations", {
        cache: "no-store",
        credentials: "include",
      }).catch(() => null);

      if (!response || !response.ok || cancelled) {
        return;
      }

      const payload = await response.json().catch(() => null) as { snapshot?: GenesisOperationsSnapshot } | null;
      if (!cancelled && payload?.snapshot) {
        setSnapshot(payload.snapshot);
      }
    };

    const loadRecoveryAudit = async () => {
      const response = await fetch("/api/gop/recovery", {
        cache: "no-store",
        credentials: "include",
      }).catch(() => null);

      if (!response || !response.ok || cancelled) {
        return;
      }

      const payload = await response.json().catch(() => null) as { audit?: JobRecoveryAuditResult } | null;
      if (!cancelled && payload?.audit) {
        setRecoveryAudit(payload.audit);
      }
    };

    const openStream = () => {
      eventSource = new EventSource("/api/gop/operations/stream");

      eventSource.addEventListener("snapshot", (raw) => {
        try {
          const payload = JSON.parse((raw as MessageEvent<string>).data) as { snapshot?: GenesisOperationsSnapshot };
          if (payload.snapshot) {
            setSnapshot(payload.snapshot);
          }
        } catch {
          // Ignore malformed event payloads.
        }
      });

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
      };
    };

    void loadSnapshot();
    void loadRecoveryAudit();
    openStream();
    pollTimer = setInterval(() => {
      void loadSnapshot();
      void loadRecoveryAudit();
      if (!eventSource) {
        openStream();
      }
    }, 10000);

    return () => {
      cancelled = true;
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      eventSource?.close();
    };
  }, []);

  const queueDetails = useMemo(() => {
    const entries = Object.entries(snapshot.queue.activeByPriority)
      .map(([priority, value]) => `${priority}: ${value}`)
      .join(" | ");

    return entries.length > 0 ? entries : "No queued executions.";
  }, [snapshot.queue.activeByPriority]);

  const cards = recoveryAudit?.cards;

  const runRecovery = async (mode: "dry-run" | "recover-safe") => {
    setRecoveryBusy(true);
    setRecoveryError(null);

    const dryRun = mode === "dry-run";
    let approvalToken: string | undefined;

    if (!dryRun) {
      const userInput = window.prompt("Type APPROVE_RECOVERY_WRITE to allow recovery writes:");
      if (!userInput) {
        setRecoveryBusy(false);
        return;
      }
      approvalToken = userInput;
    }

    const response = await fetch("/api/gop/recovery", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "RECOVER_ALL_SAFE",
        dryRun,
        approvalToken,
      }),
    }).catch(() => null);

    if (!response) {
      setRecoveryBusy(false);
      setRecoveryError("Recovery request failed before reaching the API.");
      return;
    }

    const payload = await response.json().catch(() => null) as { result?: JobRecoveryExecuteResult; error?: string } | null;
    if (!response.ok || !payload?.result) {
      setRecoveryBusy(false);
      setRecoveryError(payload?.error ?? "Recovery API call failed.");
      return;
    }

    setLastRecoveryRun(payload.result);

    const latest = await fetch("/api/gop/recovery", {
      cache: "no-store",
      credentials: "include",
    }).then((res) => (res.ok ? res.json() : null)).catch(() => null) as { audit?: JobRecoveryAuditResult } | null;

    if (latest?.audit) {
      setRecoveryAudit(latest.audit);
    }

    setRecoveryBusy(false);
  };

  return (
    <PageContainer>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Operations Center</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Runtime Command Center</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Live view of executions, queues, workers, failures, retries, approvals, and health across the workspace.
          </p>
          <p className="mt-3 text-xs text-zinc-500">Last updated: {formatRelative(snapshot.generatedAt)}</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Live Executions" value={String(snapshot.executions.length)} detail="Total orchestration records" />
          <MetricCard label="Queue Depth" value={String(snapshot.queue.depth)} detail={queueDetails} />
          <MetricCard label="Workers" value={String(snapshot.workers.length)} detail="Registered runtime workers" />
          <MetricCard label="Throughput / Min" value={String(snapshot.throughputPerMinute)} detail={`Running jobs: ${snapshot.runningJobs}`} />
          <MetricCard label="Failed Executions" value={String(snapshot.failedExecutions.length)} />
          <MetricCard label="Retry Queue" value={String(snapshot.retryQueue.length)} />
          <MetricCard label="Active Approvals" value={String(snapshot.activeApprovals.length)} />
          <MetricCard label="Health" value={snapshot.health.status} detail={`Queue latency: ${snapshot.health.queueLatencyMs}ms`} />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Queue Recovery</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Dry-Run Recovery and Self-Healing Gate</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Recovery stays read-only unless the explicit approval token is entered.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runRecovery("dry-run")}
                disabled={recoveryBusy}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Dry-Run Recover Safe
              </button>
              <button
                type="button"
                onClick={() => void runRecovery("recover-safe")}
                disabled={recoveryBusy}
                className="rounded-xl border border-amber-700 bg-amber-950 px-3 py-2 text-sm font-medium text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Recover Safe (Write)
              </button>
            </div>
          </div>

          {recoveryError ? (
            <p className="mt-4 rounded-xl border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">{recoveryError}</p>
          ) : null}

          {recoveryAudit ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Running" value={String(cards?.running ?? 0)} />
                <MetricCard label="Starting" value={String(cards?.starting ?? 0)} />
                <MetricCard label="Waiting Callback" value={String(cards?.waitingCallback ?? 0)} />
                <MetricCard label="Failed" value={String(cards?.failed ?? 0)} />
                <MetricCard label="Recovered" value={String(cards?.recovered ?? 0)} />
                <MetricCard label="Orphaned" value={String(cards?.orphaned ?? 0)} />
                <MetricCard label="Workers" value={String(cards?.workers ?? 0)} detail={`Healthy: ${cards?.healthyWorkers ?? 0}`} />
                <MetricCard label="Expired Leases" value={String(cards?.expiredLeases ?? 0)} />
                <MetricCard label="Queue Capacity" value={String(cards?.queueCapacity ?? 0)} />
                <MetricCard label="Concurrency Remaining" value={String(cards?.concurrencyRemaining ?? 0)} />
                <MetricCard label="Average Runtime" value={formatDurationMs(cards?.averageRuntimeMs ?? 0)} />
                <MetricCard label="Oldest Active Job" value={`${cards?.oldestActiveJobHours ?? 0}h`} />
              </div>

              <p className="mt-4 text-sm text-zinc-300">
                Audit verdict: <span className="font-semibold">{recoveryAudit.summary.verdict}</span>. Recoverable: {recoveryAudit.summary.recoverable} / {recoveryAudit.summary.totalStartingJobs}.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">Recovery audit data is loading.</p>
          )}

          {lastRecoveryRun ? (
            <p className="mt-3 text-xs text-zinc-400">
              Last run: dryRun={String(lastRecoveryRun.dryRun)} attempted={lastRecoveryRun.attempted} recovered={lastRecoveryRun.recovered} skippedUnsafe={lastRecoveryRun.skippedUnsafe} skippedMissing={lastRecoveryRun.skippedMissing}
            </p>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Executions</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Live Execution Stream</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Execution</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Current Node</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-200">
                  {snapshot.executions.slice(0, 12).map((execution) => (
                    <tr key={execution.executionId} className="border-t border-zinc-800">
                      <td className="py-2 pr-4 font-mono text-xs">{execution.executionId}</td>
                      <td className="py-2 pr-4">{execution.status}</td>
                      <td className="py-2 pr-4">{execution.currentNodeId ?? "--"}</td>
                      <td className="py-2">{formatRelative(execution.timing.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Workers</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Worker Health and Capacity</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Worker</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Health</th>
                    <th className="pb-2 pr-4 font-medium">Load</th>
                    <th className="pb-2 font-medium">Heartbeat</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-200">
                  {snapshot.workers.map((worker) => (
                    <tr key={worker.workerId} className="border-t border-zinc-800">
                      <td className="py-2 pr-4">{worker.name}</td>
                      <td className="py-2 pr-4">{worker.workerType}</td>
                      <td className="py-2 pr-4">{worker.health}</td>
                      <td className="py-2 pr-4">{worker.currentWorkload}/{worker.maxCapacity}</td>
                      <td className="py-2">{formatRelative(worker.heartbeatAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Alerts</p>
            <h2 className="mt-2 text-lg font-semibold text-white">System Alerts</h2>
            <div className="mt-4 space-y-2">
              {snapshot.alerts.length === 0 ? (
                <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400">No active alerts.</p>
              ) : snapshot.alerts.slice(0, 8).map((alert) => (
                <div key={alert.notificationId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                  <p className="font-medium text-white">{alert.title}</p>
                  <p className="mt-1 text-zinc-400">{alert.message}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Notifications</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Recent Runtime Notifications</h2>
            <div className="mt-4 space-y-2">
              {snapshot.notifications.length === 0 ? (
                <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400">No notifications yet.</p>
              ) : snapshot.notifications.slice(0, 8).map((note) => (
                <div key={note.notificationId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                  <p className="font-medium text-white">{note.title}</p>
                  <p className="mt-1 text-zinc-400">{note.message}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </PageContainer>
  );
}
