jest.mock("server-only", () => ({}));

import type { SitePageMediaAssignment } from "@/modules/foundation/site-page-media-assignment";
import { contextualPresentationMutationScope, runContextualMediaProductionAdapter, validateContextualVisualPlan, type ContextualMediaAdapterDependencies, type ContextualVisualPlanItem } from "../contextual-media-production-adapter";

const identity = { organizationId: "org", siteId: "site", campaignId: "campaign", targetId: "target", productId: "product", wordpressObjectId: "10", pageRevisionId: "revision" };
const productAuthority = { role: "PRODUCT_AUTHORITY", asset: { type: "APPROVED_EXISTING", productId: "product" } } as SitePageMediaAssignment;
const plan: ContextualVisualPlanItem[] = [
  { role: "HERO_EXPERIENCE", mediaRole: "LOCAL_CONTEXTUAL_ATMOSPHERE", slot: "HERO_EXPERIENCE", prompt: "Conceptual coastal promenade sphere experience, not an actual installation.", altText: "Conceptual sphere experience at a coastal promenade" },
  { role: "PUBLIC_DESTINATION_APPLICATION", mediaRole: "CONTEXTUAL_IN_USE", slot: "POST_HERO_CONTEXTUAL", prompt: "Conceptual sphere in a generic upscale public plaza.", altText: "Conceptual sphere in a public plaza" },
  { role: "EVENT_EXPERIENCE", mediaRole: "APPLICATION_EXPERIENCE", slot: "APPLICATION_STAGE", prompt: "Conceptual outdoor sphere as an event centerpiece.", altText: "Conceptual sphere event experience" },
  { role: "CAMPUS_CIVIC_BRAND_EXPERIENCE", mediaRole: "APPLICATION_EXPERIENCE", slot: "CTA_ATMOSPHERE", prompt: "Conceptual sphere in a generic campus civic setting.", altText: "Conceptual sphere in a campus setting" },
];

function dependencies(overrides: Partial<ContextualMediaAdapterDependencies> = {}): ContextualMediaAdapterDependencies {
  return { findSuccessfulGeneration: jest.fn(() => null), generate: jest.fn(async () => ({ bytes: Buffer.from("image"), mimeType: "image/jpeg", provider: "OPENAI_IMAGE", model: "gpt-image-2", width: 1536, height: 1024 })), persistGeneration: jest.fn(({ receipt: value, bytes }) => ({ receipt: value, bytes, wordpressMediaId: null, wordpressUrl: null })), persistAssignment: jest.fn(() => ({}) as SitePageMediaAssignment), uploadMedia: jest.fn(async () => ({ mediaId: 101, url: "https://example.test/image.jpg" })), patchPresentation: jest.fn(async () => ({ storedSha256: "b".repeat(64) })), certify: jest.fn(async () => ({ certificationId: "cert", state: "PASS" })), ...overrides, };
}

