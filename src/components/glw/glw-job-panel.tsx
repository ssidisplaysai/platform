"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "./empty-state";
import { SectionHeader } from "./section-header";
import { StatusBadge } from "./status-badge";
import type { GlwJobRecord } from "@/lib/glw/jobs";
import { formatGlwJobDuration, getGlwLocationLabel } from "@/lib/glw/jobs";

type GlwJobPanelProps = {
  job: GlwJobRecord | null;
  onRetry: (jobId: string) => Promise<GlwJobRecord>;
  onGenerateAnother: () => void;
};

export function GlwJobPanel({ job: initialJob, onRetry, onGenerateAnother }: GlwJobPanelProps) {
  const router = useRouter();
  const [job, setJob] = useState<GlwJobRecord | null>(initialJob);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const elapsedTime = useMemo(() => {
    if (!job?.startedAt) {
      return "--";
    }

    return formatGlwJobDuration(job);
  }, [job]);

  useEffect(() => {
    if (!job || (job.status !== "QUEUED" && job.status !== "STARTING" && job.status !== "RUNNING" && job.status !== "GENERATING_CONTENT" && job.status !== "GENERATING_IMAGE" && job.status !== "UPLOADING_IMAGE" && job.status !== "PUBLISHING")) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      setIsRefreshing(true);

      try {
        const response = await fetch(`/api/glw/jobs/${job.id}`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { job?: GlwJobRecord };

        if (!cancelled && payload.job) {
          setJob(payload.job);
          router.refresh();
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    };

    poll();
    const interval = window.setInterval(poll, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [job, router]);

  const wordpressUrl = job?.result && "wordpressUrl" in job.result ? job.result.wordpressUrl : undefined;

  const handleRetry = async () => {
    if (!job) {
      return;
    }

    setIsRetrying(true);
    setErrorMessage(null);

    try {
      const retriedJob = await onRetry(job.id);
      setJob(retriedJob);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Retry failed.");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Pages"
        title="Pages"
        description="Generate production page requests, track workflow execution, and review WordPress output from a single operator view."
        actions={
          <button
            type="button"
            onClick={onGenerateAnother}
            className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Generate Page
          </button>
        }
      />

      {job ? (
        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <article className="rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-950/[0.02]">
            <div className="border-b border-zinc-200 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
                    Job detail
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Live job status updates come from the GLW job record.
                  </p>
                </div>
                <StatusBadge status={job.status === "QUEUED" ? "queued" : job.status === "STARTING" || job.status === "RUNNING" || job.status === "GENERATING_CONTENT" || job.status === "GENERATING_IMAGE" || job.status === "UPLOADING_IMAGE" || job.status === "PUBLISHING" ? "running" : job.status === "COMPLETE" ? "succeeded" : "failed"} />
              </div>
            </div>

            <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
              <Detail label="Job ID" value={job.id} />
              <Detail label="Site" value={job.input.site.name} />
              <Detail label="Requested page" value={job.title} />
              <Detail label="Current status" value={job.status.replaceAll("_", " ")} />
              <Detail label="Started time" value={job.startedAt ?? "--"} />
              <Detail label="Elapsed time" value={elapsedTime} />
              <Detail label="Completed time" value={job.completedAt ?? "--"} />
              <Detail label="Location" value={getGlwLocationLabel(job.input.page)} />
            </dl>

            <div className="border-t border-zinc-200 px-5 py-4 sm:px-6">
              {job.status === "FAILED" && job.error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <p className="font-medium">{job.error.message}</p>
                  {job.error.step ? <p className="mt-1 text-rose-700">Step: {job.error.step}</p> : null}
                  {errorMessage ? <p className="mt-2 text-rose-700">{errorMessage}</p> : null}
                </div>
              ) : errorMessage ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {errorMessage}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                {job.status === "FAILED" ? (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRetrying ? "Retrying..." : "Retry Page"}
                  </button>
                ) : null}

                {job.status === "COMPLETE" && wordpressUrl ? (
                  <a
                    href={wordpressUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    Open WordPress Page
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={onGenerateAnother}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  Generate Another Page
                </button>
              </div>

              {isRefreshing ? <p className="mt-3 text-xs text-zinc-500">Refreshing status from GLW job record...</p> : null}
            </div>
          </article>

          <aside className="space-y-4">
            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/[0.02] sm:p-6">
              <SectionHeader eyebrow="Requested page" title="Input" description="The original request is stored with the job and reused for retries." />
              <div className="mt-5 space-y-3 text-sm text-zinc-600">
                <p><span className="font-medium text-zinc-950">Product:</span> {job.input.page.product}</p>
                <p><span className="font-medium text-zinc-950">Category:</span> {job.input.page.category}</p>
                <p><span className="font-medium text-zinc-950">Primary keyword:</span> {job.input.page.primaryKeyword}</p>
                <p><span className="font-medium text-zinc-950">Publishing mode:</span> {job.input.page.publishingMode}</p>
                <p><span className="font-medium text-zinc-950">Additional instructions:</span> {job.input.page.additionalInstructions ?? "None"}</p>
              </div>
            </article>
          </aside>
        </section>
      ) : (
        <EmptyState
          title="No page-generation job selected"
          description="Generate a page to create the first tracked GLW job and watch its status appear here."
        />
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">{label}</dt>
      <dd className="mt-2 break-words text-sm leading-6 text-zinc-950">{value}</dd>
    </div>
  );
}
