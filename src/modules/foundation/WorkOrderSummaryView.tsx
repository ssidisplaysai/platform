import { listWorkOrders } from "./work-order-repository";

export function WorkOrderSummaryView() {
  const workOrders = listWorkOrders();

  const totals = {
    total: workOrders.length,
    draft: workOrders.filter((entry) => entry.status === "draft").length,
    planned: workOrders.filter((entry) => entry.status === "planned").length,
    released: workOrders.filter((entry) => entry.status === "released").length,
    active: workOrders.filter((entry) => entry.status === "in_production" || entry.status === "paused").length,
    completed: workOrders.filter((entry) => entry.status === "completed").length,
    closedOrCancelled: workOrders.filter((entry) => entry.status === "closed" || entry.status === "cancelled").length,
  };

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Manufacturing Summary</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Work Order Lifecycle Overview</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Snapshot of work-order commitments and bounded lifecycle progression for enterprise manufacturing governance.
        </p>
      </header>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="grid grid-cols-2 gap-3 text-sm text-zinc-300 lg:grid-cols-4">
          <span className="rounded border border-zinc-700 px-3 py-2">Total: {totals.total}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Draft: {totals.draft}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Planned: {totals.planned}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Released: {totals.released}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Active: {totals.active}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Completed: {totals.completed}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Closed or Cancelled: {totals.closedOrCancelled}</span>
        </div>
      </article>
    </section>
  );
}
