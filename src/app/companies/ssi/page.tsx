import { AppShell } from "@/components/layout/app-shell";
import { DashboardCard } from "@/components/dashboard/dashboard-card";

const modules = [
  ["Projects", "Active installations and jobs"],
  ["Quotes", "Sales pipeline and proposals"],
  ["Customers", "Accounts and contacts"],
  ["Inventory", "Products, stock, and rentals"],
  ["Documents", "Specs, quotes, SOPs, and files"],
  ["AI Assistant", "Dedicated SSI intelligence agent"],
  ["Service", "Support tickets and maintenance"],
  ["Marketing", "Websites, SEO, and campaigns"],
];

export default function SSIPage() {
  return (
    <AppShell>
      <p className="text-sm uppercase tracking-[0.35em] text-red-500">
        Company Workspace
      </p>

      <h1 className="mt-4 text-5xl font-black tracking-tight">
        Screen Solutions International
      </h1>

      <p className="mt-4 max-w-3xl text-zinc-400">
        SSI command center for quotes, projects, customers, installations,
        inventory, service, documents, and AI-assisted operations.
      </p>

      <div className="mt-10 grid grid-cols-4 gap-5">
        {modules.map(([title, subtitle]) => (
          <DashboardCard key={title} title={title} subtitle={subtitle} />
        ))}
      </div>
    </AppShell>
  );
}