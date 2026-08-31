import Link from "next/link";
import { createFoundationContext } from "@/modules/foundation/context";

type GlwSection = {
  id: string;
  title: string;
  description: string;
  href?: string;
};

const GLW_SECTIONS: readonly GlwSection[] = [
  {
    id: "pages",
    title: "Pages",
    description: "Generate and review site-specific pages.",
    href: "/glw/pages",
  },
  {
    id: "campaigns",
    title: "Campaigns",
    description: "Configure geography, throughput, images, and publication policy for production campaigns.",
    href: "/glw/campaigns",
  },
  {
    id: "blogs",
    title: "Blogs",
    description: "No blog pipelines are configured in this baseline.",
  },
  {
    id: "images",
    title: "Images",
    description: "Generated media is handled through the certified site-authoritative media pipeline.",
  },
  {
    id: "publishing",
    title: "Publishing",
    description: "Campaign publication authority is configured per campaign and remains gate-controlled.",
  },
  {
    id: "workflows",
    title: "Workflows",
    description: "GLW uses the existing bounded n8n generation execution path.",
  },
  {
    id: "sites",
    title: "Sites",
    description: "Site inventory is inherited from Genesis workspace context.",
  },
  {
    id: "system-health",
    title: "System Health",
    description: "No GLW-specific runtime metrics are available in this baseline.",
  },
];

export function GlwDashboard() {
  const context = createFoundationContext();
  const selectedOrganization =
    context.organizations.find(
      (organization) => organization.id === context.selectedOrganizationId,
    ) ?? null;
  const selectedSite =
    context.sites.find((site) => site.id === context.selectedSiteId) ?? null;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Genesis Application</p>
        <h1 className="mt-3 text-3xl font-black text-white">LED Display Warehouse</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-300">
          GLW is restored as a first-class Genesis application surface and uses the existing
          protected shell, role policy, and workspace context.
        </p>

        <dl className="mt-5 grid gap-3 text-sm text-zinc-300 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <dt className="text-xs uppercase tracking-widest text-zinc-500">Workspace</dt>
            <dd className="mt-1 font-semibold text-white">
              {selectedOrganization?.name ?? "No organization selected"}
            </dd>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <dt className="text-xs uppercase tracking-widest text-zinc-500">Site</dt>
            <dd className="mt-1 font-semibold text-white">
              {selectedSite?.name ?? "No site selected"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/glw/pages"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-red-500 hover:text-white"
          >
            Open Pages Center
          </Link>
          <Link
            href="/glw/campaigns"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            Open Campaign Manager
          </Link>
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-white">GLW Foundations</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Campaign configuration is now available; activation and dispatch remain intentionally separate safety boundaries.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GLW_SECTIONS.map((section) => (
            <article key={section.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="text-sm font-semibold text-white">{section.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{section.description}</p>
              {section.href ? (
                <Link
                  href={section.href}
                  className="mt-3 inline-block text-xs uppercase tracking-wider text-red-400 hover:text-red-300"
                >
                  Open
                </Link>
              ) : (
                <p className="mt-3 text-xs uppercase tracking-wider text-zinc-500">No live data yet</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
