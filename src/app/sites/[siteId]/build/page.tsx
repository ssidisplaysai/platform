import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { SiteBuildWorkflow } from "@/modules/foundation/SiteBuildWorkflow";
import { getSiteGenerationReadiness } from "@/modules/foundation/site-generation-readiness-service";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function SiteBuildPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params; const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;
  const result = getSiteGenerationReadiness(site);
  if (result.certification.status !== "CURRENT" || !result.certification.certification) return <AppShell resourceSite={createSiteContext(site)}><section className="border border-amber-800 bg-amber-950/20 p-6"><h1 className="text-xl font-semibold text-white">Generation Readiness required</h1><p className="mt-2 text-sm text-zinc-300">Return to Generation Readiness and explicitly certify the current authority snapshot before starting Site Build.</p></section></AppShell>;
  return <AppShell resourceSite={createSiteContext(site)}><SiteBuildWorkflow organizationId={site.organizationId} siteId={site.siteId} certificationId={result.certification.certification.certificationId} initialSession={result.buildSession} /></AppShell>;
}