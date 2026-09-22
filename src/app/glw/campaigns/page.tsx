import { AppShell } from "@/components/layout/app-shell";
import { listProducts } from "@/modules/foundation/product-repository";
import { listSites } from "@/modules/foundation/site-repository";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { buildGlwCampaignOperatorReadModel } from "@/modules/glw/campaign-operator-read-model";
import { deriveGlwCampaignListOperatorSummary, orderGlwCampaignListOperatorSummaries } from "@/modules/glw/campaign-list-operator-read-model";
import { filterCampaignsForWorkspace, filterProductsForWorkspace, resolveCampaignWorkspace } from "@/modules/glw/campaign-workspace-context";
import { GlwCampaignManager } from "@/modules/glw/GlwCampaignManager";
import { GlwCampaignOperationsList } from "@/modules/glw/GlwCampaignOperationsList";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteProps = {
  searchParams: Promise<{
    organizationId?: string | string[];
    siteId?: string | string[];
    scope?: string | string[];
  }>;
};

function first(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return null;
}

export default async function GlwCampaignsPage({ searchParams }: RouteProps) {
  const params = await searchParams;
  const requestedOrganizationId = first(params.organizationId);
  const requestedSiteId = first(params.siteId);
  const allSites = first(params.scope) === "all";
  const sites = listSites();
  const workspace = resolveCampaignWorkspace({
    sites,
    requestedOrganizationId,
    requestedSiteId,
  });
  const organizationId = workspace.organizationId;
  const resolvedSiteId = workspace.resolvedSiteId;
  const organizationSites = allSites ? sites : workspace.organizationSites;
  const products = filterProductsForWorkspace({
    products: listProducts(),
    organizationId,
    allSites,
  });
  const campaigns = filterCampaignsForWorkspace({
    campaigns: listGlwCampaigns(),
    organizationId,
    siteId: allSites ? requestedSiteId : resolvedSiteId,
    allSites,
  });
  const operatorSummaries = orderGlwCampaignListOperatorSummaries((await Promise.all(campaigns.map(async (campaign) => {
    const model = await buildGlwCampaignOperatorReadModel(campaign.campaignId);
    if (!model) return null;
    const site = organizationSites.find((entry) => entry.siteId === campaign.siteId);
    const product = products.find((entry) => entry.productId === campaign.productId);
    return deriveGlwCampaignListOperatorSummary({
      model,
      siteName: site?.displayName ?? campaign.siteId,
      domain: site?.domain ?? null,
      productName: product?.displayName ?? campaign.productId,
      updatedAt: campaign.updatedAt,
    });
  }))).filter((summary) => summary !== null));

  return (
    <AppShell>
      {allSites ? <div className="space-y-6"><header className="border border-zinc-800 bg-zinc-900/60 p-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Genesis Operations</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black text-white">All Campaigns</h1><p className="mt-2 text-sm text-zinc-400">Cross-site operating board for every durable GLW campaign.</p></div><div className="flex flex-wrap gap-2"><span className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold">{campaigns.length} campaigns</span>{requestedOrganizationId ? <Link href={`/glw/campaigns?organizationId=${encodeURIComponent(requestedOrganizationId)}${requestedSiteId ? `&siteId=${encodeURIComponent(requestedSiteId)}` : ""}`} className="border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500">Selected workspace</Link> : null}</div></div></header><section className="border border-zinc-800 bg-zinc-900/40 p-5"><GlwCampaignOperationsList summaries={operatorSummaries} /></section></div> :
      <GlwCampaignManager
        organizationId={organizationId}
        siteId={resolvedSiteId}
        sites={organizationSites.map((site) => ({
          siteId: site.siteId,
          organizationId: site.organizationId,
          displayName: site.displayName,
        }))}
        products={products.map((product) => ({
          productId: product.productId,
          organizationId: product.organizationId,
          displayName: product.displayName,
          assignedSiteIds: product.assignedSiteIds,
        }))}
        initialCampaigns={campaigns}
        initialOperatorSummaries={operatorSummaries}
      />
      }
    </AppShell>
  );
}
