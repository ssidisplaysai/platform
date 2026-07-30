import { listOperations } from "./operation-repository";

export function OperationSummaryView() {
  const operations = listOperations();

  const totals = {
    total: operations.length,
    draft: operations.filter((entry) => entry.status === "draft").length,
    defined: operations.filter((entry) => entry.status === "defined").length,
    ready: operations.filter((entry) => entry.status === "ready").length,
    released: operations.filter((entry) => entry.status === "released").length,
    waiting: operations.filter((entry) => entry.status === "waiting").length,
    completed: operations.filter((entry) => entry.status === "completed").length,
    cancelledOrClosed: operations.filter((entry) => entry.status === "cancelled" || entry.status === "closed").length,
  };

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Operation Summary</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Operation Lifecycle Overview</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Snapshot of operation definitions, status distribution, and bounded manufacturing step governance.
        </p>
      </header>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="grid grid-cols-2 gap-3 text-sm text-zinc-300 lg:grid-cols-4">
          <span className="rounded border border-zinc-700 px-3 py-2">Total: {totals.total}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Draft: {totals.draft}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Defined: {totals.defined}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Ready: {totals.ready}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Released: {totals.released}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Waiting: {totals.waiting}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Completed: {totals.completed}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Cancelled or Closed: {totals.cancelledOrClosed}</span>
        </div>
      </article>
    </section>
  );
}
