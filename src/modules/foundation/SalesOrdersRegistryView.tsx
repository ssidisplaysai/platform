import Link from "next/link";
import { listSalesOrders } from "./sales-order-repository";
import type { SalesOrderStatus } from "./sales-order-types";

const STATUS_VALUES: readonly SalesOrderStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "released",
  "in_fulfillment",
  "completed",
  "cancelled",
  "closed",
];

export function SalesOrdersRegistryView(input: {
  query?: string;
  status?: string;
}) {
  const status = STATUS_VALUES.includes(input.status as SalesOrderStatus)
    ? (input.status as SalesOrderStatus)
    : undefined;

  const orders = listSalesOrders({
    query: input.query,
    status,
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Sales Order Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Genesis Sales Order Registry</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Govern operational sales commitments with quote lineage, lifecycle controls, revision history, and audit traceability.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-3" action="" method="GET">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Search
            <input
              type="text"
              name="query"
              defaultValue={input.query ?? ""}
              placeholder="order number, customer, quote"
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
              href="/orders/new"
              className="h-10 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white"
            >
              New Order
            </Link>
          </div>
        </form>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          No sales orders matched the current filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li
              key={order.documentId}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{order.organizationId}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{order.orderNumber}</h2>
                  <p className="text-xs text-zinc-500">{order.customerReference}</p>
                  <p className="mt-2 text-zinc-400">Quote: {order.quoteLineage.quoteId}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 lg:grid-cols-3">
                  <span className="rounded border border-zinc-700 px-2 py-1">Status: {order.status}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Approval: {order.approvalStatus}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Revision: {order.revision}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Lines: {order.lines.length}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Total: {order.totals.grandTotal.toFixed(2)}</span>
                  <span className="rounded border border-zinc-700 px-2 py-1">Currency: {order.currency}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/orders/${order.documentId}`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Open Order
                </Link>
                <Link
                  href={`/orders/${order.documentId}/timeline`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                >
                  Timeline
                </Link>
                <Link
                  href={`/orders/${order.documentId}/audit`}
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
