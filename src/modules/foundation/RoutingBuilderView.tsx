import Link from "next/link";

export function RoutingBuilderView() {
  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Routing Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Routing Builder</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Build a repeatable process definition as references only. This surface does not schedule, assign, or execute work.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/routings" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-amber-400 hover:text-white">
            Back to Registry
          </Link>
          <Link href="/routings/summary" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-amber-400 hover:text-white">
            Routing Summary
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-white">Definition Surface</h2>
          <p className="mt-2 text-zinc-400">
            A routing captures operation order, dependency references, parallel groups, branch references, and estimated times.
          </p>
          <ul className="mt-4 space-y-2 text-zinc-400">
            <li>Routing number and routing name</li>
            <li>Product and assembly references</li>
            <li>Ordered operation sequence</li>
            <li>Predecessor and successor references</li>
            <li>Referenced work centers, machine types, and skills</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-white">Boundary</h2>
          <p className="mt-2 text-zinc-400">
            Routing remains declarative. It does not create schedules, assign machines, reserve inventory, or execute operations.
          </p>
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-400">
            This builder surface is intentionally references-only.
          </div>
        </div>
      </div>
    </section>
  );
}