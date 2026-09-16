jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const scope = { organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", productId: "prod-outdoor-digital-sphere" } as const;

describe("Outdoor Digital Sphere product media authority", () => {
  const originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let root: string;
  let image: Buffer;

  beforeAll(async () => { image = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#31724a" } }).jpeg().toBuffer(); });
  beforeEach(() => { jest.resetModules(); root = mkdtempSync(join(tmpdir(), "outdoor-sphere-media-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot; rmSync(root, { recursive: true, force: true }); });

  async function intake(overrides: Record<string, unknown> = {}) {
    const repository = await import("../product-media-authority");
    return repository.intakeProductMedia({ ...scope, originalFilename: "sphere.jpg", mimeType: "image/jpeg", bytes: image, sourceType: "OWNER_SUPPLIED", sourceDescription: "Owner supplied factory image.", provenance: "owner-upload:test", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY"], depictsActualProduct: true, heroEligible: true, altTextAuthority: "Outdoor Digital Sphere product", captionAuthority: "", now: new Date("2030-01-01"), ...overrides } as Parameters<typeof repository.intakeProductMedia>[0]);
  }

  test("persists complete intake metadata and binds approval to the server principal", async () => {
    const repository = await import("../product-media-authority");
    const pending = await intake();
    expect(pending).toMatchObject({ ownerApproval: "PENDING", dimensions: { width: 40, height: 30 }, productRepresentationAllowed: false, hash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const approved = repository.reviewProductMedia({ ...scope, mediaAuthorityId: pending.mediaAuthorityId, decision: "APPROVE", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY"], depictsActualProduct: true, heroEligible: true, altTextAuthority: "Outdoor Digital Sphere product", captionAuthority: "Owner approved.", principalId: "owner-1", sessionId: "session-1", now: new Date("2030-01-02") });
    expect(approved).toMatchObject({ ownerApproval: "APPROVED", ownerPrincipalId: "owner-1", ownerSessionId: "session-1", productRepresentationAllowed: true, heroEligible: true });
    expect(repository.listProductMediaAuthority(scope)).toHaveLength(1);
  });

  test("never promotes generated, unverified, or non-product media to product authority", async () => {
    const repository = await import("../product-media-authority");
    for (const sourceType of ["GENESIS_GENERATED_CONTEXTUAL", "REFERENCE_ONLY", "UNVERIFIED"] as const) {
      const pending = await intake({ sourceType, originalFilename: `${sourceType}.jpg`, bytes: Buffer.concat([image, Buffer.from(sourceType)]) });
      expect(() => repository.reviewProductMedia({ ...scope, mediaAuthorityId: pending.mediaAuthorityId, decision: "APPROVE", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY"], depictsActualProduct: true, heroEligible: true, altTextAuthority: "Sphere", captionAuthority: "", principalId: "owner", sessionId: "session" })).toThrow("PRODUCT_AUTHORITY_REQUIRES_OWNER_APPROVED_GROUNDED_PRODUCT_MEDIA");
    }
  });

  test("requires distinct hero, supporting, application, and provenance while local atmosphere stays optional", async () => {
    const repository = await import("../product-media-authority");
    const approve = async (suffix: string, authorityClass: "PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE", usageScopes: ("PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE")[], heroEligible = false) => {
      const pending = await intake({ originalFilename: `${suffix}.jpg`, bytes: Buffer.concat([image, Buffer.from(suffix)]), authorityClass, usageScopes, heroEligible, depictsActualProduct: authorityClass === "PRODUCT_AUTHORITY" });
      return repository.reviewProductMedia({ ...scope, mediaAuthorityId: pending.mediaAuthorityId, decision: "APPROVE", authorityClass, usageScopes, depictsActualProduct: authorityClass === "PRODUCT_AUTHORITY", heroEligible, altTextAuthority: suffix, captionAuthority: "", principalId: "owner", sessionId: "session" });
    };
    expect(repository.evaluateProductMediaReadiness([]).state).toBe("PRODUCT_MEDIA_AUTHORITY_REQUIRED");
    const hero = await approve("hero", "PRODUCT_AUTHORITY", ["PRODUCT_AUTHORITY"], true);
    expect(repository.evaluateProductMediaReadiness([hero]).supportingProductMediaReady).toBe(false);
    const support = await approve("support", "CONTEXTUAL_IN_USE", ["CONTEXTUAL_IN_USE"]);
    const application = await approve("application", "APPLICATION_EXPERIENCE", ["APPLICATION_EXPERIENCE"]);
    expect(repository.evaluateProductMediaReadiness([hero, support, application])).toMatchObject({ state: "REFERENCE_COMPOSITION_MEDIA_READY", ready: true, approvedLocalAtmosphereMediaCount: 0, productFactsExpanded: false });
  });

  test("rejects scope substitution and malformed uploads", async () => {
    const repository = await import("../product-media-authority");
    await expect(intake({ productId: "other" })).rejects.toThrow("PRODUCT_MEDIA_SCOPE_DENIED");
    await expect(intake({ bytes: Buffer.from("not-an-image") })).rejects.toThrow();
  });
});