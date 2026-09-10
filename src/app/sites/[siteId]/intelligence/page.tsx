import { AppShell } from "@/components/layout/app-shell";
import { SiteIntelligenceWorkspace } from "@/modules/foundation/SiteIntelligenceWorkspace";
import { getSiteById } from "@/modules/foundation/site-repository";

type PageProps = { params: Promise<{ siteId: string }> };

export default async function SiteIntelligencePage({ params }: PageProps) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  return <AppShell>{site ? <SiteIntelligenceWorkspace organizationId={site.organizationId} siteId={site.siteId} siteName={site.displayName} publicBrandIdentity={site.organizationId === "rj-metal" ? "Rocklin Metal" : site.displayName} /> : <div className="border border-zinc-800 p-6 text-zinc-300">Site not found.</div>}</AppShell>;
}