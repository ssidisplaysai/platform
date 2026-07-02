export function CEOBriefing() {
  return (
    <div className="rounded-2xl border border-red-900/40 bg-zinc-900 p-8">
      <h2 className="text-3xl font-bold">CEO Briefing</h2>

      <p className="mt-2 text-zinc-400">Wednesday, July 2</p>

      <div className="mt-8 space-y-4">
        <div className="rounded-lg bg-zinc-950 p-4">
          🔴 Ripley&apos;s Aquarium requires shipping confirmation.
        </div>

        <div className="rounded-lg bg-zinc-950 p-4">
          🟠 RJ Metal has 3 jobs awaiting material.
        </div>

        <div className="rounded-lg bg-zinc-950 p-4">
          🟢 LED Display Warehouse received 12 new leads.
        </div>

        <div className="rounded-lg bg-zinc-950 p-4">
          🔵 AI completed yesterday&apos;s automation run.
        </div>
      </div>
    </div>
  );
}