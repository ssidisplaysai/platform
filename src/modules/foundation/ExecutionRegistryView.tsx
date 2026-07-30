import Link from "next/link";
import { listExecutions } from "./execution-repository";
import type { ExecutionStatus } from "./execution-types";

const STATUS_VALUES: readonly ExecutionStatus[] = [
  "created",
  "ready",
  "waiting",
  "running",
  "paused",
  "blocked",
  "resumed",
  "completed",
  "cancelled",
  "failed",
  "recovered",
  "archived",
];

export function ExecutionRegistryView(input: {
  query?: string;
  status?: string;
  scheduleId?: string;
  productionJobId?: string;
}) {
  const status = STATUS_VALUES.includes(input.status as ExecutionStatus)
    ? (input.status as ExecutionStatus)
    : undefined;

  const executions = listExecutions({
    query: input.query,
    status,
    scheduleId: input.scheduleId || undefined,
    productionJobId: input.productionJobId || undefined,
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Execution Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Execution Registry</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Track manufacturing execution sessions, activities, and revision history without introducing control logic.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-4" action="" method="GET">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Search
            <input
              type="text"
              name="query"
              defaultValue={input.query ?? ""}
              placeholder="execution number, job, schedule"
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
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Schedule Id
            <input
              type="text"
              name="scheduleId"
              defaultValue={input.scheduleId ?? ""}
              placeholder="schedule reference"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-10 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-300 hover:border-cyan-400 hover:text-white"
            >
              Apply Filters
            </button>
            <Link
              href="/executions/new"
              className="h-10 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-cyan-400 hover:text-white"
            >
              New Execution
            </Link>
          </div>
        </form>
      </header>

      {executions.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          No executions matched the current filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {executions.map((execution) => (
            <li
              key={execution.documentId}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{execution.organizationId}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{execution.executionNumber}</h2>
                  <p className="text-xs text-zinc-500">{execution.executionName}</p>
                  <p className="mt-2 text-zinc-400">Schedule: {execution.lineage.scheduleId ?? "none"}</p>
                  <p className="text-zinc-500">Production Job: {execution.lineage.productionJobId ?? "none"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 lg:grid-cols-3">
                  <span className="rounded border border-zinc-700 px-2 py-1">Status: {execution.status}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Progress: {execution.progress}%</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Version: {execution.version}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Site: {execution.lineage.siteReference ?? "none"}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Operations: {execution.lineage.operationId ?? "none"}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Work Order: {execution.lineage.workOrderId ?? "none"}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/executions/${execution.documentId}`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-cyan-400 hover:text-white"
                >
                  Open Execution
                </Link>
                <Link
                  href={`/executions/${execution.documentId}/timeline`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-cyan-400 hover:text-white"
                >
                  Timeline
                </Link>
                <Link
                  href={`/executions/${execution.documentId}/audit`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-cyan-400 hover:text-white"
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
