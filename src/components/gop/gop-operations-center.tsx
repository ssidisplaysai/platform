"use client";

import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/glw/page-container";
import type { GenesisOperationsSnapshot } from "@/platform/gop/contracts";

type GopOperationsCenterProps = {
  initialSnapshot: GenesisOperationsSnapshot;
};

function formatRelative(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [snapshot, setSnapshot] = useState(initialSnapshot);

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
    openStream();
    pollTimer = setInterval(() => {
      void loadSnapshot();
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
