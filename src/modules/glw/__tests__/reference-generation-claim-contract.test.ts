jest.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT,
  GLW_REFERENCE_GENERATION_CLAIM_CONTRACT,
  GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT,
  GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_FINGERPRINT,
  serializeGlwReferenceGenerationClaimContract,
} from "../reference-generation-claim-contract";
import { evaluateGlwReferenceClaimAuthority, GLW_REFERENCE_QA_POLICY_VERSION } from "../reference-claim-authority";
import { validateGlwN8nMcpDraftRequest } from "../n8n-mcp-recovery-contract";
import { buildGlwEffectiveCampaignInstructions } from "../campaign-generation-context";
import { GLW_N8N_MODEL_CONTRACT_WORKFLOW_FINGERPRINT } from "../n8n-workflow-identity";

function artifact(contentHtml: string) {
  return { title: "Test", contentHtml, slug: "test", excerpt: null, seoTitle: null, metaDescription: null, focusKeyphrase: null };
}

function evaluate(contentHtml: string) {
  return evaluateGlwReferenceClaimAuthority({
    artifact: artifact(contentHtml),
    authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] },
  });
}

function referenceRequest() {
  const contract = structuredClone(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT);
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
        supportedClaimMappings: [],
        productAuthority: {
          known: true,
          path: "/outdoor-digital-sphere/",
          anchorText: "Outdoor Digital Sphere",
          authorityScope: "NAVIGATION_AND_PRODUCT_IDENTITY_ONLY",
        },
        localizationPolicy: {
          version: "GLW_STATE_LOCALIZATION_CONTAMINATION_V1",
          expectedStateCode: "IN",
          authorizedComparisonStateCodes: [],
        },
      },
      referenceAuthorityBinding: {
        campaignInstructionFingerprint: "a".repeat(64),
        referenceFingerprint: "b".repeat(64),
        productAuthorityFingerprint: "c".repeat(64),
        claimAuthorityFingerprint: GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT,
        generatorContractFingerprint: GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT,
        localizationPolicyFingerprint: GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_FINGERPRINT,
        n8nWorkflowFingerprint: GLW_N8N_MODEL_CONTRACT_WORKFLOW_FINGERPRINT,
        qaPolicyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
      },
    },
  };
}

