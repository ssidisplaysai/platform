jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  isProductMediaHeroSelectable,
  issueProductMediaHeroGrant,
  issueProductMediaHeroPreflight,
  listProductMediaAuthority,
  reviewProductMedia,
  selectProductMediaHero,
  intakeProductMedia,
} from "../product-media-authority";

const scope = { organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", productId: "prod-outdoor-digital-sphere" } as const;
const principal = { principalId: "owner-1", principalSessionId: "session-1" } as const;
const exactRuntime = "a".repeat(40);

describe("Outdoor Digital Sphere governed hero authority", () => {
  const originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let root: string;
  let image: Buffer;

  beforeAll(async () => { image = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#174e63" } }).jpeg().toBuffer(); });
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "product-media-hero-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot; rmSync(root, { recursive: true, force: true }); });

  async function pending(suffix: string) {
    return intakeProductMedia({ ...scope, originalFilename: `${suffix}.jpg`, mimeType: "image/jpeg", bytes: Buffer.concat([image, Buffer.from(suffix)]), sourceType: "OWNER_SUPPLIED", sourceDescription: suffix, provenance: suffix, authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"], depictsActualProduct: true, heroEligible: true, altTextAuthority: suffix, captionAuthority: suffix, now: new Date("2030-01-01") });
  }

  async function approved(suffix: string) {
    const record = await pending(suffix);
    return reviewProductMedia({ ...scope, mediaAuthorityId: record.mediaAuthorityId, decision: "APPROVE", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"], depictsActualProduct: true, heroEligible: true, altTextAuthority: suffix, captionAuthority: suffix, authorityAndScopesConfirmed: true, localAtmosphereConfirmed: false, principalId: principal.principalId, sessionId: principal.principalSessionId, now: new Date("2030-01-02") });
  }

  function context(record: Awaited<ReturnType<typeof approved>>, overrides: Record<string, unknown> = {}) {
    return { ...scope, ...principal, mediaAuthorityId: record.mediaAuthorityId, hash: record.hash, exactRuntime, replacementConfirmed: false, ...overrides };
  }

  test("only approved actual-product authority is selectable and hero is never inferred", async () => {
    const pendingRecord = await pending("pending");
    expect(isProductMediaHeroSelectable(pendingRecord)).toBe(false);
    expect(() => issueProductMediaHeroPreflight(context(pendingRecord as Awaited<ReturnType<typeof approved>>))).toThrow("PRODUCT_MEDIA_HERO_TARGET_NOT_SELECTABLE");
    const rejected = reviewProductMedia({ ...scope, mediaAuthorityId: pendingRecord.mediaAuthorityId, decision: "REJECT", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY"], depictsActualProduct: true, heroEligible: true, altTextAuthority: "rejected", captionAuthority: "", authorityAndScopesConfirmed: false, localAtmosphereConfirmed: false, principalId: principal.principalId, sessionId: principal.principalSessionId });
    expect(isProductMediaHeroSelectable(rejected)).toBe(false);
    const approvedRecord = await approved("approved");
    expect(approvedRecord).toMatchObject({ ownerApproval: "APPROVED", heroEligible: false, heroSelected: false });
    expect(isProductMediaHeroSelectable(approvedRecord)).toBe(true);
  });

  test("selects exactly one hero, survives reload, and atomically replaces without changing approved scopes", async () => {
    const first = await approved("first");
    const second = await approved("second");
    const firstContext = context(first);
    const firstReceipt = issueProductMediaHeroPreflight({ ...firstContext, now: new Date("2030-01-03T00:00:00Z") });
    const firstGrant = issueProductMediaHeroGrant({ ...firstContext, preflightReceiptId: firstReceipt.receiptId, now: new Date("2030-01-03T00:00:01Z") });
    selectProductMediaHero({ ...firstContext, preflightReceiptId: firstReceipt.receiptId, grantId: firstGrant.grantId, now: new Date("2030-01-03T00:00:02Z") });
    expect(() => selectProductMediaHero({ ...firstContext, preflightReceiptId: firstReceipt.receiptId, grantId: firstGrant.grantId, now: new Date("2030-01-03T00:00:03Z") })).toThrow("GRANT_CONSUMED");
    expect(() => issueProductMediaHeroPreflight({ ...context(second), now: new Date("2030-01-03T00:00:04Z") })).toThrow("REPLACEMENT_CONFIRMATION_REQUIRED");
    const secondContext = context(second, { replacementConfirmed: true });
    const secondReceipt = issueProductMediaHeroPreflight({ ...secondContext, now: new Date("2030-01-03T00:00:05Z") });
    const secondGrant = issueProductMediaHeroGrant({ ...secondContext, preflightReceiptId: secondReceipt.receiptId, now: new Date("2030-01-03T00:00:06Z") });
    const replacement = selectProductMediaHero({ ...secondContext, preflightReceiptId: secondReceipt.receiptId, grantId: secondGrant.grantId, now: new Date("2030-01-03T00:00:07Z") });
    expect(replacement.previousHeroId).toBe(first.mediaAuthorityId);
    const reloaded = listProductMediaAuthority(scope);
    expect(reloaded.filter((record) => record.heroSelected)).toHaveLength(1);
    expect(reloaded.find((record) => record.mediaAuthorityId === first.mediaAuthorityId)).toMatchObject({ heroSelected: false, heroEligible: false, approvedUsageScopes: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"] });
    expect(reloaded.find((record) => record.mediaAuthorityId === second.mediaAuthorityId)).toMatchObject({ heroSelected: true, heroEligible: true, heroSelectedBy: principal.principalId, approvedUsageScopes: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"] });
    expect(replacement.readiness).toMatchObject({ heroAuthorityReady: true, supportingProductMediaReady: true, applicationMediaReady: true, mediaProvenanceReady: true });
  });

  test("fails closed for wrong product, media, hash, runtime, session, and expired authority", async () => {
    const record = await approved("exact");
    const live = context(record);
    expect(() => issueProductMediaHeroPreflight({ ...live, productId: "wrong" })).toThrow("PRODUCT_MEDIA_SCOPE_DENIED");
    expect(() => issueProductMediaHeroPreflight({ ...live, mediaAuthorityId: "wrong" })).toThrow("TARGET_NOT_FOUND");
    expect(() => issueProductMediaHeroPreflight({ ...live, hash: "b".repeat(64) })).toThrow("TARGET_NOT_FOUND");
    const receipt = issueProductMediaHeroPreflight({ ...live, now: new Date("2030-01-03T00:00:00Z") });
    expect(() => issueProductMediaHeroGrant({ ...live, exactRuntime: "b".repeat(40), preflightReceiptId: receipt.receiptId, now: new Date("2030-01-03T00:00:01Z") })).toThrow("CONTEXT_MISMATCH");
    expect(() => issueProductMediaHeroGrant({ ...live, principalSessionId: "wrong", preflightReceiptId: receipt.receiptId, now: new Date("2030-01-03T00:00:01Z") })).toThrow("CONTEXT_MISMATCH");
    expect(() => issueProductMediaHeroGrant({ ...live, preflightReceiptId: receipt.receiptId, now: new Date("2030-01-03T00:02:01Z") })).toThrow("PREFLIGHT_EXPIRED");
    const activeReceipt = issueProductMediaHeroPreflight({ ...live, now: new Date("2030-01-04T00:00:00Z") });
    const grant = issueProductMediaHeroGrant({ ...live, preflightReceiptId: activeReceipt.receiptId, now: new Date("2030-01-04T00:00:01Z") });
    expect(() => selectProductMediaHero({ ...live, preflightReceiptId: activeReceipt.receiptId, grantId: grant.grantId, now: new Date("2030-01-04T00:05:02Z") })).toThrow("GRANT_EXPIRED");
  });
});