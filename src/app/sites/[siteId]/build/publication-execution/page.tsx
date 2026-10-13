import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { SitePublicationExecutionWorkflow } from "@/modules/foundation/SitePublicationExecutionWorkflow";
import { prepareSitePublicationExecutionPlan } from "@/modules/foundation/site-publication-execution-plan";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function PublicationExecutionPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;
  const preflight = await prepareSitePublicationExecutionPlan(site);
  return <AppShell resourceSite={createSiteContext(site)}><SitePublicationExecutionWorkflow preflight={preflight} site={{ organizationId: site.organizationId, siteId: site.siteId }} /></AppShell>;
}
