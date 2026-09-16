import "server-only";

import { createHash } from "node:crypto";
import { createAuthenticatedWordPressReadAuthority, type AuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getProductById } from "@/modules/foundation/product-repository";
import { listRenderedVisualCertifications } from "@/modules/foundation/rendered-visual-certification-repository";
import { resolveSharedRichPageProductionProfile } from "@/modules/foundation/shared-rich-page-production-authority";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { getGlwCampaignKnowledgePack } from "./campaign-reference-repository";
import { listGlwCampaigns } from "./campaign-repository";
import { previewGlwCampaignTargets, listGlwCampaignTargets, type GlwCampaignTarget } from "./campaign-target-repository";
import { buildGlwCampaignProductionGenerationForm } from "./campaign-production-generation";
import { getGlwReferenceStateSelection } from "./reference-state-selection-repository";
import { resolveGlwReferenceGenerationAuthority } from "./reference-generation-authority";
import { glwPageExecutionRepository } from "./page-execution-repository";
import { adaptProductForGeneration, adaptSiteForGeneration, buildLocalGlwGenerationPreview, getGlwState } from "./page-generation";
import { evaluateProductMediaReadiness, listProductMediaAuthority } from "./product-media-authority";
import { readGlwTargetPreflight, resolveGlwTargetMutationAvailability, type GlwTargetPreflightResult } from "./target-preflight";

export const TARGET_PARAMETERIZED_RICH_REFERENCE_PRODUCTION_VERSION = "GENESIS_TARGET_PARAMETERIZED_RICH_REFERENCE_PRODUCTION_V1" as const;

export type TargetParameterizedRichReferenceReadiness = {
  version: typeof TARGET_PARAMETERIZED_RICH_REFERENCE_PRODUCTION_VERSION;
  targetSource: "DURABLE_TARGET" | "PROJECTED_CAMPAIGN_AUTHORITY";
  target: {
    targetId: string;
    campaignId: string;
    stateCode: string;
    stateName: string;
    status: GlwCampaignTarget["status"];
  };
  identity: {
    organizationId: string;
    siteId: string;
    productId: string;
    canonicalSlug: string;
    canonicalPath: string;
    wordpressParentId: string;
    wordpressObjectId: string | null;
  };
  authority: {
    campaignResolved: boolean;
    siteResolved: boolean;
    productResolved: boolean;
    parentResolved: boolean;
    mediaResolved: boolean;
    claimResolved: boolean;
    hostIntegrationProfileResolved: boolean;
    semanticInputFingerprint: string | null;
    claimAuthorityFingerprint: string;
    mediaAuthorityFingerprint: string;
    heroMediaAuthorityId: string;
    supportingMediaAuthorityId: string;
    candidateArtifactIdentity: string | null;
    candidateArtifactSha: string | null;
    certificationIdentity: string | null;
    expectedStoredContentSha: string | null;
  };
  mediaPolicy: {
    existingProductMediaReusable: boolean;
    generatedContextualMediaSupported: true;
    generatedMediaCannotProveProductFacts: true;
    localAtmosphereRequired: boolean;
  };
  stages: {
    target: true;
    semanticGenerationInput: true;
    claimAuthority: true;
    mediaAuthority: true;
    richComposition: true;
    responsiveComposition: true;
    wordpressDraftPersistence: true;
    storedReadback: true;
    actualHostCertification: true;
    ownerReview: true;
  };
  awaitingProductionInputs: readonly string[];
  targetRequiresNewArchitecture: false;
  targetRequiresNewCode: false;
  draftProductionReady: true;
  sharedExactPublicationAuthorityReady: true;
  sharedRollbackAuthorityReady: true;
  publicationProductionReady: true;
  generationAttempted: false;
  wordpressMutation: false;
};

function sha256(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

export function selectNextEligibleRichReferenceTarget(input: {
  targets: readonly GlwCampaignTarget[];
  targetId?: string | null;
}): GlwCampaignTarget {
  const selected = input.targetId
    ? input.targets.find((target) => target.targetId === input.targetId) ?? null
    : [...input.targets]
        .filter((target) => target.status === "queued")
        .sort((left, right) => left.stateCode.localeCompare(right.stateCode) || (left.citySlug ?? "").localeCompare(right.citySlug ?? ""))[0] ?? null;
  if (!selected) throw new Error(input.targetId ? "RICH_REFERENCE_TARGET_NOT_FOUND" : "RICH_REFERENCE_NEXT_TARGET_UNAVAILABLE");
  if (selected.status !== "queued" && selected.status !== "reference_complete" && selected.status !== "content_ready" && selected.status !== "draft_ready") {
    throw new Error("RICH_REFERENCE_TARGET_STATE_INELIGIBLE");
  }
  return structuredClone(selected);
}

function storedContentSha(job: Awaited<ReturnType<typeof glwPageExecutionRepository.getById>>): string | null {
  const readback = job?.qaChecks?.wordpressReadback;
  if (!readback || typeof readback !== "object" || Array.isArray(readback)) return null;
  const value = (readback as Record<string, unknown>).storedContentSha256;
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value) ? value : null;
}

