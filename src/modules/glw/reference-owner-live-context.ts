import "server-only";

import { createHash } from "node:crypto";
import { getSiteById } from "@/modules/foundation/site-repository";
import { inspectSiteWordPressReadAuthority } from "@/modules/foundation/wordpress-read-authority-status";
import { getGlwCampaignKnowledgePack } from "./campaign-reference-repository";
import { listGlwCampaigns } from "./campaign-repository";
import { glwPageExecutionRepository } from "./page-execution-repository";
import { fingerprintGlwAuthority } from "./reference-claim-authority";
import { resolveGlwReferenceGenerationAuthority } from "./reference-generation-authority";
import type { GlwReferenceOwnerContext, GlwReferenceOwnerOperationType } from "./reference-owner-authority";
import { projectGlwDurableReferenceOperation } from "./reference-workflow-state";

export async function resolveGlwReferenceOwnerLiveContext(input: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  referenceState: string;
  referenceCitySlug?: string | null;
  operationType: GlwReferenceOwnerOperationType;
  failedJobId?: string | null;
  failedArtifactSha256?: string | null;
}): Promise<Omit<GlwReferenceOwnerContext, "principalId" | "principalSessionId">> {
  const campaign = listGlwCampaigns().find((candidate) =>
    candidate.campaignId === input.campaignId
    && candidate.organizationId === input.organizationId
    && candidate.siteId === input.siteId,
  );
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
  if (campaign.status !== "draft") throw new Error("CAMPAIGN_STATUS_INVALID");
  if (!campaign.stateCodes.includes(input.referenceState)) throw new Error("REFERENCE_STATE_NOT_IN_CAMPAIGN");
  if (campaign.pageType === "city_service") {
    const citySlug = (input.referenceCitySlug ?? "").trim().toLowerCase();
    if (!citySlug) throw new Error("REFERENCE_CITY_REQUIRED");
    const cityMatch = (campaign.cityTargets ?? []).some((target) =>
      target.stateCode === input.referenceState
      && target.citySlug.trim().toLowerCase() === citySlug,
    );
    if (!cityMatch) throw new Error("REFERENCE_CITY_NOT_IN_CAMPAIGN");
  }
  const pack = getGlwCampaignKnowledgePack(campaign.campaignId);
  const site = getSiteById(campaign.siteId);
  if (!pack || !site) throw new Error("REFERENCE_AUTHORITY_UNAVAILABLE");
  const generation = resolveGlwReferenceGenerationAuthority({ campaign, pack, stateCode: input.referenceState });
  const wordpress = await inspectSiteWordPressReadAuthority(site);
  if (wordpress.authorityHealthState !== "READY") throw new Error("WORDPRESS_READ_AUTHORITY_NOT_READY");
  const wordpressAuthority = [
    wordpress.siteId,
    site.integrations.wordpressCredentialReference,
    wordpress.configuredUsername,
    wordpress.authorityHealthState,
  ].join(":");
  const exactRuntime = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
  const records = await glwPageExecutionRepository.list();
  const durableOperation = projectGlwDurableReferenceOperation({
    campaign,
    campaigns: listGlwCampaigns(),
    records,
    selectedStateCode: input.referenceState,
  });
  if (input.operationType !== durableOperation.operationType) throw new Error("REFERENCE_OPERATION_MISMATCH");
  if (input.operationType === "REFERENCE_GENERATION_RETRY"
    && (input.failedJobId !== durableOperation.failedJobId || input.failedArtifactSha256 !== durableOperation.failedArtifactSha256)) {
    throw new Error("REFERENCE_RECOVERY_BINDING_MISMATCH");
  }

  if (input.operationType === "REFERENCE_GENERATION_RETRY") {
    const failed = input.failedJobId
      ? await glwPageExecutionRepository.getById(input.failedJobId)
      : null;
    if (!failed) throw new Error("RETRY_FAILED_JOB_NOT_FOUND");
    if (failed.status !== "FAILED") throw new Error("RETRY_FAILED_JOB_NOT_TERMINAL");
    if (failed.organizationId !== campaign.organizationId || failed.siteId !== campaign.siteId || failed.productId !== campaign.productId) {
      throw new Error("RETRY_FAILED_JOB_SCOPE_MISMATCH");
    }
    const artifactSha = failed.generatedDraft?.contentHtml
      ? createHash("sha256").update(failed.generatedDraft.contentHtml).digest("hex")
      : null;
    if (!artifactSha || artifactSha !== input.failedArtifactSha256) throw new Error("RETRY_FAILED_ARTIFACT_MISMATCH");
  }

  return {
    operationType: input.operationType,
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    campaignId: campaign.campaignId,
    referenceState: input.referenceState,
    referenceFingerprint: generation.referenceFingerprint,
    campaignInstructionFingerprint: generation.campaignInstructionFingerprint,
    productAuthorityFingerprint: generation.productAuthorityFingerprint,
    claimAuthorityFingerprint: generation.claimAuthorityFingerprint,
    generatorContractFingerprint: generation.generatorContractFingerprint,
    localizationPolicyFingerprint: generation.localizationPolicyFingerprint,
    n8nWorkflowFingerprint: generation.n8nWorkflowFingerprint,
    qaPolicyVersion: generation.qaPolicyVersion,
    wordpressReadAuthorityFingerprint: fingerprintGlwAuthority(wordpressAuthority),
    exactRuntime,
    failedJobId: input.operationType === "REFERENCE_GENERATION_RETRY" ? input.failedJobId ?? null : null,
    failedArtifactSha256: input.operationType === "REFERENCE_GENERATION_RETRY" ? input.failedArtifactSha256 ?? null : null,
  };
}