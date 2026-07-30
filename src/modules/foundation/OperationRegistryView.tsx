import Link from "next/link";
import { listOperations } from "./operation-repository";
import type { OperationStatus } from "./operation-types";

const STATUS_VALUES: readonly OperationStatus[] = [
  "draft",
  "defined",
  "ready",
  "released",
  "waiting",
  "completed",
  "cancelled",
  "closed",
];

export function OperationRegistryView(input: {
  query?: string;
  status?: string;
  operationType?: string;
}) {
  const status = STATUS_VALUES.includes(input.status as OperationStatus)
    ? (input.status as OperationStatus)
    : undefined;

  const operations = listOperations({
    query: input.query,
    status,
    operationType: input.operationType || undefined,
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Operation Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Operation Registry</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Define discrete manufacturing steps for production jobs without introducing execution authority.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-4" action="" method="GET">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Search
            <input
              type="text"
              name="query"
              defaultValue={input.query ?? ""}
              placeholder="operation number, job, reference"
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
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Type
            <input
              type="text"
              name="operationType"
              defaultValue={input.operationType ?? ""}
              placeholder="assembly, inspection"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-10 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-300 hover:border-red-500 hover:text-white"
            >
              Apply Filters
            </button>
            <Link
              href="/operations/new"
              className="h-10 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white"
            >
              New Operation
            </Link>
          </div>
        </form>
      </header>

      {operations.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          No operations matched the current filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {operations.map((operation) => (
            <li
              key={operation.documentId}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{operation.organizationId}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{operation.operationNumber}</h2>
                  <p className="text-xs text-zinc-500">{operation.operationName}</p>
                  <p className="mt-2 text-zinc-400">Production Job: {operation.lineage.productionJobId}</p>
                  <p className="text-zinc-500">Work Order: {operation.lineage.workOrderId}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 lg:grid-cols-3">
                  <span className="rounded border border-zinc-700 px-2 py-1">Status: {operation.status}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Sequence: {operation.sequenceNumber}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Type: {operation.operationType}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Reference: {operation.referenceNumber ?? "none"}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Site: {operation.siteReference ?? "none"}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Version: {operation.version}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/operations/${operation.documentId}`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Open Operation
                </Link>
                <Link
                  href={`/operations/${operation.documentId}/timeline`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Timeline
                </Link>
                <Link
                  href={`/operations/${operation.documentId}/audit`}
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
