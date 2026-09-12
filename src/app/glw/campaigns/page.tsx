import { AppShell } from "@/components/layout/app-shell";
import { listProducts } from "@/modules/foundation/product-repository";
import { listSites } from "@/modules/foundation/site-repository";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listAllGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { getGlwCampaignKnowledgePack } from "@/modules/glw/campaign-reference-repository";
import { listGlwCampaignReferenceApprovals } from "@/modules/glw/campaign-reference-approval-repository";
import { getGlwLocalReferenceDraft } from "@/modules/glw/campaign-local-reference-repository";
import {
  getLatestGlwReferenceImageCandidate,
  listGlwReferenceImageCandidates,
  readGlwReferenceImageCandidateBytes,
} from "@/modules/glw/campaign-reference-image-candidate-repository";
import {
  createGlwCampaignTargetFingerprint,
  listGlwCampaignActivationGrants,
} from "@/modules/glw/campaign-activation-authorization";
import { selectDeterministicCityReference } from "@/modules/glw/projector-enclosure-texas-reference";
import { GlwCampaignManager, type GovernedReview } from "@/modules/glw/GlwCampaignManager";

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
    (campaign) =>
      campaign.organizationId === organizationId &&
      (!requestedSiteId || campaign.siteId === requestedSiteId),
  );
  const allTargets = listAllGlwCampaignTargets();
  const governedReviewByCampaign: Record<string, GovernedReview> = Object.fromEntries(campaigns.flatMap((campaign) => {
    if (campaign.pageType !== "city_service" || !campaign.cityTargets?.length) return [];
    const target = selectDeterministicCityReference(campaign);
    const reference = getGlwLocalReferenceDraft(campaign.campaignId, target.stateCode, target.citySlug);
    if (!reference) return [];
    const scope = {
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId: campaign.campaignId,
      referenceDraftId: reference.referenceDraftId,
    };
    const imageCandidate = getLatestGlwReferenceImageCandidate(scope);
    const stored = imageCandidate ? readGlwReferenceImageCandidateBytes({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId: campaign.campaignId,
      candidateId: imageCandidate.candidateId,
    }) : null;
    const targets = allTargets.filter((item) => item.campaignId === campaign.campaignId);
    const preparedTargets = targets.filter((item) => item.status === "prepared");
    const approvals = listGlwCampaignReferenceApprovals(campaign.campaignId);
    const pack = getGlwCampaignKnowledgePack(campaign.campaignId);
    const grant = listGlwCampaignActivationGrants(campaign.campaignId).at(-1) ?? null;
    let targetFingerprint: string | null = null;
    try {
      if (preparedTargets.length > 0) targetFingerprint = createGlwCampaignTargetFingerprint(campaign, preparedTargets);
    } catch {
      targetFingerprint = null;
    }
    const runningRelease = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
    const grantActive = Boolean(
      grant
      && !grant.claimedAt
      && !grant.consumedAt
      && new Date(grant.expiresAt) > new Date()
      && grant.targetFingerprint === targetFingerprint
      && grant.publicationPolicy === campaign.publicationPolicy
      && grant.certifiedReleaseSha === runningRelease,
    );
    return [[campaign.campaignId, {
      knowledgePack: pack,
      reference,
      imageCandidate,
      imageHistory: listGlwReferenceImageCandidates(scope),
      imagePreviewDataUrl: stored ? `data:${stored.candidate.mimeType};base64,${stored.bytes.toString("base64")}` : null,
      activationReadiness: {
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
      },
    }]];
  }));

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
        governedReviewByCampaign={governedReviewByCampaign}
      />
    </AppShell>
  );
}
