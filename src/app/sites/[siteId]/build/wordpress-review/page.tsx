import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { SiteBuildWordPressDraftReviewWorkspace } from "@/modules/foundation/SiteBuildWordPressDraftReview";
import { inspectSiteBuildWordPressDrafts } from "@/modules/foundation/site-build-wordpress-review";
import { getSiteById } from "@/modules/foundation/site-repository";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";

export default async function SiteBuildWordPressReviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params; const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;
  const review = await inspectSiteBuildWordPressDrafts(site);
  const workspace = getSiteBuildWorkspace(site);
  const approvedVisualDesigns = (workspace.currentHomeVisualAssembly?.status === "APPROVED" ? 1 : 0) + workspace.remainingVisualSummary.approved;
  const totalVisualDesigns = workspace.remainingVisualSummary.expected + 1;
  const showContinuation = ["SITE_QA", "NAVIGATION_REVIEW", "PUBLICATION_READINESS", "PUBLICATION_AUTHORIZATION"].includes(workspace.stage);
  return <AppShell resourceSite={createSiteContext(site)}><div className="space-y-6">{showContinuation ? <section className="border-l-4 border-emerald-500 bg-emerald-950/20 p-5"><p className="text-xs font-semibold uppercase text-emerald-300">{workspace.stage === "SITE_QA" ? "All Site Designs Approved" : "Current Governed Stage"}</p><h1 className="mt-2 text-xl font-semibold text-white">{workspace.stage === "SITE_QA" ? `${approvedVisualDesigns} / ${totalVisualDesigns} visual designs approved.` : workspace.next.label}</h1><p className="mt-2 text-sm text-zinc-300">{workspace.next.detail}</p><Link href={workspace.next.route} className="mt-4 inline-block bg-red-600 px-5 py-3 text-sm font-semibold text-white">{workspace.next.label}</Link></section> : null}<SiteBuildWordPressDraftReviewWorkspace review={review} build={{ stage: workspace.stage, buildSessionId: workspace.session?.buildSessionId ?? "Unavailable", totalVisualDesigns, approvedVisualDesigns, navigationItemCount: workspace.currentAssembly?.navigation.length ?? 0 }} site={{ organizationId: site.organizationId, siteId: site.siteId, displayName: site.displayName }} /></div></AppShell>;
}