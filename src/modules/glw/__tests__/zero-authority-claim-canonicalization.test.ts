import { createHash } from "node:crypto";
import { evaluateGlwReferenceClaimAuthority, type GlwClaimAuthorityFinding, type GlwReferenceClaimClass } from "../reference-claim-authority";
import {
  canonicalizeGlwZeroAuthorityClaims,
  GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_FINGERPRINT,
  GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION,
} from "../zero-authority-claim-canonicalization";
import { evaluateGlwStateLocalizationContamination } from "../state-localization-contamination";
import { evaluateGlwGeneratedContentQa } from "../generated-content-qa";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function artifact(contentHtml: string) {
  return { title: "Test", contentHtml, slug: "outdoor-digital-sphere/indiana", excerpt: null, seoTitle: null, metaDescription: null, focusKeyphrase: null };
}

function finding(claimClass: GlwReferenceClaimClass, claimText: string): GlwClaimAuthorityFinding {
  return { claimClass, claimText, authoritySource: null, authorityStatus: "UNSUPPORTED", authorityKind: "UNSUPPORTED", predicateId: `unsupportedClaim.${claimClass}` };
}

function canonicalize(contentHtml: string, findings: readonly GlwClaimAuthorityFinding[]) {
  return canonicalizeGlwZeroAuthorityClaims({ rawArtifact: artifact(contentHtml), authoritativeFactReferenceIds: [], findings });
}

