import { logoutFromGlw } from "@/app/glw/actions";
import type { GenesisWorkspaceDescriptor } from "@/platform/gop/contracts";
import { ChevronDownIcon, LogoutIcon, SearchIcon, UserIcon } from "./glw-icons";

export function GlwHeader({ workspace }: { workspace: GenesisWorkspaceDescriptor }) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto w-full max-w-[1560px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-sm font-semibold tracking-[0.3em] text-white shadow-sm shadow-zinc-950/20">
              GLW
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">
                {workspace.name}
              </p>
              <p className="text-sm text-zinc-400">Production operations console</p>
            </div>
          </div>

          <div className="grid gap-3 xl:flex xl:flex-1 xl:items-center xl:justify-end">
            <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-300 shadow-sm shadow-zinc-950/10 xl:w-[280px]">
              <span className="text-zinc-500">
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder="Search pages, blogs, jobs, sites"
                className="w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-300 shadow-sm shadow-zinc-950/10 xl:w-[260px]">
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">
                Site
              </span>
              <select className="w-full border-0 bg-transparent p-0 text-sm font-medium text-white outline-none">
                {(workspace.availableSites ?? []).map((site) => (
                  <option key={site.siteId} value={site.siteId}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            <details className="group relative">
              <summary className="flex list-none cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-300 shadow-sm shadow-zinc-950/10 outline-none transition hover:border-zinc-700 hover:bg-zinc-800">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-white">
                  <UserIcon className="h-4 w-4" />
                </span>
                <span className="hidden flex-col text-left sm:flex">
                  <span className="font-medium text-white">Operations Admin</span>
                  <span className="text-xs text-zinc-400">GLW workspace</span>
                </span>
                <ChevronDownIcon className="h-4 w-4 text-zinc-500 transition group-open:rotate-180" />
              </summary>

              <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-zinc-950/30">
                <div className="border-b border-zinc-800 px-4 py-3">
                  <p className="text-sm font-medium text-white">Operations Admin</p>
                  <p className="mt-1 text-sm text-zinc-400">GLW console access</p>
                </div>
                <div className="p-2">
                  <div className="rounded-xl bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
                    Signed in to the LED Display Warehouse workspace.
                  </div>
                  <form action={logoutFromGlw} className="mt-2">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                    >
                      <LogoutIcon className="text-zinc-500" />
                      Logout
                    </button>
                  </form>
                </div>
              </div>
            </details>

            <form action={logoutFromGlw}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-zinc-300 shadow-sm shadow-zinc-950/10 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              >
                <LogoutIcon className="text-zinc-500" />
                Logout
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
