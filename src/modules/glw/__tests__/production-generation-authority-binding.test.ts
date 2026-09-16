jest.mock("server-only", () => ({}));

import { FOUNDATION_PRODUCTS } from "@/modules/foundation/catalog-fixtures";
import { FOUNDATION_SITE_FIXTURES } from "@/modules/foundation/site-fixtures";
import { attachGlwCampaignProductionAuthority } from "../campaign-production-generation";
import { adaptProductForGeneration, adaptSiteForGeneration, buildLocalGlwGenerationPreview, createDefaultGlwGenerationInput } from "../page-generation";
import { mapGenerationRequestToN8nDraft } from "../page-execution";
import { validateGlwN8nMcpDraftRequest } from "../n8n-mcp-recovery-contract";
import { GLW_REFERENCE_QA_POLICY_VERSION } from "../reference-claim-authority";
import {
  GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT,
  GLW_REFERENCE_GENERATION_CLAIM_CONTRACT,
  GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT,
  GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_FINGERPRINT,
} from "../reference-generation-claim-contract";
import { GLW_N8N_MODEL_CONTRACT_WORKFLOW_FINGERPRINT } from "../n8n-workflow-identity";

describe("normal campaign production authority binding", () => {
  test("attaches and validates structured contract and authority before model dispatch", () => {
    const site = adaptSiteForGeneration(FOUNDATION_SITE_FIXTURES[0]);
    const product = adaptProductForGeneration(FOUNDATION_PRODUCTS[0], site.siteId);
    const form = createDefaultGlwGenerationInput(site, product, "state_service", "AZ", "");
    form.additionalInstructions = "CAMPAIGN PRODUCTION PAGE — APPROVED INSTRUCTIONS:";
    attachGlwCampaignProductionAuthority({
      form,
      generationContext: {
        campaignId: "campaign-production",
        additionalInstructions: form.additionalInstructions,
        imageDirection: "Approved existing media only.",
        claimContract: GLW_REFERENCE_GENERATION_CLAIM_CONTRACT,
        referenceAuthority: { references: [], authoritativeFactReferenceIds: [], visualOrContentReferenceIds: [], supportedClaimMappings: [] },
      },
      generationAuthority: {
        campaignInstructionFingerprint: "a".repeat(64), referenceFingerprint: "b".repeat(64), productAuthorityFingerprint: "c".repeat(64),
        claimAuthorityFingerprint: GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT,
        generatorContractFingerprint: GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT,
        localizationPolicyFingerprint: GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_FINGERPRINT,
        n8nWorkflowFingerprint: GLW_N8N_MODEL_CONTRACT_WORKFLOW_FINGERPRINT,
        qaPolicyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
        campaignInstructionsLoaded: true,
        referenceFileNames: [],
        productAuthorityPath: "/outdoor-digital-sphere/",
        productAuthorityKnown: true,
      },
      productTopic: product.topic,
      stateCode: "AZ",
    });
    expect(form.referenceGenerationClaimContract?.version).toBe("GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_V1_1");
    expect(form.referenceAuthorityBinding?.generatorContractFingerprint).toBe(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT);
    expect(form.referenceGenerationAuthority?.authoritativeFactReferenceIds).toEqual([]);

    const request = buildLocalGlwGenerationPreview({ form, sites: [site], products: [product] }).request!;
    const mapped = mapGenerationRequestToN8nDraft("offline-production-proof", request);
    expect(validateGlwN8nMcpDraftRequest(mapped)).toBe(mapped);

    const missingContract = structuredClone(mapped);
    delete missingContract.workflowContext.referenceGenerationClaimContract;
    expect(() => validateGlwN8nMcpDraftRequest(missingContract)).toThrow("certified claim contract");

    const missingAuthority = structuredClone(mapped);
    delete missingAuthority.workflowContext.referenceAuthorityBinding;
    expect(() => validateGlwN8nMcpDraftRequest(missingAuthority)).toThrow("complete authority binding");
  });
});