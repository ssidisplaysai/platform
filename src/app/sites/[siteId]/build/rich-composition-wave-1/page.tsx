import { AppShell } from "@/components/layout/app-shell";
import { CommercialStainlessWave1Review } from "@/modules/foundation/CommercialStainlessWave1Review";
import { COMMERCIAL_STAINLESS_SITE_ID, inventoryCommercialStainlessPages } from "@/modules/foundation/commercial-stainless-rich-composition";
import { auditCommercialStainlessWave1Diversity, createCommercialStainlessRemainingPageProfileMap, COMMERCIAL_STAINLESS_WAVE_1_PATHS, stageCommercialStainlessWave1 } from "@/modules/foundation/commercial-stainless-wave1-rollout";
import { createSiteContext } from "@/modules/foundation/context";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function CommercialStainlessWave1Page({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site || site.siteId !== COMMERCIAL_STAINLESS_SITE_ID) return <AppShell><p className="p-6 text-zinc-300">Commercial Stainless Wave 1 review is unavailable.</p></AppShell>;
  const workspace = getSiteBuildWorkspace(site);
  const pages = workspace.currentAssembly?.pages ?? [];
  const inventory = inventoryCommercialStainlessPages({ pages, visuals: workspace.currentVisualAssemblies });
  const responses = await Promise.all(COMMERCIAL_STAINLESS_WAVE_1_PATHS.map(async (path) => {
    const response = await fetch(new URL(path, "https://commercialstainlesscounters.com"), { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`COMMERCIAL_STAINLESS_WAVE_PUBLIC_READ_FAILED:${path}:${response.status}`);
    return [path, await response.text()] as const;
  }));
  const stages = stageCommercialStainlessWave1({ pages, inventory, publicHtmlByPath: Object.fromEntries(responses) });
  return <AppShell resourceSite={createSiteContext(site)}><CommercialStainlessWave1Review stages={stages} profileMap={createCommercialStainlessRemainingPageProfileMap(inventory)} diversity={auditCommercialStainlessWave1Diversity(stages)} /></AppShell>;
}