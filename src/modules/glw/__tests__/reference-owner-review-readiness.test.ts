import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateGlwReferenceOwnerReviewReadiness, GLW_REQUIRED_REFERENCE_COMPOSITION } from "../reference-owner-review-readiness";

function artifact(contentHtml: string) {
  return { title: "Outdoor Digital Sphere in Indiana", contentHtml, slug: "outdoor-digital-sphere/indiana", excerpt: null, seoTitle: "Outdoor Digital Sphere Indiana", metaDescription: "Planning guide", focusKeyphrase: "outdoor digital sphere indiana" };
}
const noMedia = { productAuthorityMediaAvailable: false, productAuthorityMediaCount: 0, contextualMediaCount: 0, applicationMediaCount: 0, localContextualMediaCount: 0, featuredMediaId: null };
const target = { productName: "Outdoor Digital Sphere", productCanonicalPath: "/outdoor-digital-sphere/", stateName: "Indiana" };

describe("GLW reference owner-review readiness", () => {
  test("buyer question form does not authorize embedded factual premises", () => {
    const result = evaluateGlwReferenceOwnerReviewReadiness({ artifact: artifact("<h1>Outdoor Digital Sphere in Indiana</h1><p>Indiana planning.</p><p>What climate conditions matter (humidity, wind, snow, heat)?</p><a href=\"/outdoor-digital-sphere/\">Outdoor Digital Sphere</a>"), target, media: noMedia, actualHostVisualCertified: false });
    expect(result.semantic.buyerQuestionPremiseEscapes).toBe(1);
    expect(result.semantic.ok).toBe(false);
    expect(result.composition.CLAIM_AUTHORITY).toBe(false);
  });

  test("comparison-table cells require authority", () => {
    const result = evaluateGlwReferenceOwnerReviewReadiness({ artifact: artifact("<h1>Outdoor Digital Sphere in Indiana</h1><p>Indiana planning.</p><a href=\"/outdoor-digital-sphere/\">Outdoor Digital Sphere</a><table><tr><td>Form</td><td>360° sphere, panoramic surface</td></tr><tr><td>Installation</td><td>Custom site adaptation, curved mounting</td></tr></table>"), target, media: noMedia, actualHostVisualCertified: false });
    expect(result.semantic.comparisonFactEscapes).toBeGreaterThanOrEqual(2);
    expect(result.composition.AUTHORIZED_COMPARISON_OR_EVALUATION).toBe(false);
  });

  test("detects mechanical canonicalization prose", () => {
    const result = evaluateGlwReferenceOwnerReviewReadiness({ artifact: artifact("<h1>Outdoor Digital Sphere in Indiana</h1><p>Indiana planning.</p><p>One possible concept a project team could consider is an interactive experience concept.</p><a href=\"/outdoor-digital-sphere/\">Outdoor Digital Sphere</a>"), target, media: noMedia, actualHostVisualCertified: false });
    expect(result.copyQuality.ok).toBe(false);
    expect(result.copyQuality.failures.map((failure) => failure.code)).toEqual(expect.arrayContaining(["REPEATED_CONCEPT_TAUTOLOGY", "MECHANICAL_CANONICALIZATION_PHRASE"]));
  });

  test("requires the complete production composition contract", () => {
    const result = evaluateGlwReferenceOwnerReviewReadiness({ artifact: artifact("<h1>Outdoor Digital Sphere in Indiana</h1><p>Indiana planning.</p><a href=\"/outdoor-digital-sphere/\">Outdoor Digital Sphere</a>"), target, media: noMedia, actualHostVisualCertified: false });
    expect(Object.keys(result.composition).sort()).toEqual([...GLW_REQUIRED_REFERENCE_COMPOSITION].sort());
    expect(result).toMatchObject({ ready: false, pageClassification: "LONG_FORM_ARTICLE", composition: { PRODUCT_AUTHORITY_MEDIA: false, VISUAL_HERO: false, VISUAL_APPLICATION_SECTION: false, RESPONSIVE_COMPOSITION: false, MEDIA_PROVENANCE: false, ACTUAL_HOST_VISUAL_CERTIFICATION: false } });
  });

  test("evaluates product and localization identity from target data", () => {
    const alaska = { productName: "Outdoor Digital Sphere", productCanonicalPath: "/outdoor-digital-sphere/", stateName: "Alaska" };
    const result = evaluateGlwReferenceOwnerReviewReadiness({ artifact: { ...artifact("<h1>Outdoor Digital Sphere in Alaska</h1><p>Alaska project planning.</p><a href=\"/outdoor-digital-sphere/\">Outdoor Digital Sphere</a>"), title: "Outdoor Digital Sphere in Alaska" }, target: alaska, media: noMedia, actualHostVisualCertified: false });
    expect(result.composition).toMatchObject({ PRODUCT_IDENTITY: true, LOCALIZED_INTRODUCTION: true });
  });

  test("blocks reference approval and surfaces owner remediation without hiding the draft", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-page/route.ts"), "utf8");
    const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8");
    expect(route).toContain("REFERENCE_OWNER_REVIEW_REMEDIATION_REQUIRED");
    expect(route).toContain("ownerReviewReadiness(job");
    expect(route).toContain("resolveGlwRichReferenceReadiness({ campaign, job");
    expect(route).toContain("!richCompositionReadiness?.ready");
    expect(ui).toContain("Owner Review Remediation Required");
    expect(ui).toContain("ownerReviewReadiness?.ready && richCompositionReadiness?.ready && jobId");
    expect(ui).toContain("Edit WordPress Draft");
  });

  test("campaign and media panel share canonical state-aware media readiness", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-page/route.ts"), "utf8").replace(/\s/g, "");
    const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8").replace(/\s/g, "");
    const panel = readFileSync(join(process.cwd(), "src/modules/glw/OutdoorSphereMediaAuthorityPanel.tsx"), "utf8").replace(/\s/g, "");
    expect(route).toContain("evaluateProductMediaReadiness(records,{stateCode})");
    expect(route).toContain("campaignProductMediaReadiness(campaign,target.state.code)");
    expect(route).toContain("ownerReviewReadiness(job,mediaReadiness)");
    expect(route).toContain("resolveTargetParameterizedRichReferenceProduction");
    expect(route).toContain("targetParameterizedOrchestration");
    expect(route).not.toContain("productAuthorityMediaCount:0");
    expect(ui).toContain("productMediaReadiness?.state");
    expect(ui).toContain("onAuthorityChanged={()=>recoverReferencePage(false)}");
    expect(panel).toContain("stateCode=${encodeURIComponent(props.targetStateCode)}");
    expect(panel).toContain("awaitprops.onAuthorityChanged?.()");
  });
});

