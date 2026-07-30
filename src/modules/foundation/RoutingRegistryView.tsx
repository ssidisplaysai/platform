import Link from "next/link";
import { listRoutings } from "./routing-repository";
import type { RoutingStatus } from "./routing-types";

const STATUS_VALUES: readonly RoutingStatus[] = ["draft", "defined", "released", "superseded", "archived", "closed"];

export function RoutingRegistryView(input: {
  query?: string;
  status?: string;
  productReference?: string;
  assemblyReference?: string;
}) {
  const status = STATUS_VALUES.includes(input.status as RoutingStatus)
    ? (input.status as RoutingStatus)
    : undefined;

  const routings = listRoutings({
    query: input.query,
    status,
    productReference: input.productReference || undefined,
    assemblyReference: input.assemblyReference || undefined,
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Routing Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Routing Registry</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Define ordered manufacturing workflows as references only. Routing organizes Operations and does not schedule or execute work.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-4" action="" method="GET">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Search
            <input
              type="text"
              name="query"
              defaultValue={input.query ?? ""}
              placeholder="routing number, product, operation"
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
            Product
            <input
              type="text"
              name="productReference"
              defaultValue={input.productReference ?? ""}
              placeholder="product reference"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Assembly
            <input
              type="text"
              name="assemblyReference"
              defaultValue={input.assemblyReference ?? ""}
              placeholder="assembly reference"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            />
          </label>
          <div className="flex items-end gap-2 md:col-span-4">
            <button
              type="submit"
              className="h-10 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-300 hover:border-amber-400 hover:text-white"
            >
              Apply Filters
            </button>
            <Link
              href="/routings/new"
              className="h-10 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-amber-400 hover:text-white"
            >
              New Routing
            </Link>
          </div>
        </form>
      </header>

      {routings.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          No routings matched the current filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {routings.map((routing) => (
            <li key={routing.documentId} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{routing.organizationId}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{routing.routingNumber}</h2>
                  <p className="text-xs text-zinc-500">{routing.routingName}</p>
                  <p className="mt-2 text-zinc-400">Product: {routing.productReference ?? "none"}</p>
                  <p className="text-zinc-500">Assembly: {routing.assemblyReference ?? "none"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 lg:grid-cols-3">
                  <span className="rounded border border-zinc-700 px-2 py-1">Status: {routing.status}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Version: {routing.version}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Steps: {routing.operationSequence.length}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Site: {routing.lineage.siteReference ?? "none"}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Production Job: {routing.lineage.productionJobId ?? "none"}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Effective: {routing.effectiveDate ?? "none"}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/routings/${routing.documentId}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-amber-400 hover:text-white">
                  Open Routing
                </Link>
                <Link href={`/routings/${routing.documentId}/versions`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-amber-400 hover:text-white">
                  Versions
                </Link>
                <Link href={`/routings/${routing.documentId}/timeline`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-amber-400 hover:text-white">
                  Timeline
                </Link>
                <Link href={`/routings/${routing.documentId}/audit`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-amber-400 hover:text-white">
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