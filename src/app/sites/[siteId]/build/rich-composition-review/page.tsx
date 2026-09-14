import { AppShell } from "@/components/layout/app-shell";
import { CommercialStainlessRichCompositionReview } from "@/modules/foundation/CommercialStainlessRichCompositionReview";
import { COMMERCIAL_STAINLESS_SITE_ID, createCommercialStainlessRolloutPlan, extractCommercialStainlessPublicShell, inventoryCommercialStainlessPages, renderDesignBuildRichComposition } from "@/modules/foundation/commercial-stainless-rich-composition";
import { createSiteContext } from "@/modules/foundation/context";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function CommercialStainlessRichCompositionReviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site || site.siteId !== COMMERCIAL_STAINLESS_SITE_ID) return <AppShell><p className="p-6 text-zinc-300">Commercial Stainless review is unavailable.</p></AppShell>;
  const workspace = getSiteBuildWorkspace(site);
  const pages = workspace.currentAssembly?.pages ?? [];
  const inventory = inventoryCommercialStainlessPages({ pages, visuals: workspace.currentVisualAssemblies });
  const proofPage = pages.find((page) => page.canonicalPath === "/design-build-fabrication/");
  if (!proofPage) return <AppShell resourceSite={createSiteContext(site)}><p className="p-6 text-zinc-300">Design-Build authority is unavailable.</p></AppShell>;
  const publicResponse = await fetch("https://commercialstainlesscounters.com/design-build-fabrication/", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!publicResponse.ok) return <AppShell resourceSite={createSiteContext(site)}><p className="p-6 text-zinc-300">Current public Design-Build framing is unavailable.</p></AppShell>;
  const preview = renderDesignBuildRichComposition({ page: proofPage, inventory, publicShell: extractCommercialStainlessPublicShell(await publicResponse.text()) });
  return <AppShell resourceSite={createSiteContext(site)}><CommercialStainlessRichCompositionReview preview={preview} inventory={inventory} rollout={createCommercialStainlessRolloutPlan(inventory)} /></AppShell>;
}