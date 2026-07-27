import { GlwHeader } from "./glw-header";
import { GlwSidebarNav } from "./glw-sidebar-nav";
import type { GenesisNavigationItem, GenesisWorkspaceDescriptor } from "@/platform/gop/contracts";

export function GlwShell({
  children,
  navigationItems,
  workspace,
}: {
  children: React.ReactNode;
  navigationItems: GenesisNavigationItem[];
  workspace: GenesisWorkspaceDescriptor;
}) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-950 text-white">
      <div className="flex min-h-screen min-w-0 flex-col lg:flex-row">
        <aside className="border-b border-zinc-800 bg-zinc-900 lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col overflow-hidden">
            <div className="border-b border-zinc-800 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-sm font-semibold tracking-[0.3em] text-white shadow-sm shadow-zinc-950/20">
                  GLW
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-tight text-white">
                    {workspace.name}
                  </p>
                  <p className="text-sm text-zinc-400">{workspace.description ?? "Operational workspace"}</p>
                </div>
              </div>
            </div>

            <GlwSidebarNav items={navigationItems} />
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-zinc-950">
          <GlwHeader workspace={workspace} />

          <section className="flex-1 py-6 sm:py-8">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