describe("GLW zero-authority deterministic claim canonicalization", () => {
  test.each([
    ["PRODUCT_CAPABILITY", "The system supports interactive content.", "CONVERT_TO_BUYER_QUESTION"],
    ["INTERACTIVITY", "The sphere provides interactive experiences.", "CONVERT_TO_BUYER_QUESTION"],
    ["CLIMATE", "Indiana climate conditions affect operation.", "CONVERT_TO_BUYER_QUESTION"],
    ["WARRANTY", "The product includes a five-year warranty.", "CONVERT_TO_BUYER_QUESTION"],
    ["PRICING", "The product has a lower operating cost.", "CONVERT_TO_BUYER_QUESTION"],
    ["MARKET_ADOPTION", "Regional adoption and popularity continue to grow.", "REMOVE"],
  ] as const)("canonicalizes unsupported %s", (claimClass, text, disposition) => {
    const result = canonicalize(`<p>${text}</p>`, [finding(claimClass, text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations[0]).toMatchObject({ disposition, safeToTransform: true });
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(text);
  });

  test("converts a labeled interactive application without asserting capability", () => {
    const text = "Entertainment Zones: Interactive experiences at music festivals.";
    const result = canonicalize(`<ul><li>${text}</li></ul>`, [finding("INTERACTIVITY", text)]);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("One possible concept a project team could consider");
    const qa = evaluateGlwReferenceClaimAuthority({ artifact: result.canonicalizedArtifact!, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
    expect(qa.ok).toBe(true);
  });

  test("removes a nonessential unsupported local fact", () => {
    const text = "Indiana is home to a dense calendar of events.";
    const result = canonicalize(`<h2>Why Consider This Format?</h2><p>${text}</p><p>What project goals should the team define?</p>`, [finding("LOCATION_FACT", text)]);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(text);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("What project goals");
  });

  test("leaves already safe conceptual text, mapped facts, and navigation identity unchanged", () => {
    const html = '<h2>Potential Applications</h2><p>One possible concept could be considered for an event.</p><p>Mapped fact.</p><a href="/outdoor-digital-sphere/">Outdoor Digital Sphere</a>';
    const result = canonicalize(html, []);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toBe(html);
    expect(result.receipt.transformations).toEqual([]);
  });

  test("leaves an explicitly supported mapped finding unchanged", () => {
    const html = "<p>The product has a documented five-year warranty.</p>";
    const supported = { ...finding("WARRANTY", "The product has a documented five-year warranty."), authoritySource: "approved-sheet", authorityStatus: "SUPPORTED" as const, authorityKind: "REFERENCE_SUPPORTED" as const };
    const result = canonicalize(html, [supported]);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toBe(html);
    expect(result.receipt.transformations).toEqual([]);
  });

  test("blocks ambiguous text and does not emit a transformed artifact", () => {
    const text = "A complex operating environment creates special requirements.";
    const result = canonicalize(`<p>${text}</p>`, [finding("PERFORMANCE", text)]);
    expect(result.ok).toBe(false);
    expect(result.canonicalizedArtifact).toBeNull();
    expect(result.receipt.transformations[0]).toMatchObject({ disposition: "BLOCK", safeToTransform: false });
  });

  test("blocks a labeled rewrite candidate that would retain unsupported capability meaning", () => {
    const text = "Operations: The system provides remote management.";
    const result = canonicalize(`<p>${text}</p>`, [finding("REMOTE_MANAGEMENT", text)]);
    expect(result.ok).toBe(false);
    expect(result.receipt.blockedClaims).toEqual([text]);
  });

  test("does not conceal cross-state contamination", () => {
    const html = "<h1>Outdoor Digital Sphere in Indiana</h1><p>Our Illinois installations serve local venues.</p>";
    const result = canonicalize(html, []);
    expect(result.canonicalizedArtifact?.contentHtml).toBe(html);
    expect(evaluateGlwStateLocalizationContamination({ contentHtml: result.canonicalizedArtifact!.contentHtml, expectedStateCode: "IN" }).ok).toBe(false);
  });

  test("keeps the raw artifact immutable and emits stable lineage", () => {
    const text = "The system supports interactive content.";
    const raw = artifact(`<p>${text}</p>`);
    const before = structuredClone(raw);
    const first = canonicalizeGlwZeroAuthorityClaims({ rawArtifact: raw, authoritativeFactReferenceIds: [], findings: [finding("PRODUCT_CAPABILITY", text)] });
    const second = canonicalizeGlwZeroAuthorityClaims({ rawArtifact: raw, authoritativeFactReferenceIds: [], findings: [finding("PRODUCT_CAPABILITY", text)] });
    expect(raw).toEqual(before);
    expect(first.rawArtifact).toEqual(before);
    expect(first.receipt).toMatchObject({
      policyVersion: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION,
      policyFingerprint: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_FINGERPRINT,
      rawArtifactSha256: createHash("sha256").update(before.contentHtml).digest("hex"),
      consumesN8nExecution: false,
      modelInvoked: false,
    });
    expect(first.receipt.canonicalizedArtifactSha256).toBe(second.receipt.canonicalizedArtifactSha256);
    expect(first.receipt.receiptId).toBe(second.receipt.receiptId);
  });

  test("runs before hardened QA and WordPress mutation while preserving separate lineage fields", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    const canonicalization = route.indexOf("canonicalizeGlwZeroAuthorityClaims({");
    const rawLineage = route.indexOf("rawGeneratedDraft,", canonicalization);
    const productQa = route.indexOf("productAuthorityFailures");
    const claimQa = route.indexOf("claimAuthority && !claimAuthority.ok");
    const localizationQa = route.indexOf("localizationFailures");
    const wordpressWrite = route.indexOf("writeGenesisWordPressDraft({ operation:");
    expect(canonicalization).toBeGreaterThan(0);
    expect(rawLineage).toBeGreaterThan(canonicalization);
    expect(rawLineage).toBeLessThan(productQa);
    expect(productQa).toBeLessThan(claimQa);
    expect(claimQa).toBeLessThan(localizationQa);
    expect(localizationQa).toBeLessThan(wordpressWrite);
    expect(route).toContain("canonicalizedGeneratedDraft: canonicalization.canonicalizedArtifact");
    expect(route).toContain("canonicalizationReceipt: canonicalization.receipt");
  });
});

const forensicRoot = process.env.GLW_FORENSIC_PERSISTENCE_DIR;
(forensicRoot ? test : test.skip)("canonicalizes preserved execution 644114 to a complete hardened QA pass without changing raw evidence", () => {
  const repositoryPath = join(forensicRoot!, "glw-page-execution-repository.json");
  const envelope = JSON.parse(readFileSync(repositoryPath, "utf8")) as { data: { records: Array<{ jobId: string; generatedDraft: ReturnType<typeof artifact>; qaChecks: { claimAuthority: { findings: GlwClaimAuthorityFinding[] } } }> } };
  const job = envelope.data.records.find((record) => record.jobId === "dbb8574d-c8d5-43c0-aba1-4d445589b4f2");
  expect(job).toBeDefined();
  const rawSha = createHash("sha256").update(job!.generatedDraft.contentHtml).digest("hex");
  const result = canonicalizeGlwZeroAuthorityClaims({ rawArtifact: job!.generatedDraft, authoritativeFactReferenceIds: [], findings: job!.qaChecks.claimAuthority.findings });
  expect(rawSha).toBe("6093ef4bae6f3a0ff1d7c601571f718cc361e6a479d879fe0049ad4b09ac7955");
  expect(createHash("sha256").update(job!.generatedDraft.contentHtml).digest("hex")).toBe(rawSha);
  expect(result).toMatchObject({ ok: true, receipt: { canonicalizedArtifactSha256: "3bdb717488a0caa8773337c8b0e6d5fde25a0e2301dcef9e3c19b169b35cd06d", blockedClaims: [] } });
  const claims = evaluateGlwReferenceClaimAuthority({ artifact: result.canonicalizedArtifact!, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  const qa = evaluateGlwGeneratedContentQa({
    artifact: result.canonicalizedArtifact!,
    request: { pageType: "state_service", stateCode: "IN", stateName: "Indiana", cityName: null, productTopic: "Outdoor Digital Sphere", canonicalPath: "outdoor-digital-sphere/indiana" } as never,
    siteDomain: "LEDDisplayWarehouse.com",
    minimumWordCount: 1500,
    requiredCanonicalProductLink: { url: "/outdoor-digital-sphere/", anchorText: "Outdoor Digital Sphere" },
    authorizedComparisonStateCodes: [],
  });
  expect(claims.ok).toBe(true);
  expect(claims.findings.filter((entry) => entry.authorityStatus === "UNSUPPORTED")).toHaveLength(0);
  expect(qa).toMatchObject({ ok: true, wordCount: 2089, checks: { stateLocalizationContamination: { ok: true }, stateProductAuthorityLink: { ok: true }, canonicalProductReference: { ok: true } } });
});
