"use client";

import { useMemo } from "react";
import { formatGlwJobDuration, getGlwJobOperatorSnapshot, type GlwJobRecord } from "@/lib/glw/jobs";
import { EmptyState } from "./empty-state";
import { GlwJobProgress } from "./glw-job-progress";
import { GlwJobTimeline } from "./glw-job-timeline";
import { SectionHeader } from "./section-header";
import { StatusBadge } from "./status-badge";

export type GlwJobOperatorPanelProps = {
  job: GlwJobRecord | null;
  relatedJobs?: GlwJobRecord[];
  onRetry: (jobId: string) => Promise<GlwJobRecord>;
  onDuplicateRequest?: (job: GlwJobRecord) => void;
};

export function GlwJobOperatorPanel({
  job: activeJob,
  relatedJobs = [],
  onRetry,
  onDuplicateRequest,
}: GlwJobOperatorPanelProps) {
  const snapshot = useMemo(() => {
    if (!activeJob) {
      return null;
    }

    return getGlwJobOperatorSnapshot(activeJob);
  }, [activeJob]);

  const errorHistory = useMemo(() => {
    if (!activeJob) {
      return [] as GlwJobRecord[];
    }

    const jobMap = new Map(relatedJobs.map((job) => [job.id, job]));
    const history: GlwJobRecord[] = [];
    const queue = [activeJob.id];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift();

      if (!currentId || seen.has(currentId)) {
        continue;
      }

      seen.add(currentId);

      const current = jobMap.get(currentId);

      if (current) {
        history.push(current);
      }

      for (const job of relatedJobs) {
        if (job.retryOfJobId === currentId && !seen.has(job.id)) {
          queue.push(job.id);
        }
      }
    }

    return history.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [activeJob, relatedJobs]);

  if (!activeJob || !snapshot) {
    return (
      <EmptyState
        title="No job selected"
        description="Open any recent job to inspect its workflow timeline, result payloads, and operator diagnostics."
      />
    );
  }

  const result = activeJob.result;
  const wordpressUrl = result?.wordpressUrl ?? null;
  const wordpressPreviewUrl = result?.wordpressUrl ?? null;
  const hasFailure = activeJob.status === "FAILED" || snapshot.timedOut;

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm shadow-zinc-950/20">
        <div className="border-b border-zinc-800 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Selected Job</p>
                <h2 className="break-words text-lg font-semibold tracking-tight text-white">{activeJob.title}</h2>
                <p className="max-w-4xl break-words text-sm text-zinc-400">Live job details, stage tracking, and workflow diagnostics for Genesis operators.</p>
              </div>
              <StatusBadge status={statusBadgeState(snapshot.displayStatus)} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <GlwJobProgress progress={snapshot.progressPercent} label={snapshot.currentStage} className="w-full min-w-0" />
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400 xl:justify-end">
                <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1">{snapshot.currentWorkflowStep}</span>
                {snapshot.estimatedRemainingText ? <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1">{snapshot.estimatedRemainingText}</span> : null}
                {snapshot.timedOut ? <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-rose-200">Timed Out</span> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-2 xl:grid-cols-3">
          <DetailCard label="Job ID" value={activeJob.id} />
          <DetailCard label="Title" value={activeJob.title} />
          <DetailCard label="Site" value={activeJob.input.site.name} />
          <DetailCard label="Target URL" value={activeJob.input.page.targetSlug} />
          <DetailCard label="Started" value={formatGlwTimestamp(activeJob.startedAt)} />
          <DetailCard label="Duration" value={formatGlwJobDuration(activeJob)} />
          <DetailCard label="Created" value={formatGlwTimestamp(activeJob.createdAt)} />
          <DetailCard label="Updated" value={formatGlwTimestamp(activeJob.updatedAt)} />
          <DetailCard label="Workflow Version" value={activeJob.type === "PAGE_GENERATION" ? "Page Engine v1" : "Blog Engine v1"} />
          <DetailCard label="Operator" value="Operations Admin" />
          <DetailCard label="Current Stage" value={snapshot.currentStage} />
          <DetailCard label="Estimated Remaining Time" value={snapshot.estimatedRemainingText ?? "--"} />
          <DetailCard label="Current Workflow Step" value={snapshot.currentWorkflowStep} />
          <DetailCard label="Operator Notes" value="Placeholder for manual notes, escalation context, and runbook links." />
        </div>

        <div className="border-t border-zinc-800 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap gap-3">
            {activeJob.status === "FAILED" ? (
              <button
                type="button"
                onClick={async () => {
                  const retriedJob = await onRetry(activeJob.id);
                  void retriedJob;
                }}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Retry
              </button>
            ) : null}

            {activeJob.status === "FAILED" && onDuplicateRequest ? (
              <button
                type="button"
                onClick={() => onDuplicateRequest(activeJob)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Duplicate Request
              </button>
            ) : null}

            {(activeJob.status === "QUEUED" || activeJob.status === "STARTING" || activeJob.status === "RUNNING" || activeJob.status === "GENERATING_CONTENT" || activeJob.status === "GENERATING_IMAGE" || activeJob.status === "UPLOADING_IMAGE" || activeJob.status === "PUBLISHING") ? (
              <button
                type="button"
                disabled
                title="Cancel is reserved for a future workflow control surface."
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-500 opacity-70"
              >
                Cancel
              </button>
            ) : null}

            {activeJob.status === "COMPLETE" && wordpressUrl ? (
              <a
                href={wordpressUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Open WordPress Draft
              </a>
            ) : null}

            {activeJob.status === "COMPLETE" && wordpressPreviewUrl ? (
              <a
                href={wordpressPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Preview
              </a>
            ) : null}

            {activeJob.status === "COMPLETE" ? (
              <button
                type="button"
                disabled
                title="Publish is reserved for a future workflow control surface."
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-500 opacity-70"
              >
                Publish
              </button>
            ) : null}

            {activeJob.status === "FAILED" || snapshot.timedOut ? (
              <a
                href="#glw-job-diagnostics"
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20"
              >
                View Error
              </a>
            ) : null}
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-zinc-950/20 sm:p-6">
        <SectionHeader eyebrow="Workflow" title="Timeline" description="Every stage is tracked from request intake through database update and completion." />
        <div className="mt-5">
          <GlwJobTimeline entries={snapshot.timeline} />
        </div>
      </article>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-zinc-950/20 sm:p-6" id="glw-job-diagnostics">
        <SectionHeader eyebrow="Diagnostics" title={hasFailure ? "Failure details" : "Result summary"} description={hasFailure ? "Failure stage, callback error, and retry guidance are surfaced here." : "Published output and workflow metadata are summarized here."} />
        <div className="mt-5 space-y-4 text-sm text-zinc-300">
          {hasFailure ? (
            <>
              <DetailRow label="Failure Stage" value={activeJob.error?.step ?? snapshot.currentStage} />
              <DetailRow label="Failure Message" value={activeJob.error?.message ?? "Timed out while waiting for the workflow to complete."} />
              <DetailRow label="n8n Error" value={activeJob.error?.code ?? "--"} />
              <DetailRow label="Retry Recommendation" value="Retry the job once the upstream workflow or callback path is healthy." />
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">Error History</p>
                <div className="mt-3 space-y-3">
                  {errorHistory.length > 0 ? errorHistory.filter((item) => item.status === "FAILED" || item.id === activeJob.id).map((item) => (
                    <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="break-words font-medium text-white">{item.title}</span>
                        <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">{item.status}</span>
                      </div>
                      <p className="mt-2 break-words text-zinc-400">{item.error?.message ?? "No error payload captured."}</p>
                    </div>
                  )) : <p className="text-zinc-500">No prior retry history captured for this job.</p>}
                </div>
              </div>
            </>
          ) : (
            <>
              <ResultRow label="Generated Title" value={result?.title ?? activeJob.title} />
              <ResultRow label="Slug" value={activeJob.input.page.targetSlug} />
              <ResultRow label="SEO Title" value={result?.title ?? activeJob.input.page.title} />
              <ResultRow label="Meta Description" value="Not captured yet" />
              <ResultRow label="Primary Keyword" value={activeJob.input.page.primaryKeyword} />
              <ResultRow label="Secondary Keywords" value={activeJob.input.page.secondaryKeywords.join(", ")} />
              <ResultRow label="Word Count" value={String(activeJob.input.page.wordCount)} />
              <ResultRow label="Images Generated" value={result?.featuredImageUrl ? "1" : "0"} />
              <ResultRow label="WordPress Draft URL" value={result?.wordpressUrl ?? "--"} />
              <ResultRow label="WordPress Post ID" value={String(result?.wordpressPostId ?? result?.wordpressPageId ?? "--")} />
              <ResultRow label="Publish Status" value={activeJob.input.page.status} />
              <ResultRow label="Yoast Status" value={activeJob.status === "COMPLETE" ? "Updated" : "Pending"} />
            </>
          )}
        </div>
      </article>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-zinc-950/20 sm:p-6">
        <SectionHeader eyebrow="Payloads" title="Request & response" description="Stored request and response payloads remain available for operator auditing." />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <pre className="min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs leading-5 text-zinc-300 whitespace-pre-wrap break-words">{JSON.stringify(activeJob.input, null, 2)}</pre>
          <pre className="min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs leading-5 text-zinc-300 whitespace-pre-wrap break-words">{JSON.stringify({ result: activeJob.result, error: activeJob.error }, null, 2)}</pre>
        </div>
      </article>
    </section>
  );
}

function statusBadgeState(displayStatus: string): "running" | "queued" | "succeeded" | "failed" {
  const normalized = displayStatus.toLowerCase();

  if (normalized.includes("complete") || normalized.includes("succeeded")) {
    return "succeeded";
  }

  if (normalized.includes("fail") || normalized.includes("timed out")) {
    return "failed";
  }

  if (normalized.includes("queued") || normalized.includes("starting")) {
    return "queued";
  }

  return "running";
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 shadow-sm shadow-zinc-950/20">
      <dt className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">{label}</dt>
      <dd className="mt-2 break-words text-sm leading-6 text-white">{value}</dd>
    </div>
  );
}

function formatGlwTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "--";
  }

  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-sm text-white">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-sm text-white">{value}</p>
    </div>
  );
}
