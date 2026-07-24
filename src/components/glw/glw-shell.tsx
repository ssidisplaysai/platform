import { GlwHeader } from "./glw-header";
import { GlwSidebarNav } from "./glw-sidebar-nav";

export function GlwShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-zinc-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col overflow-hidden">
            <div className="border-b border-zinc-200 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-950 text-sm font-semibold tracking-[0.3em] text-white">
                  GLW
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-tight text-zinc-950">
                    LED Display Warehouse
                  </p>
                  <p className="text-sm text-zinc-500">Operational workspace</p>
                </div>
              </div>
            </div>

            <GlwSidebarNav />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 min-w-0 flex-col">
          <GlwHeader />

          <section className="flex-1 py-6 sm:py-8">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
