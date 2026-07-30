import Link from "next/link";
import { listProductionJobs } from "./production-job-repository";
import type { ProductionJobStatus } from "./production-job-types";

const STATUS_VALUES: readonly ProductionJobStatus[] = [
  "draft",
  "queued",
  "ready",
  "released",
  "running",
  "paused",
  "completed",
  "cancelled",
  "closed",
];

export function ProductionJobsRegistryView(input: {
  query?: string;
  status?: string;
}) {
  const status = STATUS_VALUES.includes(input.status as ProductionJobStatus)
    ? (input.status as ProductionJobStatus)
    : undefined;

  const productionJobs = listProductionJobs({
    query: input.query,
    status,
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Production Job Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Genesis Production Job Registry</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Govern execution-authorizing production jobs with deterministic lifecycle transitions, immutable lineage, revision control, and audit traceability.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-3" action="" method="GET">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Search
            <input
              type="text"
              name="query"
              defaultValue={input.query ?? ""}
              placeholder="job number, work order, customer"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Status
            <select
              name="status"
              defaultValue={status ?? ""}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            >
              <option value="">All Statuses</option>
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-10 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-300 hover:border-red-500 hover:text-white"
            >
              Apply Filters
            </button>
            <Link
              href="/production-jobs/new"
              className="h-10 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white"
            >
              New Production Job
            </Link>
          </div>
        </form>
      </header>

      {productionJobs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          No production jobs matched the current filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {productionJobs.map((job) => (
            <li
              key={job.documentId}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{job.organizationId}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{job.productionJobNumber}</h2>
                  <p className="text-xs text-zinc-500">{job.customerReference}</p>
                  <p className="mt-2 text-zinc-400">Work Order: {job.lineage.workOrderId}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 lg:grid-cols-3">
                  <span className="rounded border border-zinc-700 px-2 py-1">Status: {job.status}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Revision: {job.revision}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Version: {job.version}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Lines: {job.lines.length}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Site: {job.siteReference ?? "none"}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Reference: {job.referenceNumber ?? "none"}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/production-jobs/${job.documentId}`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Open Production Job
                </Link>
                <Link
                  href={`/production-jobs/${job.documentId}/timeline`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Timeline
                </Link>
                <Link
                  href={`/production-jobs/${job.documentId}/audit`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Audit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
