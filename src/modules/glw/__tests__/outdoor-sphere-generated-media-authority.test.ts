import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OUTDOOR_SPHERE_CAMPAIGN_ID,
  OUTDOOR_SPHERE_ORGANIZATION_ID,
  OUTDOOR_SPHERE_PRODUCT_ID,
  OUTDOOR_SPHERE_SITE_ID,
  buildOutdoorSphereGeneratedContextualPrompt,
  isOutdoorSphereCampaignScope,
  requiresGeneratedContextualMediaForOutdoorSphere,
} from "../outdoor-sphere-contextual-media-policy";
import { renderOutdoorSphereRichWordPress } from "../outdoor-sphere-rich-wordpress-render";

describe("Outdoor Sphere generated contextual media authority", () => {
  test("strict gating only applies to the bounded campaign/product/site scope", () => {
    expect(
      requiresGeneratedContextualMediaForOutdoorSphere({
        campaignId: OUTDOOR_SPHERE_CAMPAIGN_ID,
        organizationId: OUTDOOR_SPHERE_ORGANIZATION_ID,
        siteId: OUTDOOR_SPHERE_SITE_ID,
        productId: OUTDOOR_SPHERE_PRODUCT_ID,
      }),
    ).toBe(true);

    expect(
      requiresGeneratedContextualMediaForOutdoorSphere({
        campaignId: OUTDOOR_SPHERE_CAMPAIGN_ID,
        organizationId: OUTDOOR_SPHERE_ORGANIZATION_ID,
        siteId: OUTDOOR_SPHERE_SITE_ID,
        productId: "different-product",
      }),
    ).toBe(false);

    expect(
      isOutdoorSphereCampaignScope({
        campaignId: OUTDOOR_SPHERE_CAMPAIGN_ID,
        organizationId: OUTDOOR_SPHERE_ORGANIZATION_ID,
        siteId: OUTDOOR_SPHERE_SITE_ID,
      }),
    ).toBe(true);
  });

  test("prompt enforces conceptual non-documentary context and target location style", () => {
    const prompt = buildOutdoorSphereGeneratedContextualPrompt({
      stateName: "Florida",
      cityName: "Miami",
    });

    expect(prompt).toContain("conceptual contextual visualization only");
    expect(prompt).toContain("Target scene location style: Miami, Florida.");
    expect(prompt).toContain("Minimize visible pixel structure");
  });

  test("continuation route blocks legacy fallback and requires generated contextual receipt", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/glw/page-generation/route.ts"),
      "utf8",
    );

    expect(source).toContain("productAuthority.selectedMedia && !strictGeneratedContextualRequired");
    expect(source).toContain("CONTEXTUAL_MEDIA_GENERATED_IMAGE_REQUIRED");
    expect(source).toContain("CONTEXTUAL_MEDIA_EXACT_TARGET_REQUIRED");
    expect(source).toContain("Generated contextual media receipt is required for Outdoor LED Sphere continuation.");
  });

  test("continuation route binds generated contextual receipt to exact campaign target and page revision", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/glw/page-generation/route.ts"),
      "utf8",
    );

    expect(source).toContain("campaignId: input.request.campaignId");
    expect(source).toContain("targetId: strictTargetId");
    expect(source).toContain("pageRevisionId");
    expect(source).toContain("buildSessionId = `contextual-media:${strictTargetId}`");
  });

  test("review model requires both governed contextual assignment and exact generated receipt for strict scope", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/glw/generated-page-review-read-model.ts"),
      "utf8",
    );

    expect(source).toContain("selectedGeneratedContextualAssignment && selectedGeneratedContextualReceipt");
    expect(source).toContain("receipt.pageRevisionId === pageRevisionIdentity");
    expect(source).toContain("receipt.targetId === input.target.targetId");
    expect(source).toContain("Legacy featured media is not accepted as contextual in-use authority for this campaign.");
  });

  test("capture authority fails closed when strict scope lacks generated contextual state", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/foundation/governed-render-capture-orchestrator.ts"),
      "utf8",
    );

    expect(source).toContain("CONTEXTUAL_MEDIA_RECEIPT_REQUIRED");
    expect(source).toContain("model.images.contextualInUse.state !== \"GENERATED_CONTEXTUAL\"");
    expect(source).toContain("assignmentId: model.images.contextualInUse.assignmentId");
  });

  test("strict flow preserves product-truth reference and does not consume dispatch/publication allowances", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/glw/page-generation/route.ts"),
      "utf8",
    );

    expect(source).toContain("role: \"PRODUCT_TRUTH\"");
    expect(source).toContain("publicationPerformed: false");
    expect(source).not.toContain("dispatch allowance consumed");
  });

  test("renderer produces one H1 and required hero/product authority structure", () => {
    const rendered = renderOutdoorSphereRichWordPress({
      title: "Outdoor Digital Sphere in Georgia",
      stateName: "Georgia",
      productTopic: "Outdoor Digital Sphere",
      semanticSourceHtml: "<article><h1>Bad Duplicate Heading</h1><p>Retained guide paragraph.</p><img src=\"https://x.test/i.jpg\" alt=\"x\"/><script>alert(1)</script><a href=\"javascript:alert(1)\">Unsafe</a></article>",
      excerpt: "Concept-focused planning guidance for outdoor sphere applications.",
      contextualMediaUrl: "https://leddisplaywarehouse.com/wp-content/uploads/contextual-ga.jpg",
      productAuthorityMediaUrl: "https://leddisplaywarehouse.com/wp-content/uploads/product-authority.jpg",
      productAuthorityAltText: "Approved outdoor digital sphere product authority",
      canonicalProductUrl: "https://leddisplaywarehouse.com/outdoor-digital-sphere/",
      governedCtaUrl: "/outdoor-digital-sphere/",
    });

    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;

    const h1Count = (rendered.html.match(/<h1\b/gi) ?? []).length;
    expect(h1Count).toBe(1);
    expect(rendered.html).toContain("data-genesis-primary-content");
    expect(rendered.html).toContain("data-genesis-hero");
    expect(rendered.html).toContain('data-media-role="CONTEXTUAL_IN_USE"');
    expect(rendered.html).toContain('data-media-role="PRODUCT_AUTHORITY"');
    expect(rendered.html).toContain("glw-sphere-hero");
    expect(rendered.html).toContain("glw-sphere-planning");
    expect(rendered.html).toContain("glw-sphere-cta");
    expect(rendered.html).toContain("Retained guide paragraph.");
    expect(rendered.html).not.toContain("Bad Duplicate Heading");
    expect(rendered.html).not.toContain("<img src=\"https://x.test/i.jpg\"");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("javascript:alert(1)");
  });

  test("renderer fails closed when strict rich inputs are missing", () => {
    const rendered = renderOutdoorSphereRichWordPress({
      title: "Outdoor Digital Sphere in Georgia",
      stateName: "Georgia",
      productTopic: "Outdoor Digital Sphere",
      semanticSourceHtml: "<p>Guide content</p>",
      excerpt: "Guide excerpt",
      contextualMediaUrl: "",
      productAuthorityMediaUrl: "",
      productAuthorityAltText: "",
    });

    expect(rendered.ok).toBe(false);
    if (rendered.ok) return;
    expect(rendered.code).toBe("OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED");
  });

  test("strict continuation writes rich composition to same draft object and preserves final rich/html identity", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/glw/page-generation/route.ts"),
      "utf8",
    );

    expect(source).toContain("const richWrite = await writeGenesisWordPressDraft({");
    expect(source).toContain('operation: "UPDATE"');
    expect(source).toContain("wordpressObjectId: result.wordpressObjectId");
    expect(source).toContain("generatedDraft: finalizedPresentationArtifact");
    expect(source).toContain("publicationPerformed: false");
  });

  test("strict contextual authority revision identity is aligned to one final completedAt timestamp", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/glw/page-generation/route.ts"),
      "utf8",
    );

    expect(source).toContain("const completedAt = new Date().toISOString();");
    expect(source).toContain("const pageRevisionId = `job:${draftJob.jobId}:${completedAt}`;");
    expect(source).toContain("updatedAt: completedAt");
    expect(source).toContain("completedAt,");
  });

  test("strict scope blocks plain article fallback while preserving non-outdoor behavior", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/glw/page-generation/route.ts"),
      "utf8",
    );

    expect(source).toContain("productAuthority.selectedMedia && !strictGeneratedContextualRequired");
    expect(source).toContain("OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED");
    expect(source).toContain("OUTDOOR_SPHERE_RICH_WORDPRESS_WRITE_FAILED");
    expect(source).toContain('status: "CONTENT_READY"');
  });

  test("strict scope resolves approved PRODUCT_AUTHORITY media URL with bounded fallback only", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/glw/page-generation/route.ts"),
      "utf8",
    );

    expect(source).toContain("function resolveStrictProductAuthorityMediaUrl");
    expect(source).toContain("const receiptUrl = parseAbsoluteHttpUrl(input.authority?.wordpressReceipt?.url ?? null);");
    expect(source).toContain("input.authority.asset.type !== \"APPROVED_EXISTING\"");
    expect(source).toContain("typeof mediaId !== \"number\" || !Number.isSafeInteger(mediaId) || mediaId < 1");
    expect(source).toContain("const allowedOrigins = new Set<string>();");
    expect(source).toContain("if (!allowedOrigins.has(assetUrl.origin.toLowerCase())) {");
  });

  test("strict scope validates approved PRODUCT_AUTHORITY before generated contextual image execution", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/glw/page-generation/route.ts"),
      "utf8",
    );

    const resolveStrictUrl = source.indexOf("resolveStrictProductAuthorityMediaUrl({");
    const strictMissingFailClosed = source.indexOf("if (strictGeneratedContextualRequired && !strictApprovedProductAuthorityMediaUrl)");
    const imageGeneration = source.indexOf("const imageResult = await generateGenesisFeaturedImageWithCampaignReferences({");

    expect(resolveStrictUrl).toBeGreaterThan(0);
    expect(strictMissingFailClosed).toBeGreaterThan(resolveStrictUrl);
    expect(imageGeneration).toBeGreaterThan(strictMissingFailClosed);
  });

  test("strict scope forbids generated PRODUCT_AUTHORITY media substitution", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/glw/page-generation/route.ts"),
      "utf8",
    );

    expect(source).toContain("input.authority.asset.type !== \"APPROVED_EXISTING\"");
    expect(source).toContain("Outdoor Sphere rich composition requires approved product authority media with a WordPress URL.");
    expect(source).not.toContain("productAuthorityMediaUrl: mediaResult.mediaUrl");
  });

  test("strict generated contextual repair reconciles WordPress featured media to generated contextual media with exact readback", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/glw/contextual-media-production-service.ts"),
      "utf8",
    );

    expect(source).toContain("requiresGeneratedContextualMediaForOutdoorSphere");
    expect(source).toContain("CONTEXTUAL_MEDIA_EXACT_TARGET_REQUIRED");
    expect(source).toContain('featured_media: input.featuredMediaId');
    expect(source).toContain("CONTEXTUAL_MEDIA_GENERATED_ASSIGNMENT_REQUIRED");
    expect(source).toContain("CONTEXTUAL_MEDIA_GENERATED_RECEIPT_REQUIRED");
    expect(source).toContain("CONTEXTUAL_MEDIA_FEATURED_MEDIA_READBACK_MISMATCH");
    expect(source).toContain("featuredMediaAfter: afterFeatured.featuredMediaId");
  });
});
