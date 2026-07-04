const actions = [
  "Create Project",
  "Create Customer",
  "Create Quote",
  "Open AI Command",
  "Review Companies",
];

export function QuickActions() {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-red-500">
        Quick Actions
      </p>

      <h2 className="mt-2 text-2xl font-semibold text-white">
        Launch common workflows
      </h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <button
            key={action}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left text-sm font-medium text-zinc-300 hover:border-red-500 hover:text-white"
          >
            {action}
          </button>
        ))}
      </div>
    </section>
  );
}