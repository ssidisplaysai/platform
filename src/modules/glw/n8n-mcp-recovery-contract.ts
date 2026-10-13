import type { GlwN8nDraftRequest } from "./page-execution";
import { GLW_REFERENCE_CLAIM_CLASSES } from "./reference-claim-authority";
import {
  GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT,
  GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT,
  GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_FINGERPRINT,
} from "./reference-generation-claim-contract";
import { GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION } from "./reference-generation-claim-contract-version";
import { GLW_REFERENCE_QA_POLICY_VERSION } from "./reference-claim-authority";
import { GLW_N8N_MODEL_CONTRACT_WORKFLOW_FINGERPRINT } from "./n8n-workflow-identity";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function validateGlwN8nMcpDraftRequest(value: unknown): GlwN8nDraftRequest {
  const request = asRecord(value);
  const page = asRecord(request.page);
  const site = asRecord(request.site);
  const workflowContext = asRecord(request.workflowContext);
  const claimContract = asRecord(workflowContext.referenceGenerationClaimContract);
  const claimContractRules = asRecord(claimContract.rules);
  const sourceToClaimContract = asRecord(claimContract.sourceToClaimMapping);
  const productAuthorityContract = asRecord(claimContract.productAuthority);
  const buyerQuestionContract = asRecord(claimContract.buyerQuestionFallback);
  const localizationContract = asRecord(claimContract.localizationPolicy);
  const referenceAuthority = asRecord(workflowContext.referenceGenerationAuthority);
  const authorityBinding = asRecord(workflowContext.referenceAuthorityBinding);
  const productAuthority = asRecord(referenceAuthority.productAuthority);
  const additionalInstructions = typeof workflowContext.additionalInstructions === "string"
    ? workflowContext.additionalInstructions
    : "";
  const publishingSettings = asRecord(request.publishingSettings);
  const jobId = typeof request.jobId === "string" ? request.jobId.trim() : "";
  const operationKey = typeof request.operationKey === "string" ? request.operationKey.trim() : "";
  const publicationKey = typeof request.publicationKey === "string" ? request.publicationKey.trim() : "";
  const operation = typeof request.operation === "string" ? request.operation.trim().toUpperCase() : "";
  const wordpressObjectId = typeof request.wordpressObjectId === "string"
    ? request.wordpressObjectId.trim()
    : "";
  const publicationAliases = [
    request.publishing_mode,
    request.publishingMode,
    request.status,
    publishingSettings.status,
    page.publishingMode,
    page.publishing_mode,
    page.status,
  ].filter((entry) => entry !== undefined && entry !== null && entry !== "");

  if (request.type !== "page_generation") throw new Error("GLW MCP request type must be page_generation.");
  if (!jobId) throw new Error("GLW MCP request requires a jobId.");
  if (publishingSettings.status !== "draft") throw new Error("GLW MCP publishing settings must request draft.");
  if (page.status !== "draft") throw new Error("GLW MCP page status must request draft.");
  if (!operationKey.endsWith(":draft")) throw new Error("GLW MCP operation key must end with :draft.");
  if (!publicationKey.endsWith(":draft")) throw new Error("GLW MCP publication key must end with :draft.");
  if (request.callbackUrl !== "") throw new Error("GLW MCP callback URL must be empty.");
  if (!/^(CREATE|UPDATE)_(GENERAL|STATE|CITY)$/.test(operation)) {
    throw new Error("GLW MCP request requires an explicit create or update operation.");
  }
  if (operation.startsWith("UPDATE_") && !/^[1-9]\d*$/.test(wordpressObjectId)) {
    throw new Error("GLW MCP updates require an exact persisted WordPress object ID.");
  }
  if (operation.startsWith("CREATE_") && wordpressObjectId) {
    throw new Error("GLW MCP creates cannot carry WordPress update authority.");
  }
  if (publicationAliases.some((entry) => String(entry).trim().toLowerCase() !== "draft")) {
    throw new Error("GLW MCP request contains a conflicting publication alias.");
  }

  const incomingSiteId = typeof site.id === "string" ? site.id.trim() : "";

  if (!incomingSiteId) {
    throw new Error("GLW MCP request requires a canonical Genesis site ID.");
  }
  const governedCampaignGeneration = additionalInstructions.startsWith("CAMPAIGN REFERENCE PAGE")
    || additionalInstructions.startsWith("CAMPAIGN PRODUCTION PAGE");
  if (governedCampaignGeneration
    && claimContract.version !== GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION) {
    throw new Error("GLW MCP campaign generation requires the certified claim contract.");
  }
  if (governedCampaignGeneration) {
    const requiredRuleNames = [
      "supportedFact", "conceptualApplication", "unsupportedFact", "unknownFact", "visualReference",
      "sourceToClaimMapping", "navigationAuthority", "buyerQuestionFallback", "trendAuthority",
      "genericProductKnowledge", "headingSeparation",
    ];
    if (requiredRuleNames.some((ruleName) => typeof claimContractRules[ruleName] !== "string")
      || sourceToClaimContract.requiredForProtectedFacts !== true
      || sourceToClaimContract.noAuthorityMappingNoProtectedFact !== true
      || productAuthorityContract.scope !== "NAVIGATION_AND_PRODUCT_IDENTITY_ONLY"
      || !Array.isArray(buyerQuestionContract.requiredPrefixes)
      || typeof localizationContract.version !== "string") {
      throw new Error("GLW MCP campaign generation requires the complete V1.1 claim contract.");
    }
    const references = Array.isArray(referenceAuthority.references) ? referenceAuthority.references.map(asRecord) : null;
    const authoritativeIds = Array.isArray(referenceAuthority.authoritativeFactReferenceIds)
      ? referenceAuthority.authoritativeFactReferenceIds.filter((entry): entry is string => typeof entry === "string")
      : null;
    const contentIds = Array.isArray(referenceAuthority.visualOrContentReferenceIds)
      ? referenceAuthority.visualOrContentReferenceIds.filter((entry): entry is string => typeof entry === "string")
      : null;
    const mappings = Array.isArray(referenceAuthority.supportedClaimMappings)
      ? referenceAuthority.supportedClaimMappings.map(asRecord)
      : null;
    if (!references || !authoritativeIds || !contentIds || !mappings) {
      throw new Error("GLW MCP campaign generation requires classified authority inventory.");
    }
    const authoritativeReferenceIds = new Set(references
      .filter((reference) => reference.role === "authoritative_fact")
      .map((reference) => reference.referenceId));
    const nonAuthoritativeReferenceIds = new Set(references
      .filter((reference) => reference.role !== "authoritative_fact")
      .map((reference) => reference.referenceId));
    if (authoritativeIds.some((referenceId) => !authoritativeReferenceIds.has(referenceId))
      || contentIds.some((referenceId) => !nonAuthoritativeReferenceIds.has(referenceId))) {
      throw new Error("GLW MCP reference authority classification is inconsistent.");
    }
    if (mappings.some((mapping) =>
      typeof mapping.authoritativeFactReferenceId !== "string"
      || !authoritativeReferenceIds.has(mapping.authoritativeFactReferenceId)
      || typeof mapping.supportedAssertion !== "string"
      || !mapping.supportedAssertion.trim()
      || typeof mapping.claimClass !== "string"
      || !GLW_REFERENCE_CLAIM_CLASSES.includes(mapping.claimClass as typeof GLW_REFERENCE_CLAIM_CLASSES[number]))) {
      throw new Error("GLW MCP protected facts require valid source-to-claim mappings.");
    }
    if (productAuthority.authorityScope !== "NAVIGATION_AND_PRODUCT_IDENTITY_ONLY") {
      throw new Error("GLW MCP canonical product authority must be navigation-only.");
    }
    const authorityLocalization = asRecord(referenceAuthority.localizationPolicy);
    if (typeof authorityLocalization.version !== "string"
      || typeof authorityLocalization.expectedStateCode !== "string"
      || !Array.isArray(authorityLocalization.authorizedComparisonStateCodes)) {
      throw new Error("GLW MCP campaign generation requires state/localization authority.");
    }
    const fingerprintFields = [
      "campaignInstructionFingerprint", "referenceFingerprint", "productAuthorityFingerprint",
    ];
    if (fingerprintFields.some((field) => !/^[0-9a-f]{64}$/.test(String(authorityBinding[field] ?? "")))
      || authorityBinding.generatorContractFingerprint !== GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT
      || authorityBinding.claimAuthorityFingerprint !== GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT
      || authorityBinding.localizationPolicyFingerprint !== GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_FINGERPRINT
      || authorityBinding.n8nWorkflowFingerprint !== GLW_N8N_MODEL_CONTRACT_WORKFLOW_FINGERPRINT
      || authorityBinding.qaPolicyVersion !== GLW_REFERENCE_QA_POLICY_VERSION) {
      throw new Error("GLW MCP campaign generation requires the complete authority binding.");
    }
  }

  return value as GlwN8nDraftRequest;
}
