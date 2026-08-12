"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "./empty-state";
import { DataTable } from "./data-table";
import { MetricCard } from "./metric-card";
import { PageContainer } from "./page-container";
import { SectionHeader } from "./section-header";
import { StatusBadge } from "./status-badge";
import { GlwNationalPlanningPanel } from "./glw-national-planning-panel";
import type { GlwJobRecord } from "@/lib/glw/jobs";
import { formatGlwJobDuration, getGlwLocationLabel } from "@/lib/glw/jobs";

type GlwDashboardProps = {
  metrics: {
    total: number;
    active: number;
    complete: number;
    failed: number;
    avgDurationMs: number;
  };
  recentJobs: GlwJobRecord[];
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

function formatAverageDuration(durationMs: number): string {
  if (durationMs <= 0) {
    return "--";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function GlwDashboard({ metrics, recentJobs }: GlwDashboardProps) {
  const [liveMetrics, setLiveMetrics] = useState(metrics);
  const [liveRecentJobs, setLiveRecentJobs] = useState(recentJobs);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const response = await fetch("/api/glw/dashboard?limit=20", {
        credentials: "include",
        cache: "no-store",
      }).catch(() => null);

      if (!response || !response.ok) {
        return;
      }

      const payload = await response.json().catch(() => null) as {
        metrics?: GlwDashboardProps["metrics"];
        recentJobs?: GlwJobRecord[];
      } | null;

      if (!payload || cancelled) {
        return;
      }

      if (payload.metrics) {
        setLiveMetrics(payload.metrics);
      }

      if (payload.recentJobs) {
        setLiveRecentJobs(payload.recentJobs);
      }
    };

    poll();
    const interval = window.setInterval(poll, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const dashboardMetrics = useMemo(() => [
    {
      label: "Total Jobs",
      value: String(liveMetrics.total),
      detail: "All tracked page-generation jobs.",
    },
    {
      label: "Running Jobs",
      value: String(liveMetrics.active),
      detail: "Queued or in-progress page workflows.",
    },
    {
      label: "Completed Jobs",
      value: String(liveMetrics.complete),
      detail: "Successfully published page outputs.",
    },
    {
      label: "Failed Jobs",
      value: String(liveMetrics.failed),
      detail: "Jobs requiring operator retry or correction.",
    },
    {
      label: "Average Job Time",
      value: formatAverageDuration(liveMetrics.avgDurationMs),
      detail: "Average across completed jobs.",
    },
  ], [liveMetrics]);

  const rows = liveRecentJobs.map((job) => ({
    id: job.id,
    status: toBadgeStatus(job),
    type: "Page",
    site: job.input.site.name,
    title: job.title,
    started: job.startedAt ?? "--",
    duration: formatGlwJobDuration(job),
    location: getGlwLocationLabel(job.input.page),
  }));

  return (
    <PageContainer className="space-y-6 sm:space-y-8">
      <SectionHeader
        eyebrow="Dashboard"
        title="LED Display Warehouse"
        description="Daily operating view for content generation, queue health, and recent production activity."
        actions={
          <>
            <Link
              href="/glw/pages"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              Generate Page
            </Link>
            <button
              type="button"
              className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Generate Blog
            </button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
        ))}
      </section>

      <GlwNationalPlanningPanel />

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <article className="rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-950/[0.02]">
          <div className="border-b border-zinc-200 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-base font-semibold tracking-tight text-zinc-950">
                  Recent Jobs
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Persisted page-generation workflow activity.
                </p>
              </div>
              <p className="text-sm text-zinc-500">{rows.length} jobs shown</p>
            </div>
          </div>

          <DataTable
            rows={rows}
            rowKey={(job) => job.id}
            emptyState={
              <div className="p-5 sm:p-6">
                <EmptyState
                  title="No jobs yet"
                  description="Recent page generation jobs will appear after the first workflow request."
                />
              </div>
            }
            columns={[
              {
                header: "Status",
                className: "whitespace-nowrap",
                cell: (job) => <StatusBadge status={job.status} />,
              },
              {
                header: "Type",
                className: "whitespace-nowrap text-zinc-600",
                cell: (job) => <span className="font-medium text-zinc-700">{job.type}</span>,
              },
              {
                header: "Location",
                className: "whitespace-nowrap text-zinc-600",
                cell: (job) => <span>{job.location}</span>,
              },
              {
                header: "Site",
                className: "min-w-44 text-zinc-600",
                cell: (job) => <span>{job.site}</span>,
              },
              {
                header: "Title",
                className: "min-w-80",
                cell: (job) => (
                  <div className="max-w-[32rem] space-y-1">
                    <p className="font-medium text-zinc-950">{job.title}</p>
                    <p className="text-xs text-zinc-500">{job.id}</p>
                  </div>
                ),
              },
              {
                header: "Started",
                className: "whitespace-nowrap text-zinc-600",
                cell: (job) => <span>{job.started}</span>,
              },
              {
                header: "Duration",
                className: "whitespace-nowrap text-zinc-600",
                cell: (job) => <span className="font-medium text-zinc-700">{job.duration}</span>,
              },
              {
                header: "Action",
                className: "whitespace-nowrap text-right",
                cell: () => (
                  <span className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700">
                    Open in Pages
                  </span>
                ),
              },
            ]}
          />
        </article>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/[0.02] sm:p-6">
            <SectionHeader
              eyebrow="Workspace"
              title="Operational focus"
              description="GLW stays centered on pages, blogs, queue, and site workflows without visual clutter."
            />
            <div className="mt-5 space-y-3 text-sm leading-6 text-zinc-600">
              <p>LED Display Warehouse is the active workspace.</p>
              <p>California Outdoor LED, Sphere Rental Dallas, and Projection Screen Chicago are available in the selector for quick context switching.</p>
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/[0.02] sm:p-6">
            <SectionHeader
              eyebrow="Queue"
              title="Execution summary"
              description="Live summary from persisted page-generation job records."
            />
            <div className="mt-5 grid gap-3 text-sm text-zinc-600">
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
                <span>Running jobs</span>
                <span className="font-medium text-zinc-950">{liveMetrics.active}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
                <span>Failed jobs</span>
                <span className="font-medium text-zinc-950">{liveMetrics.failed}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
                <span>Average job time</span>
                <span className="font-medium text-zinc-950">{formatAverageDuration(liveMetrics.avgDurationMs)}</span>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </PageContainer>
  );
}
