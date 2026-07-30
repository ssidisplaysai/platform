import Link from "next/link";
import { listWorkOrders } from "./work-order-repository";
import type { WorkOrderStatus } from "./work-order-types";

const STATUS_VALUES: readonly WorkOrderStatus[] = [
  "draft",
  "planned",
  "released",
  "in_production",
  "paused",
  "completed",
  "cancelled",
  "closed",
];

export function WorkOrdersRegistryView(input: {
  query?: string;
  status?: string;
}) {
  const status = STATUS_VALUES.includes(input.status as WorkOrderStatus)
    ? (input.status as WorkOrderStatus)
    : undefined;

  const workOrders = listWorkOrders({
    query: input.query,
    status,
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Work Order Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Genesis Work Order Registry</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Govern manufacturing commitments with deterministic lifecycle transitions, enterprise lineage, revision control, and audit traceability.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-3" action="" method="GET">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Search
            <input
              type="text"
              name="query"
              defaultValue={input.query ?? ""}
              placeholder="work order, customer, sales order"
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
              href="/work-orders/new"
              className="h-10 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white"
            >
              New Work Order
            </Link>
          </div>
        </form>
      </header>

      {workOrders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          No work orders matched the current filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {workOrders.map((workOrder) => (
            <li
              key={workOrder.documentId}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{workOrder.organizationId}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{workOrder.workOrderNumber}</h2>
                  <p className="text-xs text-zinc-500">{workOrder.customerReference}</p>
                  <p className="mt-2 text-zinc-400">Sales Order: {workOrder.commercialLineage.originSalesOrderId}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 lg:grid-cols-3">
                  <span className="rounded border border-zinc-700 px-2 py-1">Status: {workOrder.status}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Revision: {workOrder.revision}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Version: {workOrder.version}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Lines: {workOrder.lines.length}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Site: {workOrder.siteReference ?? "none"}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Reference: {workOrder.referenceNumber ?? "none"}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/work-orders/${workOrder.documentId}`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Open Work Order
                </Link>
                <Link
                  href={`/work-orders/${workOrder.documentId}/timeline`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Timeline
                </Link>
                <Link
                  href={`/work-orders/${workOrder.documentId}/audit`}
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
