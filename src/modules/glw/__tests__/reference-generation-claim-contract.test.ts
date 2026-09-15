jest.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT,
  GLW_REFERENCE_GENERATION_CLAIM_CONTRACT,
  GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT,
  serializeGlwReferenceGenerationClaimContract,
} from "../reference-generation-claim-contract";
import { evaluateGlwReferenceClaimAuthority, GLW_REFERENCE_QA_POLICY_VERSION } from "../reference-claim-authority";
import { validateGlwN8nMcpDraftRequest } from "../n8n-mcp-recovery-contract";

function referenceRequest() {
  const contract = GLW_REFERENCE_GENERATION_CLAIM_CONTRACT;
  return {
    type: "page_generation",
    jobId: "job-in",
    operation: "CREATE_STATE",
    wordpressObjectId: null,
    operationKey: "job-in:draft",
    publicationKey: "site:path:draft",
    callbackUrl: "",
    site: { id: "site-led-display-warehouse-production" },
    page: { status: "draft" },
    publishingSettings: { status: "draft" },
    workflowContext: {
      additionalInstructions: "CAMPAIGN REFERENCE PAGE — APPROVED INSTRUCTIONS:",
      referenceGenerationClaimContract: contract,
      referenceGenerationAuthority: {
        references: [{ referenceId: "pdf", fileName: "Outdoor Digital Sphere Installations (2).pdf", role: "content_reference", scope: "campaign" }],
        authoritativeFactReferenceIds: [],
        visualOrContentReferenceIds: ["pdf"],
        productAuthority: { known: true, path: "/outdoor-digital-sphere/", anchorText: "Outdoor Digital Sphere" },
      },
    },
  };
}

describe("GLW reference generation claim contract", () => {
  test("is explicit, machine-readable, and distinguishes conceptual content from supported facts", () => {
    expect(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.version).toBe("GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_V1");
    expect(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.rules).toMatchObject({
      supportedFact: expect.stringContaining("only when"),
      conceptualApplication: expect.stringContaining("may be suitable"),
      unsupportedFact: expect.stringContaining("Do not generate"),
      unknownFact: expect.stringContaining("omit"),
      visualReference: expect.stringContaining("does not prove"),
    });
    expect(serializeGlwReferenceGenerationClaimContract()).toContain("UNSUPPORTED EXAMPLES:");
    expect(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT).toMatch(/^[0-9a-f]{64}$/);
    expect(GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT).toMatch(/^[0-9a-f]{64}$/);
  });

  test("requires structured claim and authority contracts for reference generation", () => {
    expect(validateGlwN8nMcpDraftRequest(referenceRequest())).toBeDefined();
    const missingContract = referenceRequest();
    delete (missingContract.workflowContext as Partial<typeof missingContract.workflowContext>).referenceGenerationClaimContract;
    expect(() => validateGlwN8nMcpDraftRequest(missingContract)).toThrow("certified claim contract");
    const missingAuthority = referenceRequest();
    delete (missingAuthority.workflowContext as Partial<typeof missingAuthority.workflowContext>).referenceGenerationAuthority;
    expect(() => validateGlwN8nMcpDraftRequest(missingAuthority)).toThrow("classified authority inventory");
  });

  test("campaign UI exposes persisted claim evidence and recovery guidance", () => {
    const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8").replace(/\s/g, "");
    for (const marker of ["UnsupportedClaimEvidence", "Failedpredicate:", "Currentpredicate:", "Reason:", "Requiredauthority:", "Disposition:"])
      expect(ui).toContain(marker);
  });
});

const forensicRoot = process.env.GLW_FORENSIC_PERSISTENCE_DIR;
(forensicRoot ? test : test.skip)("preserved Indiana artifact remains unchanged with 12 blocking and 5 conceptual findings", () => {
  const repositoryPath = join(forensicRoot!, "glw-page-execution-repository.json");
  const envelope = JSON.parse(readFileSync(repositoryPath, "utf8")) as { data: { records: Array<{ jobId: string; generatedDraft: { contentHtml: string } }> } };
  const job = envelope.data.records.find((record) => record.jobId === "020d45a9-0289-48dd-9f42-df5798dacdb1");
  expect(job).toBeDefined();
  expect(createHash("sha256").update(job!.generatedDraft.contentHtml).digest("hex")).toBe("6acc3f4cade86e291695e9e47814d0dfe675108acd70ba83d46c18bce7f47af8");
  const result = evaluateGlwReferenceClaimAuthority({ artifact: job!.generatedDraft as never });
  expect(result.policyVersion).toBe(GLW_REFERENCE_QA_POLICY_VERSION);
  expect(result.findings).toHaveLength(17);
  expect(result.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED")).toHaveLength(12);
  expect(result.findings.filter((finding) => finding.authorityStatus === "APPROVED_CONCEPTUAL")).toHaveLength(5);
  expect(result.ok).toBe(false);
});
