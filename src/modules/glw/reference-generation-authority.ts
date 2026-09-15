import "server-only";

import { readFileSync } from "node:fs";
import type { GlwCampaign } from "./campaign-types";
import type { GlwCampaignKnowledgePack } from "./campaign-reference-types";
import { fingerprintGlwAuthority, GLW_REFERENCE_QA_POLICY_VERSION } from "./reference-claim-authority";
import { GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT, GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT } from "./reference-generation-claim-contract";
import { resolveGlwAllowedInternalLinks } from "./site-internal-link-authority";

export type GlwReferenceGenerationAuthorityBinding = {
  campaignInstructionFingerprint: string;
  referenceFingerprint: string;
  productAuthorityFingerprint: string;
  claimAuthorityFingerprint: string;
  generatorContractFingerprint: string;
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
  productAuthorityKnown: boolean;
} {
  const instructions = input.pack.instructions.trim();
  if (!instructions) throw new Error("CAMPAIGN_INSTRUCTIONS_MISSING");
  const references = [...input.pack.references]
    .sort((left, right) => left.referenceId.localeCompare(right.referenceId))
    .map((reference) => ({
      referenceId: reference.referenceId,
      fileName: reference.fileName,
      role: reference.role,
      scope: reference.scope,
      sha256: fingerprintGlwAuthority(readFileSync(reference.storagePath)),
    }));
  const productSlugById: Readonly<Record<string, string>> = {
    "prod-indoor-digital-sphere": "indoor-digital-sphere",
    "prod-outdoor-digital-sphere": "outdoor-digital-sphere",
    "prod-ssi-accent-rear-projection-film": "accent-rear-projection-film",
  };
  const productSlug = productSlugById[input.campaign.productId] ?? "unknown";
  const productLinks = resolveGlwAllowedInternalLinks({
    organizationId: input.campaign.organizationId,
    siteId: input.campaign.siteId,
    productId: input.campaign.productId,
    stateCode: input.stateCode,
    canonicalPath: `/${productSlug}/${input.stateCode.toLowerCase()}/`,
  });
  const productAuthority = productLinks.find((link) => link.authorityClass === "product") ?? null;
  return {
    campaignInstructionFingerprint: fingerprintGlwAuthority(instructions),
    referenceFingerprint: references.length === 1
      ? references[0].sha256
      : fingerprintGlwAuthority(references),
    productAuthorityFingerprint: fingerprintGlwAuthority(productAuthority),
    claimAuthorityFingerprint: GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT,
    generatorContractFingerprint: GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT,
    qaPolicyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
    campaignInstructionsLoaded: true,
    referenceFileNames: references.map((reference) => reference.fileName),
    productAuthorityPath: productAuthority?.href ?? null,
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