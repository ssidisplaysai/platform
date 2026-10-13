import "server-only";

import { readFileSync } from "node:fs";
import type { GlwCampaign } from "./campaign-types";
import type { GlwCampaignKnowledgePack } from "./campaign-reference-types";
import { fingerprintGlwAuthority, GLW_REFERENCE_QA_POLICY_VERSION } from "./reference-claim-authority";
import { GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT, GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT, GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_FINGERPRINT } from "./reference-generation-claim-contract";
import { GLW_N8N_MODEL_CONTRACT_WORKFLOW_FINGERPRINT } from "./n8n-workflow-identity";
import { resolveGlwAllowedInternalLinks, resolveGlwProductAuthority } from "./site-internal-link-authority";
import { buildGlwEffectiveCampaignInstructions } from "./campaign-generation-context";

export type GlwReferenceGenerationAuthorityBinding = {
  campaignInstructionFingerprint: string;
  referenceFingerprint: string;
  productAuthorityFingerprint: string;
  claimAuthorityFingerprint: string;
  generatorContractFingerprint: string;
  localizationPolicyFingerprint: string;
  n8nWorkflowFingerprint: string;
  qaPolicyVersion: string;
};

export function resolveGlwReferenceGenerationAuthority(input: {
  campaign: GlwCampaign;
  pack: GlwCampaignKnowledgePack;
  stateCode: string;
}): GlwReferenceGenerationAuthorityBinding & {
  campaignInstructionsLoaded: true;
  referenceFileNames: readonly string[];
  productAuthorityPath: string | null;
  productAuthorityAnchorText: string | null;
  productAuthorityKnown: boolean;
} {
  const instructions = input.pack.instructions.trim();
  if (!instructions) throw new Error("CAMPAIGN_INSTRUCTIONS_MISSING");
  const effectiveInstructions = buildGlwEffectiveCampaignInstructions(instructions);
  const references = [...input.pack.references]
    .sort((left, right) => left.referenceId.localeCompare(right.referenceId))
    .map((reference) => ({
      referenceId: reference.referenceId,
      fileName: reference.fileName,
      role: reference.role,
      scope: reference.scope,
      sha256: fingerprintGlwAuthority(readFileSync(reference.storagePath)),
    }));
  const productAuthorityIdentity = resolveGlwProductAuthority({
    organizationId: input.campaign.organizationId,
    siteId: input.campaign.siteId,
    productId: input.campaign.productId,
  });
  const productLinks = resolveGlwAllowedInternalLinks({
    organizationId: input.campaign.organizationId,
    siteId: input.campaign.siteId,
    productId: input.campaign.productId,
    stateCode: input.stateCode,
    canonicalPath: productAuthorityIdentity
      ? `${productAuthorityIdentity.path}${input.stateCode.toLowerCase()}/`
      : `/${input.stateCode.toLowerCase()}/`,
  });
  const productAuthority = productLinks.find((link) => link.authorityClass === "product") ?? null;
  return {
    campaignInstructionFingerprint: fingerprintGlwAuthority(effectiveInstructions),
    referenceFingerprint: references.length === 1
      ? references[0].sha256
      : fingerprintGlwAuthority(references),
    productAuthorityFingerprint: fingerprintGlwAuthority({
      authorityScope: "NAVIGATION_AND_PRODUCT_IDENTITY_ONLY",
      identity: productAuthority,
    }),
    claimAuthorityFingerprint: GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT,
    generatorContractFingerprint: GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT,
    localizationPolicyFingerprint: GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_FINGERPRINT,
    n8nWorkflowFingerprint: GLW_N8N_MODEL_CONTRACT_WORKFLOW_FINGERPRINT,
    qaPolicyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
    campaignInstructionsLoaded: true,
    referenceFileNames: references.map((reference) => reference.fileName),
    productAuthorityPath: productAuthority?.href ?? null,
    productAuthorityAnchorText: productAuthority?.anchorText ?? null,
    productAuthorityKnown: Boolean(productAuthority),
  };
}

export function generationAuthorityBindingsMatch(
  expected: GlwReferenceGenerationAuthorityBinding,
  supplied: GlwReferenceGenerationAuthorityBinding | null | undefined,
): boolean {
  return Boolean(supplied
    && supplied.campaignInstructionFingerprint === expected.campaignInstructionFingerprint
    && supplied.referenceFingerprint === expected.referenceFingerprint
    && supplied.productAuthorityFingerprint === expected.productAuthorityFingerprint
    && supplied.claimAuthorityFingerprint === expected.claimAuthorityFingerprint
    && supplied.generatorContractFingerprint === expected.generatorContractFingerprint
    && supplied.localizationPolicyFingerprint === expected.localizationPolicyFingerprint
    && supplied.n8nWorkflowFingerprint === expected.n8nWorkflowFingerprint
    && supplied.qaPolicyVersion === expected.qaPolicyVersion);
}

export function buildGlwExactRetryContract(input: {
  campaign: GlwCampaign;
  binding: GlwReferenceGenerationAuthorityBinding;
  failedJobId: string;
  failedArtifactSha256: string;
  wordpressReadAuthority: string;
  exactRuntime: string;
}) {
  return {
    campaignId: input.campaign.campaignId,
    siteId: input.campaign.siteId,
    referenceState: "IN" as const,
    failedJobId: input.failedJobId,
    failedArtifactSha256: input.failedArtifactSha256,
    ...input.binding,
    currentWordPressReadAuthority: input.wordpressReadAuthority,
    exactRuntime: input.exactRuntime,
    ownerAuthorization: null,
    ownerAuthorizationRequired: true,
    previousAuthorityReusable: false,
    automaticRetry: false,
    duplicateProtection: true,
    executable: false,
  };
}