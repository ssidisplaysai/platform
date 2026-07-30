import { listProductionJobs } from "./production-job-repository";

export function ProductionJobSummaryView() {
  const jobs = listProductionJobs();

  const totals = {
    total: jobs.length,
    draft: jobs.filter((entry) => entry.status === "draft").length,
    queued: jobs.filter((entry) => entry.status === "queued").length,
    ready: jobs.filter((entry) => entry.status === "ready").length,
    released: jobs.filter((entry) => entry.status === "released").length,
    active: jobs.filter((entry) => entry.status === "running" || entry.status === "paused").length,
    completed: jobs.filter((entry) => entry.status === "completed").length,
    closedOrCancelled: jobs.filter((entry) => entry.status === "closed" || entry.status === "cancelled").length,
  };

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Execution Summary</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Production Job Lifecycle Overview</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Snapshot of manufacturing execution-authorizing jobs and bounded lifecycle progression.
        </p>
      </header>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="grid grid-cols-2 gap-3 text-sm text-zinc-300 lg:grid-cols-4">
          <span className="rounded border border-zinc-700 px-3 py-2">Total: {totals.total}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Draft: {totals.draft}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Queued: {totals.queued}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Ready: {totals.ready}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Released: {totals.released}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Active: {totals.active}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Completed: {totals.completed}</span>
          <span className="rounded border border-zinc-700 px-3 py-2">Closed or Cancelled: {totals.closedOrCancelled}</span>
        </div>
      </article>
    </section>
  );
}
