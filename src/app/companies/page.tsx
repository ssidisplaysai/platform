import { AppShell } from "@/components/layout/app-shell";
import { DashboardCard } from "@/components/dashboard/dashboard-card";

const companies = [
  ["SSI", "Screen Solutions International"],
  ["RJ Metal", "Manufacturing, fabrication, and production"],
  ["Green Machine Works", "Pre-roll manufacturing systems"],
  ["LED Display Warehouse", "LED ecommerce, products, and dealer sales"],
  ["Stoner", "Lifestyle brand and future product ecosystem"],
];

export default function CompaniesPage() {
  return (
    <AppShell>
      <p className="text-sm uppercase tracking-[0.35em] text-red-500">
        Companies
      </p>

      <h1 className="mt-4 text-5xl font-black tracking-tight">
        Operating Companies
      </h1>

      <p className="mt-4 max-w-2xl text-zinc-400">
        Manage every operating company inside the Stoner Platform from one
        enterprise command center.
      </p>

      <div className="mt-10 grid grid-cols-3 gap-5">
        {companies.map(([title, subtitle]) => (
          <DashboardCard key={title} title={title} subtitle={subtitle} />
        ))}
      </div>
    </AppShell>
  );
}