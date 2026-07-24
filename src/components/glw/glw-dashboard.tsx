import { EmptyState } from "./empty-state";
import { DataTable } from "./data-table";
import { MetricCard } from "./metric-card";
import { PageContainer } from "./page-container";
import { SectionHeader } from "./section-header";
import { StatusBadge } from "./status-badge";
import { dashboardMetrics, recentJobs } from "./glw-data";

type RecentJob = (typeof recentJobs)[number];

export function GlwDashboard() {
  return (
    <PageContainer className="space-y-6 sm:space-y-8">
      <SectionHeader
        eyebrow="Dashboard"
        title="LED Display Warehouse"
        description="Daily operating view for content generation, queue health, and recent production activity."
        actions={
          <>
            <button
              type="button"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              Generate Page
            </button>
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

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <article className="rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-950/[0.02]">
          <div className="border-b border-zinc-200 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-base font-semibold tracking-tight text-zinc-950">
                  Recent Jobs
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Production activity across pages, blogs, and sites.
                </p>
              </div>
              <p className="text-sm text-zinc-500">5 jobs shown</p>
            </div>
          </div>

          <DataTable<RecentJob>
            rows={recentJobs}
            rowKey={(job) => job.id}
            emptyState={
              <div className="p-5 sm:p-6">
                <EmptyState
                  title="No jobs yet"
                  description="Recent page and blog generation will appear here once content production is connected."
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
                cell: (job) => (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {job.actionLabel}
                  </button>
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
              description="The current slice is UI-only, so the queue view communicates state through the interface rather than live backend data."
            />
            <div className="mt-5 grid gap-3 text-sm text-zinc-600">
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
                <span>Running jobs</span>
                <span className="font-medium text-zinc-950">3</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
                <span>Failed jobs</span>
                <span className="font-medium text-zinc-950">1</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
                <span>Average job time</span>
                <span className="font-medium text-zinc-950">4m 18s</span>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </PageContainer>
  );
}
