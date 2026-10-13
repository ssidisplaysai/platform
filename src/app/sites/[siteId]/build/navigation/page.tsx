import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";
import { SiteNavigationReviewWorkflow } from "@/modules/foundation/SiteNavigationReviewWorkflow";

export default async function SiteNavigationPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;
  const workspace = getSiteBuildWorkspace(site);
  if (!workspace.currentNavigationReview) return <AppShell resourceSite={createSiteContext(site)}><p className="p-6 text-amber-300">Navigation review has not been explicitly started.</p></AppShell>;
  return <AppShell resourceSite={createSiteContext(site)}><SiteNavigationReviewWorkflow initialReview={workspace.currentNavigationReview} initialNext={workspace.next} site={{ organizationId: site.organizationId, siteId: site.siteId }} /></AppShell>;
}
