import Link from "next/link";
import {
  createFoundationContext,
  getSitesForOrganization,
} from "@/modules/foundation/context";

export function GlwPagesCenter() {
  const context = createFoundationContext();
  const selectedOrganization =
    context.organizations.find(
      (organization) => organization.id === context.selectedOrganizationId,
    ) ?? null;
  const availableSites = getSitesForOrganization(
    context.sites,
    context.selectedOrganizationId,
  );

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">GLW</p>
            <h1 className="mt-2 text-2xl font-black text-white">Pages Center</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Structural foundation for GLW page management. No pages are created in this baseline.
            </p>
          </div>
          <Link
            href="/glw"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-red-500 hover:text-white"
          >
            GLW Home
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-semibold text-white">Workspace</h2>
          <p className="mt-2 text-sm text-zinc-300">
            {selectedOrganization?.name ?? "No organization selected"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Organization ID: {context.selectedOrganizationId || "Unavailable"}
          </p>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-semibold text-white">Site Selector</h2>
          <select
            defaultValue={context.selectedSiteId}
            className="mt-2 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200"
          >
            {availableSites.length === 0 ? (
              <option value="">No sites available</option>
            ) : (
              availableSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.environment})
                </option>
              ))
            )}
          </select>
          <p className="mt-2 text-xs text-zinc-500">
            Site options are inherited from Genesis workspace context.
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-sm font-semibold text-white">Pages Registry</h2>
        <p className="mt-2 text-sm text-zinc-300">
          No GLW pages are currently registered for this workspace.
        </p>
        <button
          type="button"
          disabled
          className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 opacity-60"
        >
          Create Page
        </button>
      </section>
    </div>
  );
}
