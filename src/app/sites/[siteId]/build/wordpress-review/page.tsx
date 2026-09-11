import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { SiteBuildWordPressDraftReviewWorkspace } from "@/modules/foundation/SiteBuildWordPressDraftReview";
import { inspectSiteBuildWordPressDrafts } from "@/modules/foundation/site-build-wordpress-review";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function SiteBuildWordPressReviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params; const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;
  const review = await inspectSiteBuildWordPressDrafts(site);
  return <AppShell resourceSite={createSiteContext(site)}><SiteBuildWordPressDraftReviewWorkspace review={review} site={{ organizationId: site.organizationId, siteId: site.siteId, displayName: site.displayName }} /></AppShell>;
}