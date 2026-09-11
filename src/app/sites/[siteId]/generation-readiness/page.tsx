import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { SiteGenerationReadinessWorkflow } from "@/modules/foundation/SiteGenerationReadinessWorkflow";
import { getSiteGenerationReadiness } from "@/modules/foundation/site-generation-readiness-service";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function GenerationReadinessPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params; const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;
  const result = getSiteGenerationReadiness(site);
  return <AppShell resourceSite={createSiteContext(site)}><SiteGenerationReadinessWorkflow organizationId={site.organizationId} siteId={site.siteId} siteName={site.displayName} readiness={result.readiness} certification={result.certification.certification} certificationStatus={result.certification.status} /></AppShell>;
}