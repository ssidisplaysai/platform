import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { SitePageReviewWorkflow } from "@/modules/foundation/SitePageReviewWorkflow";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";
import Link from "next/link";

export default async function SitePageReviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;

  const workspace = getSiteBuildWorkspace(site);

  return (
    <AppShell resourceSite={createSiteContext(site)}>
      {workspace.currentAssembly ? (
        <section className="mb-6 border border-cyan-900 bg-cyan-950/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Native visual preview</p>
          <h1 className="mt-1 text-lg font-semibold text-white">Preview Assembly Revision {workspace.currentAssembly.revision} without WordPress</h1>
          <p className="mt-1 text-sm text-zinc-300">Render the current Genesis assembly in a responsive internal preview before any CMS mutation.</p>
          <Link
            href={`/sites/${encodeURIComponent(site.siteId)}/build/preview?organizationId=${encodeURIComponent(site.organizationId)}&siteId=${encodeURIComponent(site.siteId)}`}
            className="mt-3 inline-block border border-cyan-500 px-4 py-2 text-sm font-semibold text-cyan-100"
          >
            OPEN NATIVE PREVIEW
          </Link>
        </section>
      ) : null}
      <SitePageReviewWorkflow initialWorkspace={workspace} />
    </AppShell>
  );
}