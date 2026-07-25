"use client";

import { useMemo, useState, useTransition } from "react";
import { DataTable } from "./data-table";
import { EmptyState } from "./empty-state";
import { PageContainer } from "./page-container";
import { SectionHeader } from "./section-header";
import { StatusBadge } from "./status-badge";
import {
  formatGlwJobCreatedTime,
  formatGlwJobDuration,
  getGlwLocationLabel,
  type GlwJobFilter,
  type GlwJobRecord,
} from "@/lib/glw/jobs";

type GlwQueueWorkspaceProps = {
  initialJobs: GlwJobRecord[];
};

type QueuePayload = {
  jobs?: GlwJobRecord[];
  error?: string;
};

function toBadgeStatus(job: GlwJobRecord): "queued" | "running" | "succeeded" | "failed" {
  if (job.status === "FAILED") {
    return "failed";
  }

  if (job.status === "COMPLETE") {
    return "succeeded";
  }

  if (job.status === "QUEUED") {
    return "queued";
  }

  return "running";
}

export function GlwQueueWorkspace({ initialJobs }: GlwQueueWorkspaceProps) {
  const [jobs, setJobs] = useState<GlwJobRecord[]>(initialJobs);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GlwJobFilter>("active");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  const rows = useMemo(() => jobs.map((job) => ({
    id: job.id,
    status: toBadgeStatus(job),
    state: job.status,
    title: job.title,
    site: job.input.site.name,
    product: job.input.page.product,
    keyword: job.input.page.primaryKeyword,
    location: getGlwLocationLabel(job.input.page),
    created: formatGlwJobCreatedTime(job),
    duration: formatGlwJobDuration(job),
    retryOfJobId: job.retryOfJobId,
  })), [jobs]);

  const refresh = () => {
    startTransition(async () => {
      const params = new URLSearchParams({
        filter,
        q: query,
        limit: "200",
      });

      const response = await fetch(`/api/glw/jobs?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const payload = await response.json().catch(() => null) as QueuePayload | null;

      if (!response.ok || !payload?.jobs) {
        setError(payload?.error ?? "Unable to refresh queue jobs.");
        return;
      }

      setError(null);
      setJobs(payload.jobs);
    });
  };

  return (
    <PageContainer className="space-y-6 sm:space-y-8">
      <SectionHeader
        eyebrow="Queue"
        title="Execution queue"
        description="Track live page jobs, isolate failures, and search by title, keyword, location, or execution id."
        actions={
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? "Refreshing..." : "Refresh queue"}
          </button>
        }
      />

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-950/[0.02]">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {(["active", "all", "complete", "failed"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setFilter(option);
                  startTransition(async () => {
                    const params = new URLSearchParams({
                      filter: option,
                      q: query,
                      limit: "200",
                    });

                    const response = await fetch(`/api/glw/jobs?${params.toString()}`, {
                      cache: "no-store",
                      credentials: "include",
                    });

                    const payload = await response.json().catch(() => null) as QueuePayload | null;

                    if (!response.ok || !payload?.jobs) {
                      setError(payload?.error ?? "Unable to load queue jobs.");
                      return;
                    }

                    setError(null);
                    setJobs(payload.jobs);
                  });
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] transition ${
                  filter === option
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, keyword, city, state, or job id"
              className="w-full min-w-64 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg bg-zinc-950 px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white transition hover:bg-zinc-800"
            >
              Apply
            </button>
          </div>
        </div>

        {error ? (
          <p className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 sm:px-6">{error}</p>
        ) : null}

        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          emptyState={
            <div className="p-5 sm:p-6">
              <EmptyState
                title="No queue jobs found"
                description="Try a different filter or search, or generate a new page job in the Pages workspace."
              />
            </div>
          }
          columns={[
            {
              header: "Status",
              className: "whitespace-nowrap",
              cell: (row) => <StatusBadge status={row.status} />,
            },
            {
              header: "Job",
              className: "min-w-[22rem]",
              cell: (row) => (
                <div className="space-y-1">
                  <p className="font-medium text-zinc-950">{row.title}</p>
                  <p className="text-xs text-zinc-500">{row.id}</p>
                </div>
              ),
            },
            {
              header: "Product",
              className: "whitespace-nowrap text-zinc-600",
              cell: (row) => <span>{row.product}</span>,
            },
            {
              header: "Primary Keyword",
              className: "whitespace-nowrap text-zinc-600",
              cell: (row) => <span>{row.keyword}</span>,
            },
            {
              header: "Site",
              className: "whitespace-nowrap text-zinc-600",
              cell: (row) => <span>{row.site}</span>,
            },
            {
              header: "Location",
              className: "whitespace-nowrap text-zinc-600",
              cell: (row) => <span>{row.location}</span>,
            },
            {
              header: "Created",
              className: "whitespace-nowrap text-zinc-600",
              cell: (row) => <span>{row.created}</span>,
            },
            {
              header: "Duration",
              className: "whitespace-nowrap text-zinc-600",
              cell: (row) => <span>{row.duration}</span>,
            },
            {
              header: "Retry Of",
              className: "whitespace-nowrap text-zinc-600",
              cell: (row) => <span>{row.retryOfJobId ?? "--"}</span>,
            },
          ]}
        />
      </section>
    </PageContainer>
  );
}
