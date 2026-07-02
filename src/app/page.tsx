import { AppShell } from "@/components/layout/app-shell";
import { DashboardCard } from "@/components/dashboard/dashboard-card";

const companies = [
  ["SSI", "Screen Solutions International"],
  ["RJ Metal", "Manufacturing and fabrication"],
  ["Green Machine Works", "Pre-roll manufacturing systems"],
  ["LED Display Warehouse", "LED products, ecommerce, and dealer sales"],
];

const systems = [
  ["Open Projects", "137 active records"],
  ["AI Agents", "12 planned agents"],
  ["Automation", "n8n workflow center"],
  ["Documents", "Project Genesis library"],
];

export default function Home() {
  return (
    <AppShell>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-red-500">
            Mission Control
          </p>

          <h1 className="mt-4 text-5xl font-black tracking-tight">
            Good afternoon, Robert.
          </h1>

          <p className="mt-4 max-w-2xl text-zinc-400">
            Enterprise command center for Stoner Brands, SSI, RJ Metal, Green
            Machine Works, LED Display Warehouse, and future operating companies.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-right">
          <p className="text-sm text-zinc-500">Platform Status</p>
          <p className="mt-1 text-lg font-semibold text-green-400">Online</p>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-4 gap-5">
        <DashboardCard title="Revenue" subtitle="$0 connected" />
        <DashboardCard title="Projects" subtitle="Awaiting database" />
        <DashboardCard title="Manufacturing" subtitle="Modules planned" />
        <DashboardCard title="AI Workforce" subtitle="Architecture ready" />
      </div>

      <h2 className="mt-12 text-2xl font-bold">Operating Companies</h2>

      <div className="mt-5 grid grid-cols-4 gap-5">
        {companies.map(([title, subtitle]) => (
          <DashboardCard key={title} title={title} subtitle={subtitle} />
        ))}
      </div>

      <h2 className="mt-12 text-2xl font-bold">Genesis Systems</h2>

      <div className="mt-5 grid grid-cols-4 gap-5">
        {systems.map(([title, subtitle]) => (
          <DashboardCard key={title} title={title} subtitle={subtitle} />
        ))}
      </div>
    </AppShell>
  );
}