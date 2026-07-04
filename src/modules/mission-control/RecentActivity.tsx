const activity = [
  "Genesis UI Foundation components committed to GitHub",
  "Projects module shell created",
  "Company workspace now uses modular project components",
  "Data layer foundation started",
  "Mission Control module initialized",
];

export function RecentActivity() {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-red-500">
        Recent Activity
      </p>

      <h2 className="mt-2 text-2xl font-semibold text-white">
        System timeline
      </h2>

      <div className="mt-5 space-y-3">
        {activity.map((item) => (
          <div
            key={item}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <p className="text-sm text-zinc-300">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}