jest.mock("server-only", () => ({}));

import { resolveSharedRichPageProductionProfile } from "@/modules/foundation/shared-rich-page-production-authority";
import type { SitePageMediaAssignment, SitePageMediaRole } from "@/modules/foundation/site-page-media-assignment";
import { runTargetRichReferenceProductionOperation } from "../target-rich-reference-production-operation";

const referenceArtifactHtml = `<main class="saw-page" data-composition-contract="GLW_RICH_REFERENCE_COMPOSITION_V1"><section data-reference-section="HERO"><img data-media-role="PRODUCT_AUTHORITY" src="hero"><h1>Outdoor Digital Sphere in Indiana</h1><p>Plan an Indiana project around the setting, audience, content, and timeline.</p><a href="/contact-us/">Request Project Information</a></section><section data-reference-section="PRODUCT_IDENTITY"><img data-media-role="CONTEXTUAL_IN_USE" src="support"><h2>A bold centerpiece for shared experiences</h2><p>Start with the setting, audience, content, and timing.</p><a href="/outdoor-digital-sphere/">Outdoor Digital Sphere</a></section><section data-reference-section="APPLICATIONS"><h2>Applications</h2><p>Explore ideas that connect the sphere to a clear purpose.</p></section><section data-reference-section="PLANNING_GUIDANCE"><h2>Planning your project</h2><p>What location, audience, content goals, and schedule should the project team document?</p></section><section data-reference-section="CTA"><h2>Discuss an Outdoor Digital Sphere project in Indiana</h2><p>Contact us to request project information.</p></section></main>`;
const semanticArtifact = { title: "Outdoor Digital Sphere in Alaska", contentHtml: "<h1>Outdoor Digital Sphere in Alaska</h1><p>Plan the proposed project around the intended audience, location, content, and schedule.</p>", slug: "/outdoor-digital-sphere/alaska/", excerpt: "Plan an Outdoor Digital Sphere project in Alaska.", seoTitle: "Outdoor Digital Sphere in Alaska | Project Planning", metaDescription: "Plan an Outdoor Digital Sphere project in Alaska.", focusKeyphrase: "outdoor digital sphere Alaska" };

function assignment(role: SitePageMediaRole, id: string, wordpressMediaId: number): SitePageMediaAssignment {
  return { assignmentId: `assignment-${role}`, organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", buildSessionId: "session", pageId: "page", pageRevisionId: "revision", slotId: role.toLowerCase(), role, asset: { type: "APPROVED_EXISTING", authorityReference: `product-media:${id}`, productId: "prod-outdoor-digital-sphere", wordpressMediaId, url: `data:image/jpeg;base64,${id}`, sha256: "a".repeat(64) }, metadata: { altText: "Outdoor Digital Sphere", caption: null, title: id, description: "Approved product media" }, approval: { candidateId: id, approvedBy: "owner", approvedAt: "2026-09-15T00:00:00.000Z" }, wordpressReceipt: null, createdAt: "2026-09-15T00:00:00.000Z" };
}

const profile = resolveSharedRichPageProductionProfile({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", productId: "prod-outdoor-digital-sphere", pageType: "LOCATION_SERVICE" })!;

test("runs one rich draft operation in governed order and stops at owner review", async () => {
  const calls: string[] = [];
  let persistedHtml = "";
  const result = await runTargetRichReferenceProductionOperation({
    target: { targetId: "target-outdoor-ak", stateCode: "AK", stateName: "Alaska", canonicalPath: "/outdoor-digital-sphere/alaska/", wordpressObjectId: null, wordpressParentId: "20114" },
    product: { productId: "prod-outdoor-digital-sphere", productName: "Outdoor Digital Sphere", canonicalPath: "/outdoor-digital-sphere/" },
    semanticArtifact,
    referenceArtifactHtml,
    mediaAssignments: [assignment("PRODUCT_AUTHORITY", "hero", 41), assignment("CONTEXTUAL_IN_USE", "support", 42), assignment("APPLICATION_EXPERIENCE", "application", 43)],
    profile,
    actor: "operator-001",
    dependencies: {
      writeDraft: jest.fn(async ({ artifact }) => { calls.push("write"); persistedHtml = artifact.contentHtml; expect(persistedHtml).not.toBe(semanticArtifact.contentHtml); expect(persistedHtml).toContain('data-composition-role="hero"'); return { ok: true, operation: "CREATE", wordpressObjectId: "301", wordpressUrl: "https://example.test/?page_id=301", wordpressStatus: "draft", seoMetadataAttempted: true, seoMetadataAccepted: true }; }),
      suppressNativeTitle: jest.fn(async () => { calls.push("title"); }),
      readStoredDraft: jest.fn(async () => { calls.push("readback"); return { wordpressObjectId: "301", wordpressUrl: "https://example.test/?page_id=301", status: "draft", slug: "alaska", parentId: 20114, title: "Outdoor Digital Sphere in Alaska", contentHtml: persistedHtml, featuredMediaId: 0, nativeTitleSuppressed: true }; }),
      certifyActualHost: jest.fn(async ({ contentSha }) => { calls.push("capture"); return { certificationId: "certification-301", overallState: "PASS", contentHash: contentSha, wordpressObjectId: "301" }; }),
    },
  });

  expect(calls).toEqual(["write", "title", "readback", "capture"]);
  expect(result.ownerReview.ready).toBe(true);
    expect(result).toMatchObject({ targetId: "target-outdoor-ak", ownerDecision: "PENDING", wordpressMutation: true, publicationMutation: false, generationAttempted: false, n8nExecutionCreated: false, imageGenerationAttempted: false, certification: { brand: { contract: "LED_DISPLAY_WAREHOUSE_PRESENTATION_V1", LEDDisplayWarehouseBrandDistinctiveness: "PASS", CommercialStainlessPresentationLeakage: false } } });
});