async function wordpressAuthority(siteId: string): Promise<AuthenticatedWordPressReadAuthority> {
  const site = getSiteById(siteId);
  if (!site?.integrations.wordpressApiBaseUrl) throw new Error("RICH_REFERENCE_WORDPRESS_SITE_AUTHORITY_REQUIRED");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential) throw new Error("RICH_REFERENCE_WORDPRESS_CREDENTIAL_REQUIRED");
  return createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
}

export async function resolveTargetParameterizedRichReferenceProduction(input: {
  campaignId: string;
  targetId?: string | null;
  wordpressReadAuthority?: AuthenticatedWordPressReadAuthority;
}): Promise<TargetParameterizedRichReferenceReadiness> {
  const campaign = listGlwCampaigns().find((candidate) => candidate.campaignId === input.campaignId) ?? null;
  if (!campaign) throw new Error("RICH_REFERENCE_CAMPAIGN_NOT_FOUND");
  if (campaign.pageType !== "state_service") throw new Error("RICH_REFERENCE_STATE_CAMPAIGN_REQUIRED");
  const selection = getGlwReferenceStateSelection(campaign.campaignId);
  if (!selection || !campaign.stateCodes.includes(selection.stateCode)) throw new Error("RICH_REFERENCE_STATE_SELECTION_REQUIRED");

  const durableTargets = listGlwCampaignTargets(campaign.campaignId);
  const targets = durableTargets.length > 0 ? durableTargets : previewGlwCampaignTargets({
    campaignId: campaign.campaignId,
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    productId: campaign.productId,
    stateCodes: campaign.stateCodes,
    referenceStateCode: selection.stateCode,
  });
  const target = selectNextEligibleRichReferenceTarget({ targets, targetId: input.targetId });
  const state = getGlwState(target.stateCode);
  const site = getSiteById(campaign.siteId);
  const product = getProductById(campaign.productId);
  const pack = getGlwCampaignKnowledgePack(campaign.campaignId);
  if (!state || !site || !product || !pack) throw new Error("RICH_REFERENCE_FOUNDATION_AUTHORITY_REQUIRED");
  if (target.organizationId !== campaign.organizationId || target.siteId !== campaign.siteId || target.productId !== campaign.productId || site.organizationId !== campaign.organizationId || product.organizationId !== campaign.organizationId) {
    throw new Error("RICH_REFERENCE_TARGET_SCOPE_MISMATCH");
  }

  const generation = buildGlwCampaignProductionGenerationForm({ campaign, stateCode: state.code });
  const generationSite = adaptSiteForGeneration(site);
  const generationProduct = adaptProductForGeneration(product, site.siteId);
  const preview = buildLocalGlwGenerationPreview({ form: generation.form, sites: [generationSite], products: [generationProduct] });
  if (!preview.request) throw new Error(`RICH_REFERENCE_GENERATION_INPUT_INVALID:${preview.validation.issues.map((issue) => issue.field).join(",")}`);

  const reader = input.wordpressReadAuthority ?? await wordpressAuthority(site.siteId);
  const jobs = await glwPageExecutionRepository.list();
  const targetPreflight: GlwTargetPreflightResult = await readGlwTargetPreflight({ request: preview.request, wordpressReadAuthority: reader, localExecutions: jobs });
  const mutation = resolveGlwTargetMutationAvailability(targetPreflight, "state_service");
  if (!targetPreflight.canonicalParentId || (!mutation.createAvailable && !mutation.updateAvailable)) throw new Error("RICH_REFERENCE_DRAFT_TARGET_UNAVAILABLE");

  const mediaRecords = listProductMediaAuthority({ organizationId: campaign.organizationId, siteId: campaign.siteId, productId: campaign.productId });
  const mediaReadiness = evaluateProductMediaReadiness(mediaRecords, { stateCode: state.code });
  if (!mediaReadiness.ready) throw new Error(`RICH_REFERENCE_MEDIA_AUTHORITY_REQUIRED:${mediaReadiness.blockers.join(",")}`);
  const hero = mediaRecords.find((record) => record.ownerApproval === "APPROVED" && record.heroSelected && record.heroEligible) ?? null;
  const supporting = mediaRecords.find((record) => record.ownerApproval === "APPROVED" && record.mediaAuthorityId !== hero?.mediaAuthorityId && (record.contextualUseAllowed || record.applicationUseAllowed || record.productRepresentationAllowed)) ?? null;
  if (!hero || !supporting) throw new Error("RICH_REFERENCE_MEDIA_SELECTION_REQUIRED");

  const generationAuthority = resolveGlwReferenceGenerationAuthority({ campaign, pack, stateCode: state.code });
  const profile = resolveSharedRichPageProductionProfile({ organizationId: campaign.organizationId, siteId: campaign.siteId, productId: campaign.productId, pageType: "LOCATION_SERVICE" });
  if (!profile) throw new Error("RICH_REFERENCE_HOST_PROFILE_REQUIRED");

  const job = target.jobId
    ? jobs.find((candidate) => candidate.jobId === target.jobId) ?? null
    : jobs.filter((candidate) => candidate.organizationId === campaign.organizationId && candidate.siteId === campaign.siteId && candidate.productId === campaign.productId && candidate.state === state.name && candidate.slug === preview.request!.slug).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  const candidateArtifactSha = job?.generatedDraft ? sha256(job.generatedDraft.contentHtml) : null;
  const candidateArtifactIdentity = job?.generatedDraft ? `job:${job.jobId}:${job.updatedAt}` : null;
  const certification = job && candidateArtifactSha
    ? listRenderedVisualCertifications({ organizationId: campaign.organizationId, siteId: campaign.siteId }).filter((item) => item.identity.jobId === job.jobId && item.identity.contentHash === candidateArtifactSha).at(-1) ?? null
    : null;
  const canonicalPath = `/${targetPreflight.canonicalPath.replace(/^\/+|\/+$/g, "")}/`;
  const mediaAuthorityFingerprint = sha256(mediaRecords.map((record) => ({ id: record.mediaAuthorityId, hash: record.hash, approval: record.ownerApproval, scopes: [...record.approvedUsageScopes].sort(), hero: record.heroSelected })).sort((left, right) => left.id.localeCompare(right.id)));

  return {
    version: TARGET_PARAMETERIZED_RICH_REFERENCE_PRODUCTION_VERSION,
    targetSource: durableTargets.length > 0 ? "DURABLE_TARGET" : "PROJECTED_CAMPAIGN_AUTHORITY",
    target: { targetId: target.targetId, campaignId: campaign.campaignId, stateCode: state.code, stateName: state.name, status: target.status },
    identity: { organizationId: campaign.organizationId, siteId: campaign.siteId, productId: campaign.productId, canonicalSlug: targetPreflight.canonicalSlug, canonicalPath, wordpressParentId: targetPreflight.canonicalParentId, wordpressObjectId: targetPreflight.wordpressObjectId ?? target.wordpressObjectId },
    authority: {
      campaignResolved: true,
      siteResolved: true,
      productResolved: true,
      parentResolved: true,
      mediaResolved: true,
      claimResolved: true,
      hostIntegrationProfileResolved: true,
      semanticInputFingerprint: candidateArtifactSha,
      claimAuthorityFingerprint: generationAuthority.claimAuthorityFingerprint,
      mediaAuthorityFingerprint,
      heroMediaAuthorityId: hero.mediaAuthorityId,
      supportingMediaAuthorityId: supporting.mediaAuthorityId,
      candidateArtifactIdentity,
      candidateArtifactSha,
      certificationIdentity: certification?.certificationId ?? null,
      expectedStoredContentSha: storedContentSha(job),
    },
    mediaPolicy: { existingProductMediaReusable: true, generatedContextualMediaSupported: true, generatedMediaCannotProveProductFacts: true, localAtmosphereRequired: profile.media.localAtmosphereRequired },
    stages: { target: true, semanticGenerationInput: true, claimAuthority: true, mediaAuthority: true, richComposition: true, responsiveComposition: true, wordpressDraftPersistence: true, storedReadback: true, actualHostCertification: true, ownerReview: true },
    awaitingProductionInputs: [
      ...(!job?.generatedDraft ? ["SEMANTIC_GENERATION_ARTIFACT"] : []),
      ...(!candidateArtifactIdentity ? ["CANDIDATE_ARTIFACT_IDENTITY"] : []),
      ...(!certification ? ["ACTUAL_HOST_VISUAL_CERTIFICATION"] : []),
      ...(!storedContentSha(job) ? ["WORDPRESS_STORED_CONTENT_SHA"] : []),
      "OWNER_CANDIDATE_REVIEW",
    ],
    targetRequiresNewArchitecture: false,
    targetRequiresNewCode: false,
    draftProductionReady: true,
    sharedExactPublicationAuthorityReady: true,
    sharedRollbackAuthorityReady: true,
    publicationProductionReady: true,
    generationAttempted: false,
    wordpressMutation: false,
  };
}
