"use client";

import type { ReactNode } from "react";
import { GlwJobProgress } from "@/components/glw/glw-job-progress";
import { GlwJobTimeline } from "@/components/glw/glw-job-timeline";
import { EmptyState } from "@/components/glw/empty-state";
import type { GenesisExecution, GenesisJob, GenesisTimelineEntry } from "@/platform/gop/contracts";
import { createGenesisJobSnapshot } from "@/platform/gop/job-engine";
import { getGenesisInspectorExtensions } from "@/platform/gop/inspector/extensions";

type GopInspectorHostProps = {
  job: GenesisJob | null;
  execution?: GenesisExecution | null;
  title?: string;
  summary?: string;
  actions?: ReactNode;
};

function toTimelineState(state: GenesisTimelineEntry["state"]): "pending" | "active" | "complete" | "failed" {
  if (state === "complete" || state === "archived") {
    return "complete";
  }

  if (state === "failed" || state === "cancelled") {
    return "failed";
  }

  if (state === "active") {
    return "active";
  }

  return "pending";
}

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(120px,1fr)_minmax(0,2fr)] gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="break-words text-zinc-200">{value}</span>
    </div>
  );
}

export function GopInspectorHost({ job, execution, title, summary, actions }: GopInspectorHostProps) {
  if (!job) {
    return (
      <EmptyState
        title="No job selected"
        description="Open any recent job to inspect its workflow timeline, result payloads, and operator diagnostics."
      />
    );
  }

  const snapshot = createGenesisJobSnapshot(job);
  const timelineRows = snapshot.timeline.map((entry) => ({
    key: entry.timelineId,
    label: entry.label,
    state: toTimelineState(entry.state),
    timestamp: formatTimestamp(entry.occurredAt),
    duration: entry.duration ?? "--",
  }));

  const extensions = getGenesisInspectorExtensions(job.moduleId)
    .filter((extension) => (extension.isEnabled ? extension.isEnabled({ moduleId: job.moduleId, job }) : true));

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm shadow-zinc-950/20">
        <div className="border-b border-zinc-800 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2 min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Inspector</p>
              <h2 className="text-lg font-semibold tracking-tight text-white break-words">{title ?? `${job.type.replaceAll("_", " ")} Job`}</h2>
              <p className="text-sm text-zinc-400 break-words">{summary ?? "Platform inspector for lifecycle, timeline, outcomes, and audit context."}</p>
            </div>
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>
          <div className="mt-4">
            <GlwJobProgress progress={snapshot.progressPercent} label={snapshot.currentStage} />
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-2 xl:grid-cols-3">
          <DetailRow label="Job ID" value={job.jobId} />
          <DetailRow label="Module" value={job.moduleId} />
          <DetailRow label="Job Type" value={job.type} />
          <DetailRow label="Status" value={job.status} />
          <DetailRow label="Priority" value={job.priority} />
          <DetailRow label="Created" value={formatTimestamp(job.createdAt)} />
          <DetailRow label="Started" value={formatTimestamp(job.startedAt ?? undefined)} />
          <DetailRow label="Completed" value={formatTimestamp(job.completedAt ?? undefined)} />
          <DetailRow label="Current Step" value={snapshot.currentWorkflowStep} />
        </div>
      </article>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-zinc-950/20 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Timeline</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">Workflow Timeline</h3>
        <div className="mt-4">
          <GlwJobTimeline entries={timelineRows} />
        </div>
      </article>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-zinc-950/20 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Results</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">Result and Diagnostics</h3>
        <div className="mt-4 space-y-3 text-sm text-zinc-300">
          <DetailRow label="Result" value={job.result ? "Available" : "Pending"} />
          <DetailRow label="Error" value={job.error?.message ?? "None"} />
          <DetailRow label="Correlation" value={job.context?.correlationId ?? "--"} />
        </div>
      </article>

      {execution ? (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-zinc-950/20 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Execution Runtime</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">Execution Graph and Orchestration Context</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailRow label="Execution ID" value={execution.executionId} />
            <DetailRow label="Execution Status" value={execution.status} />
            <DetailRow label="Current Node" value={execution.currentNodeId ?? "--"} />
            <DetailRow label="Worker" value={execution.worker?.name ?? "--"} />
            <DetailRow label="Retries" value={String(execution.retryHistory.length)} />
            <DetailRow label="Parent Execution" value={execution.parentExecutionId ?? "--"} />
            <DetailRow label="Child Executions" value={execution.childExecutionIds.length > 0 ? execution.childExecutionIds.join(", ") : "--"} />
            <DetailRow label="Dependencies" value={execution.graph.nodes.map((node) => `${node.nodeId}(${node.dependsOn.length})`).join(" | ")} />
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Graph Nodes</p>
            <div className="mt-2 space-y-2 text-sm text-zinc-300">
              {execution.graph.nodes.map((node) => (
                <div key={node.nodeId} className="rounded-lg border border-zinc-800 px-3 py-2">
                  <p className="font-medium text-white">{node.label} <span className="text-zinc-500">({node.nodeType})</span></p>
                  <p className="text-zinc-400">Depends on: {node.dependsOn.length > 0 ? node.dependsOn.join(", ") : "None"}</p>
                </div>
              ))}
            </div>
          </div>
        </article>
      ) : null}

      {extensions.map((extension) => (
        <article key={extension.extensionId} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-zinc-950/20 sm:p-6">
          {extension.renderSection({ moduleId: job.moduleId, job })}
        </article>
      ))}
    </section>
  );
}
