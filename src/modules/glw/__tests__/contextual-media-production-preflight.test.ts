jest.mock("server-only", () => ({}));

jest.mock("@/modules/foundation/site-repository", () => ({
  getSiteById: jest.fn(),
}));

jest.mock("@/modules/foundation/product-repository", () => ({
  getProductById: jest.fn(),
}));

jest.mock("@/modules/glw/target-parameterized-rich-reference-production", () => ({
  resolveTargetParameterizedRichReferenceProduction: jest.fn(),
}));

jest.mock("@/modules/glw/product-media-authority", () => ({
  listProductMediaAuthority: jest.fn(),
  getProductMediaAuthorityContent: jest.fn(),
}));

jest.mock("@/modules/glw/generated-image-service", () => ({
  resolveGenesisImageProviderConfiguration: jest.fn(() => ({ provider: "mock", model: "mock", configured: true, monetaryCostTelemetryAvailable: false })),
}));

jest.mock("@/modules/foundation/wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference: jest.fn(),
}));

jest.mock("@/modules/foundation/authenticated-wordpress-read-authority", () => ({
  createAuthenticatedWordPressReadAuthority: jest.fn(),
}));

import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { getProductMediaAuthorityContent, listProductMediaAuthority } from "../product-media-authority";
import { resolveContextualMediaProductionAuthority } from "../contextual-media-production-preflight";
import { resolveTargetParameterizedRichReferenceProduction } from "../target-parameterized-rich-reference-production";

const mockSite = jest.mocked(getSiteById);
const mockProduct = jest.mocked(getProductById);
const mockTargetReadiness = jest.mocked(resolveTargetParameterizedRichReferenceProduction);
const mockListMedia = jest.mocked(listProductMediaAuthority);
const mockMediaContent = jest.mocked(getProductMediaAuthorityContent);
const mockCredential = jest.mocked(resolveWordPressCredentialReference);
const mockReaderFactory = jest.mocked(createAuthenticatedWordPressReadAuthority);

describe("contextual media preflight presentation root", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTargetReadiness.mockResolvedValue({
      target: { targetId: "target-fl", campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview" },
      identity: {
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        wordpressObjectId: "20163",
        canonicalSlug: "florida",
        wordpressParentId: "20114",
      },
      authority: {
        candidateArtifactIdentity: "job:job-fl:2026-09-18T02:46:59.526Z",
        heroMediaAuthorityId: "hero-authority",
      },
    } as never);

    mockSite.mockReturnValue({
      siteId: "site-led-display-warehouse-production",
      organizationId: "led-display-warehouse",
      displayName: "LEDDisplayWarehouse.com",
      integrations: { wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2", wordpressCredentialReference: "wp-ledw-prod" },
    } as never);

    mockProduct.mockReturnValue({
      productId: "prod-outdoor-digital-sphere",
      productName: "Outdoor Digital Sphere",
    } as never);

    mockListMedia.mockReturnValue([
      {
        mediaAuthorityId: "hero-authority",
        ownerApproval: "APPROVED",
        productRepresentationAllowed: true,
        mimeType: "image/jpeg",
        altTextAuthority: "Approved product image",
        captionAuthority: "Approved",
        provenance: "Owner supplied",
        ownerPrincipalId: "owner",
        ownerApprovalTimestamp: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);

    mockMediaContent.mockReturnValue({
      bytes: Buffer.from("image"),
      hash: "a".repeat(64),
    } as never);

    mockCredential.mockReturnValue({
      username: "operator",
      applicationPassword: "app-password",
    } as never);

    mockReaderFactory.mockReturnValue({
      getJson: jest.fn(async () => ({
        ok: true,
        body: {
          id: 20163,
          status: "draft",
          slug: "florida",
          parent: 20114,
          content: {
            raw: "<h1>Outdoor Digital Sphere in Florida</h1><figure class=\"wp-block-image\"><img src=\"legacy\"></figure><p>Planning content.</p>",
          },
        },
      })),
    } as never);
  });

  test("accepts article-format root for contextual repair preflight without FL special-casing", async () => {
    const authority = await resolveContextualMediaProductionAuthority({
      campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      targetId: "target-fl",
      visualPlan: [{
        role: "CONTEXTUAL_IN_USE",
        mediaRole: "CONTEXTUAL_IN_USE",
        slot: "POST_HERO_CONTEXTUAL",
        prompt: "Generate contextual atmosphere",
        altText: "Conceptual contextual visualization",
      }],
    });

    expect(authority.presentationSlots).toEqual([
      expect.objectContaining({
        requestedSlot: "POST_HERO_CONTEXTUAL",
        actualSection: "ARTICLE_BODY",
      }),
    ]);
  });
});
