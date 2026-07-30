import { listRoutings } from "./routing-repository";

export function RoutingSummaryView() {
  const routings = listRoutings();
  const counts = routings.reduce<Record<string, number>>((accumulator, routing) => {
    accumulator[routing.status] = (accumulator[routing.status] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Routing Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Routing Summary</h1>
        <p className="mt-2 text-sm text-zinc-400">
          The summary tracks declarative process definitions and their current lifecycle distribution.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(counts).length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300 md:col-span-3">
            No routings have been recorded yet.
          </div>
        ) : (
          Object.entries(counts).map(([status, count]) => (
            <div key={status} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{status}</p>
              <p className="mt-2 text-3xl font-bold text-white">{count}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}