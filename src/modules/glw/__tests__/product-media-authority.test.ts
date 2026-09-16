jest.mock("server-only", () => ({}));

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    expect(pending).toMatchObject({ ownerApproval: "PENDING_OWNER_APPROVAL", dimensions: { width: 40, height: 30 }, proposedUsageScopes: ["PRODUCT_AUTHORITY"], approvedUsageScopes: [], depictsActualProduct: false, productRepresentationAllowed: false, heroEligible: false, hash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const approved = repository.reviewProductMedia({ ...scope, mediaAuthorityId: pending.mediaAuthorityId, decision: "APPROVE", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY"], depictsActualProduct: true, heroEligible: true, altTextAuthority: "Outdoor Digital Sphere product", captionAuthority: "Owner approved.", authorityAndScopesConfirmed: true, localAtmosphereConfirmed: false, principalId: "owner-1", sessionId: "session-1", now: new Date("2030-01-02") });
    expect(approved).toMatchObject({ ownerApproval: "APPROVED", ownerApprovalTimestamp: "2030-01-02T00:00:00.000Z", ownerPrincipalId: "owner-1", ownerSessionId: "session-1", approvedUsageScopes: ["PRODUCT_AUTHORITY"], productRepresentationAllowed: true, heroEligible: true });
    expect(repository.listProductMediaAuthority(scope)).toHaveLength(1);
  });

  test("never promotes generated, unverified, or non-product media to product authority", async () => {
    const repository = await import("../product-media-authority");
    for (const sourceType of ["GENESIS_GENERATED_CONTEXTUAL", "REFERENCE_ONLY", "UNVERIFIED"] as const) {
      const pending = await intake({ sourceType, originalFilename: `${sourceType}.jpg`, bytes: Buffer.concat([image, Buffer.from(sourceType)]) });
      expect(() => repository.reviewProductMedia({ ...scope, mediaAuthorityId: pending.mediaAuthorityId, decision: "APPROVE", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY"], depictsActualProduct: true, heroEligible: true, altTextAuthority: "Sphere", captionAuthority: "", authorityAndScopesConfirmed: true, localAtmosphereConfirmed: false, principalId: "owner", sessionId: "session" })).toThrow("PRODUCT_AUTHORITY_REQUIRES_OWNER_APPROVED_GROUNDED_PRODUCT_MEDIA");
    }
  });

  test("requires distinct hero, supporting, application, and provenance while local atmosphere stays optional", async () => {
    const repository = await import("../product-media-authority");
    const approve = async (suffix: string, authorityClass: "PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE", usageScopes: ("PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE")[], heroEligible = false) => {
      const pending = await intake({ originalFilename: `${suffix}.jpg`, bytes: Buffer.concat([image, Buffer.from(suffix)]), authorityClass, usageScopes, heroEligible, depictsActualProduct: authorityClass === "PRODUCT_AUTHORITY" });
      return repository.reviewProductMedia({ ...scope, mediaAuthorityId: pending.mediaAuthorityId, decision: "APPROVE", authorityClass, usageScopes, depictsActualProduct: authorityClass === "PRODUCT_AUTHORITY", heroEligible, altTextAuthority: suffix, captionAuthority: "", authorityAndScopesConfirmed: true, localAtmosphereConfirmed: false, principalId: "owner", sessionId: "session" });
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

  test("requires explicit scope confirmation, keeps local atmosphere separate, and makes approval final", async () => {
    const repository = await import("../product-media-authority");
    const pending = await intake({ usageScopes: ["PRODUCT_AUTHORITY", "LOCAL_CONTEXTUAL_ATMOSPHERE"] });
    const review = { ...scope, mediaAuthorityId: pending.mediaAuthorityId, decision: "APPROVE" as const, authorityClass: "PRODUCT_AUTHORITY" as const, usageScopes: ["PRODUCT_AUTHORITY", "LOCAL_CONTEXTUAL_ATMOSPHERE"] as const, depictsActualProduct: true, heroEligible: false, altTextAuthority: "Sphere", captionAuthority: "", principalId: "owner", sessionId: "session" };
    expect(() => repository.reviewProductMedia({ ...review, authorityAndScopesConfirmed: false, localAtmosphereConfirmed: false })).toThrow("PRODUCT_MEDIA_REVIEW_CONFIRMATION_REQUIRED");
    expect(() => repository.reviewProductMedia({ ...review, authorityAndScopesConfirmed: true, localAtmosphereConfirmed: false })).toThrow("LOCAL_ATMOSPHERE_CONFIRMATION_REQUIRED");
    const approved = repository.reviewProductMedia({ ...review, usageScopes: ["PRODUCT_AUTHORITY"], authorityAndScopesConfirmed: true, localAtmosphereConfirmed: false });
    expect(approved).toMatchObject({ ownerApproval: "APPROVED", localAtmosphereUseAllowed: false, heroEligible: false });
    expect(() => repository.reviewProductMedia({ ...review, decision: "REJECT", authorityAndScopesConfirmed: true, localAtmosphereConfirmed: true })).toThrow("PRODUCT_MEDIA_APPROVAL_ALREADY_FINAL");
  });

  test("persists rejection truthfully and requires an explicit confirmed re-review", async () => {
    const repository = await import("../product-media-authority");
    const pending = await intake();
    const review = { ...scope, mediaAuthorityId: pending.mediaAuthorityId, authorityClass: "PRODUCT_AUTHORITY" as const, usageScopes: ["PRODUCT_AUTHORITY"] as const, depictsActualProduct: true, heroEligible: true, altTextAuthority: "Sphere", captionAuthority: "", principalId: "owner", sessionId: "session" };
    const rejected = repository.reviewProductMedia({ ...review, decision: "REJECT", authorityAndScopesConfirmed: false, localAtmosphereConfirmed: false, now: new Date("2030-01-02") });
    expect(rejected).toMatchObject({ ownerApproval: "REJECTED", approvedUsageScopes: [], productRepresentationAllowed: false, heroEligible: false, ownerPrincipalId: "owner", ownerApprovalTimestamp: "2030-01-02T00:00:00.000Z" });
    expect(() => repository.reviewProductMedia({ ...review, decision: "APPROVE", authorityAndScopesConfirmed: false, localAtmosphereConfirmed: false })).toThrow("PRODUCT_MEDIA_REVIEW_CONFIRMATION_REQUIRED");
    expect(repository.reviewProductMedia({ ...review, decision: "APPROVE", authorityAndScopesConfirmed: true, localAtmosphereConfirmed: false, now: new Date("2030-01-03") })).toMatchObject({ ownerApproval: "APPROVED", ownerApprovalTimestamp: "2030-01-03T00:00:00.000Z" });
  });

  test("reconciles only exact legacy ID and hash targets once while preserving audit evidence", async () => {
    const repository = await import("../product-media-authority");
    const approve = async (suffix: string, provenance: string) => {
      const pending = await intake({ originalFilename: `shared image (${suffix}).jpg`, bytes: Buffer.concat([image, Buffer.from(suffix)]), provenance });
      return repository.reviewProductMedia({ ...scope, mediaAuthorityId: pending.mediaAuthorityId, decision: "APPROVE", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"], depictsActualProduct: true, heroEligible: true, altTextAuthority: suffix, captionAuthority: provenance, authorityAndScopesConfirmed: true, localAtmosphereConfirmed: true, principalId: "legacy-owner", sessionId: "legacy-session", now: new Date("2029-12-31") });
    };
    const chicago = await approve("73", "Chicago");
    const texas = await approve("72", "Texas");
    const unrelated = await approve("71", "Indiana");
    const persistencePath = join(root, "glw-product-media-authority-v1.json");
    const envelope = JSON.parse(readFileSync(persistencePath, "utf-8")) as { data: { records: Array<Record<string, unknown>> } };
    for (const record of envelope.data.records.filter((candidate) => candidate.mediaAuthorityId === chicago.mediaAuthorityId || candidate.mediaAuthorityId === texas.mediaAuthorityId)) {
      delete record.approvalLifecycleVersion;
      delete record.proposedUsageScopes;
      delete record.approvedUsageScopes;
    }
    writeFileSync(persistencePath, JSON.stringify(envelope, null, 2), "utf-8");

    const targets = [{ mediaAuthorityId: chicago.mediaAuthorityId, hash: chicago.hash }, { mediaAuthorityId: texas.mediaAuthorityId, hash: texas.hash }];
    const first = repository.reconcileLegacyProductMediaApprovals({ ...scope, targets, principalId: "recovery-operator", now: new Date("2030-01-03") });
    expect(first.mutated).toBe(true);
    expect(first.records).toHaveLength(2);
    expect(first.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ mediaAuthorityId: chicago.mediaAuthorityId, hash: chicago.hash, provenance: "Chicago", ownerApproval: "PENDING_OWNER_APPROVAL", ownerPrincipalId: null, ownerApprovalTimestamp: null, approvedUsageScopes: [], depictsActualProduct: false, heroEligible: false, localAtmosphereUseAllowed: false }),
      expect.objectContaining({ mediaAuthorityId: texas.mediaAuthorityId, hash: texas.hash, provenance: "Texas", ownerApproval: "PENDING_OWNER_APPROVAL", ownerPrincipalId: null, ownerApprovalTimestamp: null, approvedUsageScopes: [], depictsActualProduct: false, heroEligible: false, localAtmosphereUseAllowed: false }),
    ]));
    expect(first.audits).toEqual(expect.arrayContaining([
      expect.objectContaining({ mediaAuthorityId: chicago.mediaAuthorityId, hash: chicago.hash, previousStatus: "APPROVED", previousApproval: true, previousPrincipalId: "legacy-owner", previousApprovalTimestamp: "2029-12-31T00:00:00.000Z", previousAuthorityClass: "PRODUCT_AUTHORITY", previousUsageScopes: expect.arrayContaining(["LOCAL_CONTEXTUAL_ATMOSPHERE"]), provenance: "Chicago", depictsActualProduct: true, heroEligible: true }),
      expect.objectContaining({ mediaAuthorityId: texas.mediaAuthorityId, hash: texas.hash, provenance: "Texas" }),
    ]));
    const second = repository.reconcileLegacyProductMediaApprovals({ ...scope, targets, principalId: "recovery-operator", now: new Date("2030-01-04") });
    expect(second).toMatchObject({ mutated: false });
    expect(second.audits).toHaveLength(2);
    expect(repository.listProductMediaAuthority(scope).find((record) => record.mediaAuthorityId === unrelated.mediaAuthorityId)).toMatchObject({ ownerApproval: "APPROVED", hash: unrelated.hash, approvalLifecycleVersion: repository.EXPLICIT_PRODUCT_MEDIA_APPROVAL_VERSION });
    expect(repository.evaluateProductMediaReadiness(first.records)).toMatchObject({ approvedProductAuthorityMediaCount: 0, approvedLocalAtmosphereMediaCount: 0, ready: false });
  });
});