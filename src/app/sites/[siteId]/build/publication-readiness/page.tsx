import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { inspectSiteBuildWordPressDrafts } from "@/modules/foundation/site-build-wordpress-review";
import { getSiteById } from "@/modules/foundation/site-repository";
import { SitePublicationGateWorkflow } from "@/modules/foundation/SitePublicationGateWorkflow";

export default async function PublicationReadinessPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;
  const workspace = getSiteBuildWorkspace(site);
  if (workspace.stage !== "PUBLICATION_READINESS") redirect(workspace.next.route);
  const review = await inspectSiteBuildWordPressDrafts(site);
  return <AppShell resourceSite={createSiteContext(site)}><SitePublicationGateWorkflow mode="READINESS" site={{ organizationId: site.organizationId, siteId: site.siteId }} summary={{ drafts: review.summary.verifiedDraftCount, designs: workspace.remainingVisualSummary.approved + 1, media: review.media.imagesAttachedToPages, navigationItems: workspace.currentNavigationReview?.items.length ?? 0 }} /></AppShell>;
}
