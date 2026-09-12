import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { SiteBuildWordPressDraftReviewWorkspace } from "@/modules/foundation/SiteBuildWordPressDraftReview";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { inspectSiteBuildWordPressDrafts } from "@/modules/foundation/site-build-wordpress-review";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function SiteQaPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;
  const workspace = getSiteBuildWorkspace(site);
  if (workspace.stage !== "SITE_QA") return <AppShell resourceSite={createSiteContext(site)}><p className="p-6 text-amber-300">Site QA is not the current governed stage.</p></AppShell>;
  const review = await inspectSiteBuildWordPressDrafts(site);
  const approvedVisualDesigns = (workspace.currentHomeVisualAssembly?.status === "APPROVED" ? 1 : 0) + workspace.remainingVisualSummary.approved;
  return <AppShell resourceSite={createSiteContext(site)}><SiteBuildWordPressDraftReviewWorkspace review={review} build={{ stage: workspace.stage, buildSessionId: workspace.session?.buildSessionId ?? "Unavailable", totalVisualDesigns: workspace.remainingVisualSummary.expected + 1, approvedVisualDesigns, navigationItemCount: workspace.currentAssembly?.navigation.length ?? 0 }} site={{ organizationId: site.organizationId, siteId: site.siteId, displayName: site.displayName }} /></AppShell>;
}