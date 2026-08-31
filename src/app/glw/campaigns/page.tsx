import { AppShell } from "@/components/layout/app-shell";
import { listProducts } from "@/modules/foundation/product-repository";
import { listSites } from "@/modules/foundation/site-repository";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { GlwCampaignManager } from "@/modules/glw/GlwCampaignManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteProps = {
  searchParams: Promise<{
    organizationId?: string | string[];
    siteId?: string | string[];
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
  const sites = listSites();
  const organizationId =
    requestedOrganizationId ??
    sites.find((site) => site.siteId === requestedSiteId)?.organizationId ??
    sites[0]?.organizationId ??
    "";

  const organizationSites = sites.filter(
    (site) => site.organizationId === organizationId,
  );
  const products = listProducts().filter(
    (product) => product.organizationId === organizationId,
  );
  const campaigns = listGlwCampaigns().filter(
    (campaign) => campaign.organizationId === organizationId,
  );

  return (
    <AppShell>
      <GlwCampaignManager
        organizationId={organizationId}
        siteId={requestedSiteId}
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
      />
    </AppShell>
  );
}
