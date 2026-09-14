import { AppShell } from "@/components/layout/app-shell";
import { CommercialStainlessWordPressWave1Review } from "@/modules/foundation/CommercialStainlessWordPressWave1Review";
import { COMMERCIAL_STAINLESS_SITE_ID } from "@/modules/foundation/commercial-stainless-rich-composition";
import { listCommercialStainlessWordPressPublicationReceipts } from "@/modules/foundation/commercial-stainless-wordpress-publication";
import { listCommercialStainlessWordPressStageRecords, renderCommercialStainlessWordPressStagedPage } from "@/modules/foundation/commercial-stainless-wordpress-staging";
import { createSiteContext } from "@/modules/foundation/context";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function CommercialStainlessWordPressWave1Page({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site || site.siteId !== COMMERCIAL_STAINLESS_SITE_ID) return <AppShell><p className="p-6 text-zinc-300">Commercial Stainless WordPress staging review is unavailable.</p></AppShell>;
  const records = listCommercialStainlessWordPressStageRecords().filter((record) => ["STAGED", "PUBLICATION_READY", "BLOCKED"].includes(record.status));
  if (records.length !== 5) return <AppShell resourceSite={createSiteContext(site)}><p className="p-6 text-zinc-300">Complete Wave 1 WordPress staging is required.</p></AppShell>;
  const items = await Promise.all(records.map(async (record) => {
    const response = await fetch(`${record.currentPublicUrl}?_staged_review=${crypto.randomUUID()}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`COMMERCIAL_STAINLESS_PUBLIC_REVIEW_FAILED:${record.wordpressObjectId}:${response.status}`);
    const publicHtml = await response.text();
    const heights = record.targetProfile === "LANDING_CONVERSION" ? { desktopHeight: 5800, mobileHeight: 9800 } : record.targetProfile === "CAPABILITY" ? { desktopHeight: 6100, mobileHeight: 10400 } : record.targetProfile === "PRODUCT_SERVICE" ? { desktopHeight: 5800, mobileHeight: 9700 } : record.targetProfile === "INDUSTRY_APPLICATION" ? { desktopHeight: 6200, mobileHeight: 10500 } : { desktopHeight: 5000, mobileHeight: 8500 };
    return { record, currentHtml: publicHtml.replace(/<head([^>]*)>/i, '<head$1><base href="https://commercialstainlesscounters.com/">'), stagedHtml: renderCommercialStainlessWordPressStagedPage(record, publicHtml), ...heights };
  }));
  return <AppShell resourceSite={createSiteContext(site)}><CommercialStainlessWordPressWave1Review items={items} receipts={listCommercialStainlessWordPressPublicationReceipts()} /></AppShell>;
}