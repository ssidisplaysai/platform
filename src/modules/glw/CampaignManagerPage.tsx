import Link from "next/link";
import { createFoundationContext } from "@/modules/foundation/context";
import { listProducts } from "@/modules/foundation/product-repository";
import { listGlwCampaigns } from "./campaign-repository";
import { listAllGlwCampaignTargets } from "./campaign-target-repository";
import { createGlwCampaignTargetFingerprint, listGlwCampaignActivationGrants } from "./campaign-activation-authorization";
import { listGlwCampaignReferenceApprovals } from "./campaign-reference-approval-repository";
import { getGlwCampaignKnowledgePack } from "./campaign-reference-repository";
import { readGlwCampaignLaunchPromotion } from "./campaign-launch-capability";
import { buildGlwStateCoverage, projectGlwCampaign, recommendGlwCampaignContinuation } from "./campaign-manager";
import { CampaignManager } from "./CampaignManager";
import type { CampaignActivationReadiness } from "./CampaignActivationAuthorityPanel";
import { getGlwLocalReferenceDraft } from "./campaign-local-reference-repository";
import { selectDeterministicCityReference } from "./projector-enclosure-texas-reference";

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
  const runningRelease = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
  const activationReadinessByCampaign: Record<string, CampaignActivationReadiness> = Object.fromEntries(campaigns.map((campaign) => {
    const targets = allTargets.filter((target) => target.campaignId === campaign.campaignId);
    const preparedTargets = targets.filter((target) => target.status === "prepared");
    const pack = getGlwCampaignKnowledgePack(campaign.campaignId);
    const approvals = listGlwCampaignReferenceApprovals(campaign.campaignId);
    const grant = listGlwCampaignActivationGrants(campaign.campaignId).at(-1) ?? null;
    let targetFingerprint: string | null = null;
    try {
      if (preparedTargets.length > 0) targetFingerprint = createGlwCampaignTargetFingerprint(campaign, preparedTargets);
    } catch {
      targetFingerprint = null;
    }
    const grantActive = Boolean(
      grant
      && !grant.claimedAt
      && !grant.consumedAt
      && new Date(grant.expiresAt) > new Date()
      && grant.targetFingerprint === targetFingerprint
      && grant.publicationPolicy === campaign.publicationPolicy
      && grant.certifiedReleaseSha === runningRelease,
    );
    return [campaign.campaignId, {
      knowledgePackReady: Boolean(pack?.instructions.trim()),
      approvedReferenceCount: approvals.length,
      preparedTargetCount: preparedTargets.length,
      grantActive,
      grantStatus: !grant ? "NONE" : grant.consumedAt ? "CONSUMED" : grant.claimedAt ? "CLAIMED" : new Date(grant.expiresAt) <= new Date() ? "EXPIRED" : grantActive ? "ACTIVE" : "INVALIDATED",
      grantExpiresAt: grant?.expiresAt ?? null,
      targetFingerprint,
      certifiedReleaseSha: grant?.certifiedReleaseSha ?? null,
      referenceStateCode: approvals[0]?.stateCode ?? null,
      referenceCitySlug: approvals[0]?.citySlug ?? null,
    }];
  }));
  const promotion = readGlwCampaignLaunchPromotion();
  const localReferencesByCampaign = Object.fromEntries(campaigns.flatMap((campaign) => {
    if (campaign.pageType !== "city_service" || !campaign.cityTargets?.length) return [];
    const target = selectDeterministicCityReference(campaign);
    const reference = getGlwLocalReferenceDraft(campaign.campaignId, target.stateCode, target.citySlug);
    return reference ? [[campaign.campaignId, reference]] : [];
  }));
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
        activationReadinessByCampaign={activationReadinessByCampaign}
        globalPromotionAvailable={promotion.available}
        globalPromotionReason={promotion.reason}
        localReferencesByCampaign={localReferencesByCampaign}
      />
    </div>
  );
}