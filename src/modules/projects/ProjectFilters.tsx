export function ProjectFilters() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-medium text-white">Project Filters</p>

        <p className="text-sm text-zinc-500">
          Filter by status, priority, company, or customer.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:border-red-500">
          All
        </button>

        <button className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:border-red-500">
          Active
        </button>

        <button className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:border-red-500">
          Planning
        </button>

        <button className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:border-red-500">
          At Risk
        </button>
      </div>
    </div>
  );
}