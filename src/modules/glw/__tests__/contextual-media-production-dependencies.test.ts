jest.mock("server-only", () => ({}));
jest.mock("../reference-aware-image-service", () => ({ generateGenesisFeaturedImageWithCampaignReferences: jest.fn() }));
jest.mock("@/modules/foundation/generated-contextual-media-repository", () => ({ bindGeneratedContextualMediaWordPress: jest.fn(), findSuccessfulGeneratedContextualMedia: jest.fn(), saveSuccessfulGeneratedContextualMedia: jest.fn() }));
jest.mock("@/modules/foundation/site-page-media-assignment", () => ({ listSitePageMediaAssignments: jest.fn(() => []), saveSitePageMediaAssignment: jest.fn((input) => input) }));
jest.mock("@/modules/foundation/wordpress-media-writer", () => ({ uploadGenesisWordPressGeneratedMedia: jest.fn() }));

import { bindGeneratedContextualMediaWordPress } from "@/modules/foundation/generated-contextual-media-repository";
import { uploadGenesisWordPressGeneratedMedia } from "@/modules/foundation/wordpress-media-writer";
import { createContextualMediaProductionDependencies, inertContextualMediaDependencies } from "../contextual-media-production-dependencies";
import { generateGenesisFeaturedImageWithCampaignReferences } from "../reference-aware-image-service";

const generateWithRefs = jest.mocked(generateGenesisFeaturedImageWithCampaignReferences);
const uploadGenerated = jest.mocked(uploadGenesisWordPressGeneratedMedia);
const bindWordPress = jest.mocked(bindGeneratedContextualMediaWordPress);

const site = { integrations: { wordpressApiBaseUrl: "https://example.test/wp-json/wp/v2", wordpressCredentialReference: "cred" } } as never;
const identity = {
  organizationId: "led-display-warehouse",
  siteId: "site-led-display-warehouse-production",
  campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
  targetId: "target-fl",
  productId: "prod-outdoor-digital-sphere",
  wordpressObjectId: "20163",
  pageRevisionId: "job:job-fl:2026-09-18T10:00:00.000Z",
};
const item = {
  role: "CONTEXTUAL_IN_USE",
  mediaRole: "CONTEXTUAL_IN_USE" as const,
  slot: "POST_HERO_CONTEXTUAL" as const,
  prompt: "Conceptual generated contextual visualization only.",
  altText: "Conceptual contextual visualization in Florida; not a real customer installation.",
};
const asset = {
  receipt: {
    generationId: "contextual-generation-123",
    provider: "OPENAI_IMAGE",
    model: "gpt-image-2",
    mimeType: "image/jpeg",
    assetSha256: "a".repeat(64),
  },
  bytes: Buffer.from("image-bytes"),
  wordpressMediaId: null,
  wordpressUrl: null,
} as never;

beforeEach(() => {
  jest.clearAllMocks();
});

test("production dependencies reuse existing provider, persistence, assignment, and WordPress paths", () => {
  const deps = createContextualMediaProductionDependencies({ site, siteName: "Site", productName: "Product", patchPresentation: jest.fn(), certify: jest.fn() });
  expect(Object.keys(deps)).toEqual(["findSuccessfulGeneration", "generate", "persistGeneration", "persistAssignment", "uploadMedia", "patchPresentation", "certify"]);
  expect(() => inertContextualMediaDependencies().generate({} as never)).toThrow("DRY_RUN_SIDE_EFFECT_FORBIDDEN");
});

test("provider failure cannot become generated-media success", async () => {
  generateWithRefs.mockResolvedValueOnce({ ok: false, state: "generation_failed", message: "HTTP 500" });
  const deps = createContextualMediaProductionDependencies({ site, siteName: "Site", productName: "Product", patchPresentation: jest.fn(), certify: jest.fn() });
  await expect(deps.generate({ identity, item })).rejects.toThrow("CONTEXTUAL_MEDIA_GENERATION_FAILED:generation_failed");
});

test("provider success with no artifact fails closed", async () => {
  generateWithRefs.mockResolvedValueOnce({ ok: false, state: "invalid_response", message: "no usable base64 image payload" });
  const deps = createContextualMediaProductionDependencies({ site, siteName: "Site", productName: "Product", patchPresentation: jest.fn(), certify: jest.fn() });
  await expect(deps.generate({ identity, item })).rejects.toThrow("CONTEXTUAL_MEDIA_GENERATION_FAILED:invalid_response");
});

test("valid provider artifact is recognized and mapped", async () => {
  generateWithRefs.mockResolvedValueOnce({
    ok: true,
    image: {
      bytes: Buffer.from("ok-image"),
      mimeType: "image/jpeg",
      fileExtension: "jpg",
      provider: "OPENAI_IMAGE",
      model: "gpt-image-2",
      width: 1536,
      height: 1024,
      reportedCost: "UNKNOWN",
    },
  });
  const deps = createContextualMediaProductionDependencies({ site, siteName: "Site", productName: "Product", patchPresentation: jest.fn(), certify: jest.fn() });
  await expect(deps.generate({ identity, item })).resolves.toMatchObject({
    mimeType: "image/jpeg",
    provider: "OPENAI_IMAGE",
    model: "gpt-image-2",
    width: 1536,
    height: 1024,
  });
});

test("WordPress upload/readback is required before binding success", async () => {
  uploadGenerated.mockResolvedValueOnce({ ok: true, mediaId: 20301, mediaUrl: "https://leddisplaywarehouse.com/wp-content/uploads/contextual.jpg", provenance: "GENERATED_MEDIA" });
  bindWordPress.mockReturnValueOnce({
    ...asset,
    wordpressMediaId: 20301,
    wordpressUrl: "https://leddisplaywarehouse.com/wp-content/uploads/contextual.jpg",
  } as never);
  const deps = createContextualMediaProductionDependencies({ site, siteName: "Site", productName: "Product", patchPresentation: jest.fn(), certify: jest.fn() });
  await expect(deps.uploadMedia({ identity, item, asset })).resolves.toMatchObject({ mediaId: 20301, reused: false });
  expect(uploadGenerated).toHaveBeenCalledTimes(1);
  expect(bindWordPress).toHaveBeenCalledWith({ generationId: "contextual-generation-123", mediaId: 20301, url: "https://leddisplaywarehouse.com/wp-content/uploads/contextual.jpg" });
});

test("upload failure prevents receipt-to-WordPress binding", async () => {
  uploadGenerated.mockResolvedValueOnce({ ok: false, state: "upload_failed", message: "upload failed" });
  const deps = createContextualMediaProductionDependencies({ site, siteName: "Site", productName: "Product", patchPresentation: jest.fn(), certify: jest.fn() });
  await expect(deps.uploadMedia({ identity, item, asset })).rejects.toThrow("CONTEXTUAL_MEDIA_WORDPRESS_UPLOAD_FAILED:upload_failed");
  expect(bindWordPress).not.toHaveBeenCalled();
});