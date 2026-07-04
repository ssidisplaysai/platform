const tasks = [
  "Approve pending quote strategy",
  "Review active project pipeline",
  "Check manufacturing capacity",
  "Confirm inventory risk items",
  "Review STONER brand development priorities",
];

export function PriorityTasks() {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-red-500">
        Priority Tasks
      </p>

      <h2 className="mt-2 text-2xl font-semibold text-white">
        Today’s command priorities
      </h2>

      <div className="mt-5 space-y-3">
        {tasks.map((task) => (
          <div
            key={task}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <span className="h-3 w-3 rounded-full border border-red-500" />
            <p className="text-sm text-zinc-300">{task}</p>
          </div>
        ))}
      </div>
    </section>
  );
}