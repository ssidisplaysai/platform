import { AppShell } from "@/components/layout/app-shell";
import { DashboardCard } from "@/components/dashboard/dashboard-card";

const cards = [
  "SSI",
  "RJ Metal",
  "Green Machine Works",
  "212 Visual",
  "Open Projects",
  "AI Agents",
  "Automation",
  "Documents",
];

export default function Home() {
  return (
    <AppShell>
      <h2 className="text-5xl font-bold">Mission Control</h2>

      <p className="mt-3 text-zinc-400">
        Enterprise command center for Stoner Brands.
      </p>

      <div className="mt-12 grid grid-cols-4 gap-6">
        {cards.map((card) => (
          <DashboardCard key={card} title={card} subtitle="Coming Soon" />
        ))}
      </div>
    </AppShell>
  );
}