describe("generalized contextual media production adapter", () => {
  test("validates a bounded four-role plan with distinct semantic slots", () => {
    expect(validateContextualVisualPlan(plan)).toHaveLength(4);
    const scope = contextualPresentationMutationScope(plan);
    expect(scope[0]).toMatchObject({ slot: "HERO_EXPERIENCE", selector: "[data-reference-section=HERO] > img" });
    expect(scope[1]).toMatchObject({ slot: "POST_HERO_CONTEXTUAL", selector: "[data-reference-section=PRODUCT_IDENTITY] img" });
    expect(scope[0].selector).not.toBe(scope[1].selector);
    expect(scope.every((item) => item.allowedPaths.every((path) => ["contentHtml:media-reference", "mediaAssignment", "wordpressMedia"].includes(path)))).toBe(true);
  });

  test("rejects generated product authority replacement", () => {
    expect(() => validateContextualVisualPlan([{ ...plan[0], mediaRole: "PRODUCT_AUTHORITY" as never }])).toThrow("GENERATED_PRODUCT_AUTHORITY_MEDIA_FORBIDDEN");
  });

  test("allows explicit negated non-documentary wording but blocks positive installation claims", () => {
    expect(() => validateContextualVisualPlan([
      {
        role: "CONTEXTUAL_IN_USE",
        mediaRole: "CONTEXTUAL_IN_USE",
        slot: "POST_HERO_CONTEXTUAL",
        prompt: "Do not imply this is a real completed customer installation; treat as conceptual contextual visualization only.",
        altText: "Conceptual contextual visualization in Florida; not a real customer installation.",
      },
    ])).not.toThrow();

    expect(() => validateContextualVisualPlan([
      {
        role: "CONTEXTUAL_IN_USE",
        mediaRole: "CONTEXTUAL_IN_USE",
        slot: "POST_HERO_CONTEXTUAL",
        prompt: "Photorealistic completed customer installation at a real client project site.",
        altText: "Completed customer installation in production.",
      },
    ])).toThrow("GENERATED_CONTEXTUAL_MEDIA_FALSE_EVIDENCE_CLAIM");
  });

  test("dry-run resolves all gates without invoking side effects", async () => {
    const deps = dependencies();
    const result = await runContextualMediaProductionAdapter({ mode: "DRY_RUN", identity, visualPlan: plan, productAuthority, providerReady: true, actor: "owner", dependencies: deps });
    expect(result).toMatchObject({ state: "DRY_RUN_READY", productAuthorityProtected: true, certificationDownstreamOfMutation: true, accounting: { imageGenerationRequests: 0, imageGenerationOutputs: 0, wordpressUploads: 0, wordpressMutations: 0, certificationRuns: 0, publications: 0, n8nExecutions: 0, contentGenerationJobs: 0, contentGenerationAttempts: 0, contentModelCalls: 0, nextStateDispatches: 0 } });
    for (const dependency of Object.values(deps)) expect(dependency).not.toHaveBeenCalled();
  });

  test("maps complete provenance, uses UNKNOWN cost, and certifies after mutation", async () => {
    const order: string[] = [];
    const deps = dependencies({ persistGeneration: jest.fn(({ receipt, bytes }) => { order.push("persist"); expect(receipt).toMatchObject({ authority: "GENESIS_GENERATED_CONTEXTUAL_MEDIA_V1", organizationId: "org", siteId: "site", campaignId: "campaign", targetId: "target", productId: "product", provider: "OPENAI_IMAGE", model: "gpt-image-2", outputDimensions: { width: 1536, height: 1024 }, generationCount: 1, selectedOutputCount: 1, reportedCost: "UNKNOWN", documentaryEvidence: false, actualInstallationEvidence: false, productSpecificationAuthority: false, customerEvidence: false, status: "SUCCEEDED" }); expect(receipt.generationId).toMatch(/^contextual-generation-[a-f0-9]{64}$/); expect(receipt.promptFingerprint).toMatch(/^[a-f0-9]{64}$/); expect(receipt.assetSha256).toMatch(/^[a-f0-9]{64}$/); return { receipt, bytes, wordpressMediaId: null, wordpressUrl: null }; }), persistAssignment: jest.fn(() => { order.push("assign"); return {} as SitePageMediaAssignment; }), uploadMedia: jest.fn(async () => { order.push("upload"); return { mediaId: 101, url: "https://example.test/image.jpg" }; }), patchPresentation: jest.fn(async () => { order.push("patch"); return { storedSha256: "b".repeat(64) }; }), certify: jest.fn(async () => { order.push("certify"); return { certificationId: "cert", state: "PASS" }; }) });
    const result = await runContextualMediaProductionAdapter({ mode: "EXECUTE", identity, visualPlan: [plan[0]], productAuthority, providerReady: true, actor: "owner", dependencies: deps });
    expect(result.accounting).toMatchObject({ imageGenerationRequests: 1, imageGenerationOutputs: 1, wordpressUploads: 1, wordpressMutations: 1, certificationRuns: 1 });
    expect(order).toEqual(["persist", "assign", "upload", "patch", "certify"]);
  });

  test("reuses a matching successful asset without another provider call", async () => {
    const existing = { receipt: { assetSha256: "a".repeat(64) }, bytes: Buffer.from("existing"), wordpressMediaId: 20142, wordpressUrl: "https://example.test/existing.jpg" } as never;
    const deps = dependencies({ findSuccessfulGeneration: jest.fn(() => existing), uploadMedia: jest.fn(async () => ({ mediaId: 20142, url: "https://example.test/existing.jpg", reused: true })) });
    const result = await runContextualMediaProductionAdapter({ mode: "EXECUTE", identity, visualPlan: [plan[0]], productAuthority, providerReady: true, actor: "owner", dependencies: deps });
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.persistGeneration).not.toHaveBeenCalled();
    expect(result.accounting.imageGenerationRequests).toBe(0);
    expect(result.accounting.wordpressUploads).toBe(0);
  });

  test("provider generation failure cannot become media success", async () => {
    const deps = dependencies({ generate: jest.fn(async () => { throw new Error("CONTEXTUAL_MEDIA_GENERATION_FAILED:generation_failed"); }) });
    await expect(runContextualMediaProductionAdapter({ mode: "EXECUTE", identity, visualPlan: [plan[0]], productAuthority, providerReady: true, actor: "owner", dependencies: deps })).rejects.toThrow("CONTEXTUAL_MEDIA_GENERATION_FAILED:generation_failed");
    expect(deps.persistGeneration).not.toHaveBeenCalled();
    expect(deps.persistAssignment).not.toHaveBeenCalled();
    expect(deps.uploadMedia).not.toHaveBeenCalled();
  });

  test("invalid visual evidence claims fail before any provider invocation", async () => {
    const deps = dependencies();
    const invalid = [{
      role: "CONTEXTUAL_IN_USE",
      mediaRole: "CONTEXTUAL_IN_USE" as const,
      slot: "POST_HERO_CONTEXTUAL" as const,
      prompt: "Completed customer installation used as authority.",
      altText: "Completed customer installation.",
    }];
    await expect(runContextualMediaProductionAdapter({ mode: "EXECUTE", identity, visualPlan: invalid, productAuthority, providerReady: true, actor: "owner", dependencies: deps })).rejects.toThrow("GENERATED_CONTEXTUAL_MEDIA_FALSE_EVIDENCE_CLAIM");
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.persistGeneration).not.toHaveBeenCalled();
    expect(deps.uploadMedia).not.toHaveBeenCalled();
  });
});