import { DashboardService } from "@/core/services/DashboardService";

export function ExecutiveBriefing() {
  const dashboard = DashboardService.getExecutiveDashboard();

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-red-500">
            Executive Briefing
          </p>

          <h1 className="mt-3 text-4xl font-bold text-white">
            Good Morning, Robert
          </h1>

          <p className="mt-4 max-w-3xl text-zinc-400">
            Genesis OS is currently tracking {dashboard.companies.total} companies
            and {dashboard.projects.total} projects across the operating system.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-right">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            System Status
          </p>

          <p className="mt-2 text-lg font-semibold text-emerald-400">
            ● All Systems Operational
          </p>

          <p className="mt-2 text-xs text-zinc-500">
            {dashboard.projects.active} active project
            {dashboard.projects.active === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </section>
  );
}