const forensicRoot = process.env.GLW_FORENSIC_PERSISTENCE_DIR;
(forensicRoot ? test : test.skip)("owner-rejected object 20115 remains immutable and fails semantic/composition readiness", () => {
  const envelope = JSON.parse(readFileSync(join(forensicRoot!, "glw-page-execution-repository.json"), "utf8")) as { data: { records: Array<{ jobId: string; generatedDraft: ReturnType<typeof artifact>; wordpressObjectId: string | null }> } };
  const job = envelope.data.records.find((record) => record.jobId === "dbb8574d-c8d5-43c0-aba1-4d445589b4f2");
  expect(job?.wordpressObjectId).toBe("20115");
  expect(createHash("sha256").update(job!.generatedDraft.contentHtml).digest("hex")).toBe("3bdb717488a0caa8773337c8b0e6d5fde25a0e2301dcef9e3c19b169b35cd06d");
  const result = evaluateGlwReferenceOwnerReviewReadiness({ artifact: job!.generatedDraft, target, media: noMedia, actualHostVisualCertified: false });
  expect(result.ready).toBe(false);
  expect(result.pageClassification).toBe("LONG_FORM_ARTICLE");
  expect(result.semantic.unsupportedFactualClaims).toBeGreaterThan(0);
  expect(result.semantic.buyerQuestionPremiseEscapes).toBeGreaterThan(0);
  expect(result.semantic.comparisonFactEscapes).toBeGreaterThan(0);
  expect(result.copyQuality.ok).toBe(false);
  expect(result.media.richMediaCount).toBe(0);
});
