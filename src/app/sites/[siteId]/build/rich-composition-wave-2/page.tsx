import { AppShell } from "@/components/layout/app-shell";
import { COMMERCIAL_STAINLESS_ORIGIN, COMMERCIAL_STAINLESS_SITE_ID, inventoryCommercialStainlessPages } from "@/modules/foundation/commercial-stainless-rich-composition";
import { auditCommercialStainlessWave2Diversity, COMMERCIAL_STAINLESS_WAVE_2_PATHS, stageCommercialStainlessWave2 } from "@/modules/foundation/commercial-stainless-wave2-rollout";
import { CommercialStainlessWave2Review } from "@/modules/foundation/CommercialStainlessWave2Review";
import { createSiteContext } from "@/modules/foundation/context";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function CommercialStainlessWave2Page({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site || site.siteId !== COMMERCIAL_STAINLESS_SITE_ID) return <AppShell><p className="p-6 text-zinc-300">Commercial Stainless Wave 2 review is unavailable.</p></AppShell>;
  const workspace = getSiteBuildWorkspace(site);
  const pages = workspace.currentAssembly?.pages ?? [];
  const inventory = inventoryCommercialStainlessPages({ pages, visuals: workspace.currentVisualAssemblies });
  const responses = await Promise.all(COMMERCIAL_STAINLESS_WAVE_2_PATHS.map(async path => {
    const response = await fetch(new URL(path, COMMERCIAL_STAINLESS_ORIGIN), { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`COMMERCIAL_STAINLESS_WAVE2_PUBLIC_READ_FAILED:${path}:${response.status}`);
    return [path, await response.text()] as const;
  }));
  const stages = stageCommercialStainlessWave2({ pages, inventory, publicHtmlByPath: Object.fromEntries(responses) });
  return <AppShell resourceSite={createSiteContext(site)}><CommercialStainlessWave2Review stages={stages} diversity={auditCommercialStainlessWave2Diversity(stages)} /></AppShell>;
}
