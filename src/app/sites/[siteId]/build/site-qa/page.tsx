import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { SiteBuildWordPressDraftReviewWorkspace } from "@/modules/foundation/SiteBuildWordPressDraftReview";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { inspectSiteBuildWordPressDrafts } from "@/modules/foundation/site-build-wordpress-review";
import { getSiteById } from "@/modules/foundation/site-repository";
import { SiteQaContinuationAction } from "@/modules/foundation/SiteQaContinuationAction";
import { redirect } from "next/navigation";

export default async function SiteQaPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;
  const workspace = getSiteBuildWorkspace(site);
  if (workspace.stage !== "SITE_QA") redirect(workspace.next.route);
  const review = await inspectSiteBuildWordPressDrafts(site);
  const approvedVisualDesigns = (workspace.currentHomeVisualAssembly?.status === "APPROVED" ? 1 : 0) + workspace.remainingVisualSummary.approved;
  return <AppShell resourceSite={createSiteContext(site)}><div className="space-y-6"><SiteBuildWordPressDraftReviewWorkspace review={review} build={{ stage: workspace.stage, buildSessionId: workspace.session?.buildSessionId ?? "Unavailable", totalVisualDesigns: workspace.remainingVisualSummary.expected + 1, approvedVisualDesigns, navigationItemCount: workspace.currentAssembly?.navigation.length ?? 0 }} site={{ organizationId: site.organizationId, siteId: site.siteId, displayName: site.displayName }} />{review.qa.readyForSiteQa ? <section className="space-y-4"><div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><p className="border border-zinc-800 p-3 text-zinc-300">{review.summary.verifiedDraftCount} WordPress drafts verified</p><p className="border border-zinc-800 p-3 text-zinc-300">{approvedVisualDesigns} visual designs approved</p><p className="border border-zinc-800 p-3 text-zinc-300">{review.media.imagesAttachedToPages} media attachments verified</p><p className="border border-zinc-800 p-3 text-zinc-300">{review.qa.orphanPageCount} orphan pages</p><p className="border border-zinc-800 p-3 text-zinc-300">{review.qa.invalidInternalLinkCount} invalid internal links</p><p className="border border-zinc-800 p-3 text-zinc-300">{review.qa.missingDraftCount} missing drafts</p><p className="border border-zinc-800 p-3 text-zinc-300">{review.qa.duplicateSlugCount} duplicate slugs</p><p className="border border-zinc-800 p-3 text-zinc-300">{review.qa.contentMismatchCount} content mismatches</p><p className="border border-zinc-800 p-3 text-zinc-300">{review.qa.seoMismatchCount} SEO mismatches</p></div><SiteQaContinuationAction site={{ organizationId: site.organizationId, siteId: site.siteId }} /></section> : null}</div></AppShell>;
}