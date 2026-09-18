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

    expect(source).toContain("generatedContextualAssignment && generatedContextualReceipt");
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
});
