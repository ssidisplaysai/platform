export function ExecutiveBriefing() {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-red-500">
            Executive Briefing
          </p>

          <h1 className="mt-3 text-4xl font-bold text-white">
            Good Morning, Robert
          </h1>

          <p className="mt-4 max-w-3xl text-zinc-400">
            Welcome back to Genesis OS. Here's the current health of your
            companies and the most important priorities requiring your
            attention today.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-right">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            System Status
          </p>

          <p className="mt-2 text-lg font-semibold text-emerald-400">
            ● All Systems Operational
          </p>
        </div>
      </div>
    </section>
  );
}