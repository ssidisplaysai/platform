jest.mock("server-only", () => ({}));

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "cheerio";
import sharp from "sharp";
import { createIndianaRichReferenceCompositionPlan } from "../indiana-rich-reference-composition-plan";
import { buildIndianaRichReferenceCandidate, candidateMediaDataUrls, getIndianaRichReferenceCandidate, renderIndianaRichReferenceCandidate, renderIndianaRichReferenceWordPressContent } from "../indiana-rich-reference-candidate";
import { evaluateIndianaStoredDraft } from "../indiana-rich-reference-persistence";
import { GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT } from "../reference-generation-claim-contract";
import { intakeProductMedia, issueProductMediaHeroGrant, issueProductMediaHeroPreflight, listProductMediaAuthority, reviewProductMedia, selectProductMediaHero } from "../product-media-authority";

const scope = { organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", productId: "prod-outdoor-digital-sphere" } as const;

describe("Indiana rich reference composition plan", () => {
  const originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let root: string;
  let image: Buffer;
  beforeAll(async () => { image = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#22586a" } }).jpeg().toBuffer(); });
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "indiana-rich-plan-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot; rmSync(root, { recursive: true, force: true }); });

  async function approve(filename: string, provenance: string) {
    const pending = await intakeProductMedia({ ...scope, originalFilename: filename, mimeType: "image/jpeg", bytes: Buffer.concat([image, Buffer.from(filename)]), sourceType: "OWNER_SUPPLIED", sourceDescription: provenance, provenance, authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"], depictsActualProduct: true, heroEligible: false, altTextAuthority: "Outdoor Digital Sphere", captionAuthority: "Owner-approved product image.", now: new Date("2030-01-01") });
    return reviewProductMedia({ ...scope, mediaAuthorityId: pending.mediaAuthorityId, decision: "APPROVE", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"], depictsActualProduct: true, heroEligible: false, altTextAuthority: "Outdoor Digital Sphere", captionAuthority: "Owner-approved product image.", authorityAndScopesConfirmed: true, localAtmosphereConfirmed: false, principalId: "owner", sessionId: "session", now: new Date("2030-01-02") });
  }

  test("builds a deterministic, authority-safe plan without rendering or WordPress authority", async () => {
    const chicago = await approve("shared image (73).jpg", "chicago");
    const texas = await approve("shared image (72).jpg", "Texas");
    const context = { ...scope, mediaAuthorityId: texas.mediaAuthorityId, hash: texas.hash, exactRuntime: "a".repeat(40), principalId: "owner", principalSessionId: "session", replacementConfirmed: false };
    const receipt = issueProductMediaHeroPreflight({ ...context, now: new Date("2030-01-03T00:00:00Z") });
    const grant = issueProductMediaHeroGrant({ ...context, preflightReceiptId: receipt.receiptId, now: new Date("2030-01-03T00:00:01Z") });
    selectProductMediaHero({ ...context, preflightReceiptId: receipt.receiptId, grantId: grant.grantId, now: new Date("2030-01-03T00:00:02Z") });
    const semanticSource = { jobId: "dbb8574d-c8d5-43c0-aba1-4d445589b4f2", artifactSha256: "3bdb717488a0caa8773337c8b0e6d5fde25a0e2301dcef9e3c19b169b35cd06d" };
    const first = createIndianaRichReferenceCompositionPlan({ records: listProductMediaAuthority(scope), semanticSource });
    const second = createIndianaRichReferenceCompositionPlan({ records: listProductMediaAuthority(scope), semanticSource });

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(first.media).toMatchObject({ hero: { mediaAuthorityId: texas.mediaAuthorityId, provenance: "Texas" }, supporting: { mediaAuthorityId: chicago.mediaAuthorityId, provenance: "chicago" }, application: { mediaAuthorityId: chicago.mediaAuthorityId, provenance: "chicago" }, localAtmosphereRequired: false, localAtmosphereAssigned: false });
    expect(first.semanticSource).toMatchObject({ presentationAuthority: false, longFormArticleReused: false });
    expect(first.wordCount).toBeGreaterThanOrEqual(900);
    expect(first.wordCount).toBeLessThanOrEqual(1400);
    expect(Object.values(first.sectionReadiness).every(Boolean)).toBe(true);
    expect(first.assignmentReadiness).toEqual({ hero: true, supporting: true, application: true });
    expect(first.semanticGate).toEqual({ unsupportedFactualClaims: 0, protectedFactsWithoutAuthorityMapping: 0, sourceToClaimMappingFailures: 0, genericProductKnowledgeViolations: 0, unsupportedTrendClaims: 0, unsupportedProductCapabilityClaims: 0, unsupportedClimateOrLocationFacts: 0, unexpectedStateContamination: 0, buyerQuestionPremiseRule: "PASS", comparisonAuthorityRule: "PASS", canonicalizationCopyQualityRule: "PASS" });
    expect(first.readiness.blockers).toEqual(expect.arrayContaining(["RENDERED_VISUAL_CERTIFICATION_REQUIRED"]));
    expect(first.readiness.blockers).not.toEqual(expect.arrayContaining(["APPROVED_PRODUCT_AUTHORITY_IMAGE_REQUIRED", "CONTEXTUAL_IN_USE_IMAGE_REQUIRED", "APPLICATION_EXPERIENCE_MEDIA_REQUIRED", "PRODUCT_AUTHORITY_MEDIA_UNVERIFIED", "COMPARISON_AUTHORITY_REQUIRED", "CANONICALIZATION_COPY_QUALITY", "CLAIM_AUTHORITY"]));
    expect(first).toMatchObject({ wordpressMutationAuthorized: false, generationRequired: false });

    const candidate = buildIndianaRichReferenceCandidate({ records: listProductMediaAuthority(scope), semanticSource, expectedPlanFingerprint: first.fingerprint, claimAuthorityFingerprint: GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT, now: new Date("2030-01-04T00:00:00Z") });
    const repeated = buildIndianaRichReferenceCandidate({ records: listProductMediaAuthority(scope), semanticSource, expectedPlanFingerprint: first.fingerprint, claimAuthorityFingerprint: GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT, now: new Date("2030-01-05T00:00:00Z") });
    expect(repeated).toEqual(candidate);
    expect(getIndianaRichReferenceCandidate(candidate.candidateId)).toEqual(candidate);
    expect(candidate).toMatchObject({ compositionPlanFingerprint: first.fingerprint, semanticInputFingerprint: semanticSource.artifactSha256, claimAuthorityFingerprint: GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT, heroMediaId: texas.mediaAuthorityId, supportingMediaId: chicago.mediaAuthorityId, applicationMediaId: chicago.mediaAuthorityId, status: "READY_FOR_VISUAL_CERTIFICATION", wordpressMutationAuthorized: false, generationPerformed: false });
    expect(candidate.candidateSha).toMatch(/^[0-9a-f]{64}$/);
    expect(candidate.artifact.contentHtml).not.toMatch(/https?:\/\/(?:localhost|127\.0\.0\.1)/);
    const rendered = renderIndianaRichReferenceCandidate(candidate, candidateMediaDataUrls(candidate));
    expect(rendered).toContain("data:image/jpeg;base64,");
    expect(rendered).toContain("data-genesis-primary-content");
    expect(rendered.match(/<h1\b/g)).toHaveLength(1);
    const wordpressContent = renderIndianaRichReferenceWordPressContent(candidate);
    expect(wordpressContent.match(/data:image\/jpeg;base64,/g)).toHaveLength(2);
    expect(wordpressContent).not.toContain("data:image/gif;base64,");
    expect(load(wordpressContent, null, false).text()).not.toMatch(/owner-approved|PRODUCT_AUTHORITY|CONTEXTUAL_IN_USE|APPLICATION_EXPERIENCE|approved dataset|unknown fact|claim governance|candidate SHA|fingerprint/i);
    const storedQa = evaluateIndianaStoredDraft({ candidateId: candidate.candidateId, candidateSha: candidate.candidateSha, html: wordpressContent });
    expect(storedQa).toMatchObject({ storedCandidateIdentityVerified: true, h1Count: 1, productAuthorityLinkPresent: true, brokenMediaReferences: 0, internalGovernanceLanguageExposed: 0, devLinks: 0, localhostLinks: 0, previewLinks: 0, unsupportedFactualClaims: 0, protectedFactsWithoutAuthorityMapping: 0, sourceToClaimMappingFailures: 0, genericProductKnowledgeViolations: 0, unsupportedTrendClaims: 0, unsupportedProductCapabilityClaims: 0, unsupportedClimateOrLocationFacts: 0, unexpectedStateContamination: 0, buyerQuestionPremiseRule: "PASS", comparisonAuthorityRule: "PASS", canonicalizationCopyQualityRule: "PASS", longFormArticleAppearance: false, richCommercialComposition: true });
    expect(Object.values(storedQa.sections).every(Boolean)).toBe(true);
    const persisted = readFileSync(join(root, "genesis-indiana-rich-reference-candidate-v1.json"), "utf8");
    expect(persisted).toContain(candidate.candidateId);
    expect(persisted).not.toContain("data:image/jpeg;base64,");
    expect(existsSync(join(root, "glw-page-execution-repository.json"))).toBe(false);
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/rich-reference-candidate/route.ts"), "utf8");
    const snapshot = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/rich-reference-candidate/snapshot/route.ts"), "utf8");
    expect(route).toContain("runGovernedRenderCapture");
    expect(route).toContain("wordpressMutation: false");
    expect(route).toContain("generationAttempted: false");
    expect(route).not.toMatch(/writeGenesisWordPressDraft|executeGlwN8nMcpWorkflow|glwPageExecutionRepository\.create/);
    expect(snapshot).toContain("verifyGovernedSnapshotPath");
  });
});
