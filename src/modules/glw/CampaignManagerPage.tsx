import Link from "next/link";
import { createFoundationContext } from "@/modules/foundation/context";
import { listProducts } from "@/modules/foundation/product-repository";
import { listGlwCampaigns } from "./campaign-repository";
import { listAllGlwCampaignTargets } from "./campaign-target-repository";
import { buildGlwStateCoverage, projectGlwCampaign, recommendGlwCampaignContinuation } from "./campaign-manager";
import { CampaignManager } from "./CampaignManager";

export function CampaignManagerPage() {
  const context = createFoundationContext();
  const organizationId = context.selectedOrganizationId;
  const siteId = context.selectedSiteId;
  const campaigns = listGlwCampaigns().filter((campaign) => campaign.organizationId === organizationId && campaign.siteId === siteId);
  const allTargets = listAllGlwCampaignTargets();
  const records = campaigns.map((campaign) => projectGlwCampaign(campaign, allTargets.filter((target) => target.campaignId === campaign.campaignId)));
  const products = listProducts().filter((product) => product.organizationId === organizationId && product.assignedSiteIds.includes(siteId));
  const productNames = Object.fromEntries(products.map((product) => [product.productId, product.displayName]));
  const coverageByProduct = Object.fromEntries(products.map((product) => [product.productId, buildGlwStateCoverage({ campaigns: campaigns.filter((campaign) => campaign.productId === product.productId), targets: allTargets, organizationId, siteId })]));
  return (
    <div className="space-y-6">
      <header className="border-b border-zinc-800 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs uppercase tracking-[0.3em] text-zinc-500">GLW / Execution</p><h1 className="mt-2 text-3xl font-black text-white">Campaign Manager</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">Track execution, inspect geographic reach, and plan the next safe expansion from approved product authority.</p></div>
          <Link href="/glw/campaign-launchpad" className="w-fit border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-red-500">Open Launchpad</Link>
        </div>
      </header>
      <CampaignManager
        organizationId={organizationId}
        siteId={siteId}
        requestRoles={context.user.roles}
        records={records.map((record) => ({ ...record, proposal: recommendGlwCampaignContinuation({ record, campaigns }) }))}
        coverage={buildGlwStateCoverage({ campaigns, targets: allTargets, organizationId, siteId })}
        coverageByProduct={coverageByProduct}
        products={products.map((product) => ({ productId: product.productId, name: product.displayName }))}
        productNames={productNames}
      />
    </div>
  );
}