describe("GLW reference generation claim contract", () => {
  test("is explicit, machine-readable, and distinguishes conceptual content from supported facts", () => {
    expect(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.version).toBe("GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_V1_1");
    expect(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.rules).toMatchObject({
      supportedFact: expect.stringContaining("only when"),
      conceptualApplication: expect.stringContaining("may be suitable"),
      unsupportedFact: expect.stringContaining("Do not generate"),
      unknownFact: expect.stringContaining("omit"),
      visualReference: expect.stringContaining("does not prove"),
      sourceToClaimMapping: expect.stringContaining("authoritativeFactReferenceId"),
      navigationAuthority: expect.stringContaining("canonical internal link"),
      buyerQuestionFallback: expect.stringContaining("explicit buyer question"),
      trendAuthority: expect.stringContaining("market authority"),
      genericProductKnowledge: expect.stringContaining("not authority"),
      headingSeparation: expect.stringContaining("structurally separate"),
    });
    expect(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.sourceToClaimMapping).toEqual({
      requiredForProtectedFacts: true,
      requiredFields: ["authoritativeFactReferenceId", "supportedAssertion"],
      noAuthorityMappingNoProtectedFact: true,
    });
    expect(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.productAuthority.scope).toBe("NAVIGATION_AND_PRODUCT_IDENTITY_ONLY");
    expect(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.prohibitedWithoutExplicitAuthority).toEqual(expect.arrayContaining([
      "CLIMATE", "LOCATION_FACT", "PRODUCT_SPECIFICATION", "PRODUCT_CAPABILITY", "DURABILITY",
      "WARRANTY", "PRICING", "INTERACTIVITY", "REMOTE_MANAGEMENT", "MARKET_ADOPTION",
      "PERFORMANCE", "INSTALLATION_CAPABILITY", "SERVICE_CAPABILITY",
    ]));
    expect(serializeGlwReferenceGenerationClaimContract()).toContain("SOURCE-TO-CLAIM MAPPING:");
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

    const contentReferenceMapping = referenceRequest();
    contentReferenceMapping.workflowContext.referenceGenerationAuthority.supportedClaimMappings = [{
      authoritativeFactReferenceId: "pdf",
      claimClass: "DURABILITY",
      supportedAssertion: "The product is weatherproof.",
    }];
    expect(() => validateGlwN8nMcpDraftRequest(contentReferenceMapping)).toThrow("source-to-claim mappings");

    const productCapabilityAuthority = referenceRequest();
    productCapabilityAuthority.workflowContext.referenceGenerationAuthority.productAuthority.authorityScope = "PRODUCT_CAPABILITY" as never;
    expect(() => validateGlwN8nMcpDraftRequest(productCapabilityAuthority)).toThrow("navigation-only");

    const incompleteContract = referenceRequest();
    delete (incompleteContract.workflowContext.referenceGenerationClaimContract.rules as Partial<typeof incompleteContract.workflowContext.referenceGenerationClaimContract.rules>).buyerQuestionFallback;
    expect(() => validateGlwN8nMcpDraftRequest(incompleteContract)).toThrow("complete V1.1 claim contract");
  });

  test("requires structured claim contract and authority binding for production generation", () => {
    const production = referenceRequest();
    production.workflowContext.additionalInstructions = "CAMPAIGN PRODUCTION PAGE — APPROVED INSTRUCTIONS:";
    expect(validateGlwN8nMcpDraftRequest(production)).toBe(production);

    const missingContract = structuredClone(production);
    delete (missingContract.workflowContext as Partial<typeof missingContract.workflowContext>).referenceGenerationClaimContract;
    expect(() => validateGlwN8nMcpDraftRequest(missingContract)).toThrow("certified claim contract");

    const missingBinding = structuredClone(production);
    delete (missingBinding.workflowContext as Partial<typeof missingBinding.workflowContext>).referenceAuthorityBinding;
    expect(() => validateGlwN8nMcpDraftRequest(missingBinding)).toThrow("complete authority binding");
  });

  test.each([
    ["Indiana climate factual assertion", "<p>Indiana's climate and weather conditions impact operational requirements.</p>", false],
    ["Indiana climate buyer question", "<p>What environmental conditions should the project team ask the selected supplier and engineer to evaluate for the Indiana installation?</p>", true],
    ["Indiana weather planning question", "<p>Which weather conditions should be reviewed with the selected supplier, engineer, and permitting authority before finalizing the Indiana installation?</p>", true],
    ["unsupported sensors", "<p>The system requires sensors and networking support.</p>", false],
    ["supplier-dependent interactive question", "<p>Does the selected supplier confirm support for the desired interactive concept, and what additional hardware is required, if any?</p>", true],
    ["unsupported dynamic content capability", "<p>The ability to program dynamic content enables interactive experiences.</p>", false],
    ["conceptual interactive application", "<p>One possible concept could be considered for an interactive art installation.</p>", true],
    ["unsupported Indiana trend", "<h2>Digital Display Trends in Indiana</h2><p>Interactive displays are growing in popularity.</p>", false],
    ["conceptual replacement section", "<h2>Potential Application Questions</h2><p>What interactive concept could the project team explore?</p>", true],
    ["canonical product link", "<p>Review the <a href=\"/outdoor-digital-sphere/\">Outdoor Digital Sphere</a> product page.</p>", true],
    ["product link used for durability", "<p>The Outdoor Digital Sphere product page proves the system is weatherproof.</p>", false],
    ["product link used for interactivity", "<p>The Outdoor Digital Sphere product page proves support for interactive content.</p>", false],
    ["no fact authority protected fact", "<p>The system provides remote management.</p>", false],
    ["no fact authority buyer question", "<p>Can the selected supplier confirm whether the system provides remote management?</p>", true],
  ])("enforces V1.1 fixture: %s", (_name, html, expectedOk) => {
    expect(evaluate(html).ok).toBe(expectedOk);
  });

  test("supports a protected assertion only through an exact authoritative source mapping", () => {
    const claimText = "The selected product has a five-year warranty.";
    const result = evaluateGlwReferenceClaimAuthority({
      artifact: artifact(`<p>${claimText}</p>`),
      authority: {
        references: [{ referenceId: "approved-product-sheet", role: "authoritative_fact" }],
        authoritativeFactReferenceIds: ["approved-product-sheet"],
        supportedClaimMappings: [{
          authoritativeFactReferenceId: "approved-product-sheet",
          claimClass: "WARRANTY",
          supportedAssertion: claimText,
        }],
      },
    });
    expect(result).toMatchObject({ ok: true, findings: [expect.objectContaining({ authorityStatus: "SUPPORTED", authoritySource: "approved-product-sheet" })] });
  });

  test("rejects a content reference even when its ID appears in a mapping", () => {
    const claimText = "The selected product is weatherproof.";
    const result = evaluateGlwReferenceClaimAuthority({
      artifact: artifact(`<p>${claimText}</p>`),
      authority: {
        references: [{ referenceId: "content-pdf", role: "content_reference" }],
        authoritativeFactReferenceIds: ["content-pdf"],
        supportedClaimMappings: [{ authoritativeFactReferenceId: "content-pdf", claimClass: "DURABILITY", supportedAssertion: claimText }],
      },
    });
    expect(result).toMatchObject({ ok: false, findings: [expect.objectContaining({ authorityStatus: "UNSUPPORTED" })] });
  });

  test("appends bounded V1.1 campaign instruction guardrails", () => {
    const repaired = buildGlwEffectiveCampaignInstructions("Add useful state context and discuss seasonal conditions.");
    expect(repaired).toContain("A required topic or section never requires a factual answer");
    expect(repaired).toContain("Canonical product authority is navigation and product-identity authority only");
    expect(repaired).toContain("Does the selected supplier confirm");
    expect(repaired).toContain("Omit Trends, Adoption, Growth");
    expect(repaired).toContain("Keep every heading in its own semantic HTML heading element");
  });

  test.each([
    "Indiana’s climate, weather fluctuation, and seasonal daylight all impact operational requirements.",
    "Review regional weather concerns such as wind and temperature swings.",
    "The system requires sensors, input devices, or networking support.",
    "The ability to program dynamic content enables interactive art.",
    "Interactive experiences are influencing Indiana planners.",
    "Determine an interactive audience engagement strategy.",
    "Interactive display trends in Indiana are growing in popularity.",
  ])("prevents the historical unsupported span: %s", (claimText) => {
    expect(evaluate(`<p>${claimText}</p>`).ok).toBe(false);
  });

  test("keeps headings separate from a conceptual sentence", () => {
    const result = evaluate("<h2>Interactivity Concepts</h2><p>What interactive concept could the project team explore?</p>");
    expect(result.ok).toBe(true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ claimText: "What interactive concept could the project team explore?", authorityStatus: "APPROVED_CONCEPTUAL" });
  });

  test("does not let buyer-question form smuggle unsupported factual premises", () => {
    const neutral = evaluate("<p>What environmental conditions should the project team ask qualified professionals to evaluate?</p>");
    expect(neutral.ok).toBe(true);
    const embedded = evaluate("<p>What climate conditions could affect the project (humidity, wind, snow, heat)?</p>");
    expect(embedded.ok).toBe(false);
    expect(embedded.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ claimClass: "CLIMATE", authorityStatus: "UNSUPPORTED" }),
    ]));
  });

  test("audits factual comparison-table cells independently", () => {
    const result = evaluate("<table><tr><th>Attribute</th><th>Outdoor Digital Sphere</th></tr><tr><td>Form Factor</td><td>360° sphere, panoramic surface</td></tr><tr><td>Installation</td><td>Custom site adaptation, curved mounting</td></tr></table>");
    expect(result.ok).toBe(false);
    expect(result.findings.filter((finding) => finding.claimClass === "PRODUCT_SPECIFICATION")).toEqual(expect.arrayContaining([
      expect.objectContaining({ claimText: "360° sphere, panoramic surface", authorityStatus: "UNSUPPORTED" }),
      expect.objectContaining({ claimText: "Custom site adaptation, curved mounting", authorityStatus: "UNSUPPORTED" }),
    ]));
  });

  test("distinguishes regulatory enumerations from product interactivity", () => {
    const regulatory = evaluate("<p>Project teams should review zoning codes for illuminated, interactive, or freestanding installations.</p>");
    expect(regulatory.findings.filter((finding) => finding.claimClass === "INTERACTIVITY")).toEqual([]);

    const capability = evaluate("<p>The selected system supports interactive content and must comply with local codes.</p>");
    expect(capability.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ claimClass: "INTERACTIVITY", authorityStatus: "UNSUPPORTED" }),
    ]));
  });

  test("deduplicates protected cells represented by a structural comparison aggregate", () => {
    const result = evaluate("<table><tr><th>Feature</th><th>Spherical Display</th><th>Traditional Flat Display</th></tr><tr><td>Visibility</td><td>Omnidirectional, visible from all sides</td><td>Front-facing</td></tr><tr><td>Content Creation</td><td>Custom, panoramic or curved</td><td>Standard video</td></tr></table>");
    const specifications = result.findings.filter((finding) => finding.claimClass === "PRODUCT_SPECIFICATION");
    expect(specifications).toHaveLength(1);
    expect(specifications[0].claimText).toContain("Custom, panoramic or curved");
  });

  test("preserves independent protected cells in a non-comparison table", () => {
    const result = evaluate("<table><tr><th>Requirement</th><th>Question</th></tr><tr><td>Brightness</td><td>High-brightness output</td></tr><tr><td>Ingress</td><td>IP65 ingress protection</td></tr><tr><td>Owner</td><td>Project team</td></tr></table>");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ claimClass: "BRIGHTNESS", claimText: "High-brightness output" }),
      expect.objectContaining({ claimClass: "INGRESS_PROTECTION", claimText: "IP65 ingress protection" }),
    ]));
  });

  test("campaign UI exposes persisted claim evidence and recovery guidance", () => {
    const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8").replace(/\s/g, "");
    for (const marker of ["UnsupportedClaimEvidence", "Failedpredicate:", "Currentpredicate:", "Reason:", "Requiredauthority:", "Disposition:"])
      expect(ui).toContain(marker);
  });
});

const forensicRoot = process.env.GLW_FORENSIC_PERSISTENCE_DIR;
(forensicRoot ? test : test.skip)("preserved execution 642569 artifact remains unchanged and blocked under V1.1", () => {
  const repositoryPath = join(forensicRoot!, "glw-page-execution-repository.json");
  const envelope = JSON.parse(readFileSync(repositoryPath, "utf8")) as { data: { records: Array<{ jobId: string; generatedDraft: { contentHtml: string } }> } };
  const job = envelope.data.records.find((record) => record.jobId === "74264a0e-9055-45b1-90ee-dd101ef5dcec");
  expect(job).toBeDefined();
  expect(createHash("sha256").update(job!.generatedDraft.contentHtml).digest("hex")).toBe("86f2a89dd3fb757320c5e04cc4f3522fbf28324a9a7a59820d03f829cfe28cf0");
  const result = evaluateGlwReferenceClaimAuthority({
    artifact: job!.generatedDraft as never,
    authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] },
  });
  expect(result.policyVersion).toBe(GLW_REFERENCE_QA_POLICY_VERSION);
  expect(result.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED").length).toBeGreaterThanOrEqual(8);
  expect(result.ok).toBe(false);
});
