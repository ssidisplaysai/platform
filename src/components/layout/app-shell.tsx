const navItems = [
  "Mission Control",
  "Companies",
  "Projects",
  "CRM",
  "Inventory",
  "Manufacturing",
  "Purchasing",
  "Quotes",
  "Accounting",
  "Documents",
  "AI",
  "Automation",
  "Settings",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-2xl font-black tracking-wide text-red-500">
            STONER
          </h1>
          <p className="mt-1 text-sm text-zinc-400">Genesis OS</p>

          <nav className="mt-10 space-y-2">
            {navItems.map((item) => (
              <button
                key={item}
                className="w-full rounded-lg px-4 py-3 text-left text-sm transition hover:bg-red-600"
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex-1 p-12">{children}</section>
      </div>
    </main>
  );
}