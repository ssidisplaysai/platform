import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getGlwCampaignOwnershipForTarget,
  readGlwCampaignAuthoritySnapshot,
  type GlwCampaignAuthoritySnapshot,
  type GlwPersistedCampaign,
  type GlwPersistedCampaignTarget,
} from "../campaign-authority";
import { createGlwTargetIntentIdentity, evaluateGlwTargetIntentOwnership } from "../target-intent-authority";

const campaign: GlwPersistedCampaign = {
  campaignId: "campaign-ssi-texas",
  organizationId: "ssi",
  siteId: "site-ssi",
  productId: "product-film",
  pageType: "city_service",
  status: "active",
};

function target(overrides: Partial<GlwPersistedCampaignTarget> = {}): GlwPersistedCampaignTarget {
  return {
    targetId: "target-dallas",
    campaignId: campaign.campaignId,
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    productId: campaign.productId,
    stateCode: "TX",
    citySlug: "dallas",
    cityName: "Dallas",
    status: "running",
    jobId: "job-1",
    wordpressObjectId: null,
    lastError: null,
    ...overrides,
  };
}

function snapshot(targets: readonly GlwPersistedCampaignTarget[] = []): GlwCampaignAuthoritySnapshot {
  return { checked: true, source: "GLW_CAMPAIGN_PERSISTENCE", persistenceIdentity: "fixture", campaignRevision: 2, targetRevision: 4, campaigns: [campaign], targets };
}

function ownership(targets: readonly GlwPersistedCampaignTarget[]) {
  return getGlwCampaignOwnershipForTarget({ snapshot: snapshot(targets), organizationId: "ssi", siteId: "site-ssi", productId: "product-film", pageType: "city_service", stateCode: "TX", citySlug: "dallas" });
}

describe("GLW campaign persistence authority", () => {
  test("distinguishes unavailable persistence from checked-empty", () => {
    expect(readGlwCampaignAuthoritySnapshot({ persistenceDirectory: null })).toBeNull();
    expect(ownership([]).classification).toBe("AVAILABLE");
  });

  test.each(["prepared", "queued", "running", "reference_complete", "draft_ready", "published", "skipped"] as const)("retains active campaign ownership for %s targets", (status) => {
    expect(ownership([target({ status })])).toMatchObject({ classification: "OWNED_BY_ACTIVE_CAMPAIGN", campaignId: campaign.campaignId, campaignState: "active", targetState: status });
  });

  test("failed targets remain reserved and unreconciled", () => {
    expect(ownership([target({ status: "failed", lastError: "Generation failed." })])).toMatchObject({ classification: "UNRECONCILED", campaignId: campaign.campaignId, targetState: "failed" });
  });

  test("completed campaigns retain completed ownership", () => {
    const completed = { ...campaign, status: "complete" as const };
    const result = getGlwCampaignOwnershipForTarget({ snapshot: { ...snapshot([target()]), campaigns: [completed] }, organizationId: "ssi", siteId: "site-ssi", productId: "product-film", pageType: "city_service", stateCode: "TX", citySlug: "dallas" });
    expect(result).toMatchObject({ classification: "OWNED_BY_COMPLETED_CAMPAIGN", campaignId: campaign.campaignId });
  });

  test("duplicate campaign claims are unreconciled", () => {
    expect(ownership([target(), target({ targetId: "target-dallas-2", campaignId: "campaign-other" })]).classification).toBe("UNRECONCILED");
  });

  test("reads the existing versioned envelope format without writing", () => {
    const files = new Map([
      ["glw-campaign-repository.json", JSON.stringify({ schemaVersion: 1, revision: 2, updatedAt: "2026-01-01", data: { campaigns: [campaign] } })],
      ["glw-campaign-target-repository.json", JSON.stringify({ schemaVersion: 1, revision: 4, updatedAt: "2026-01-01", data: { targets: [target()] } })],
    ]);
    const result = readGlwCampaignAuthoritySnapshot({ persistenceDirectory: "fixture", readFile: (path) => files.get(path.split(/[\\/]/).pop()!)! });
    expect(result).toMatchObject({ checked: true, campaignRevision: 2, targetRevision: 4 });
  });

  test("contains no persistence mutation operations", () => {
    const source = readFileSync(resolve(process.cwd(), "src/modules/glw/campaign-authority.ts"), "utf8");
    expect(source).not.toMatch(/writeFile|renameSync|unlinkSync|savePersistedState|createGlwCampaign|initializeGlwCampaignTargets/);
  });

  test("fails closed for malformed repository envelopes", () => {
    const result = readGlwCampaignAuthoritySnapshot({ persistenceDirectory: "fixture", readFile: () => JSON.stringify({ schemaVersion: 1, revision: 1, updatedAt: "2026-01-01", data: {} }) });
    expect(result).toBeNull();
  });

  test.each([
    ["campaign-ssi-site-ssi-screen-solutions-international-ssi-accent-rear-projection-film-texas-cities", "TX", "plano", "published"],
    ["campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-california-starter-cities", "CA", "santa-ana", "draft_ready"],
    ["campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-california-expanded-cities", "CA", "san-jose", "draft_ready"],
    ["campaign-led-display-warehouse-site-led-display-warehouse-production-indoor-digital-sphere-california-cities", "CA", "san-diego", "running"],
  ])("preserves known city campaign identity %s", (campaignId, stateCode, citySlug, status) => {
    const organizationId = campaignId.includes("led-display-warehouse") ? "led-display-warehouse" : "ssi";
    const knownCampaign = { ...campaign, campaignId, organizationId, siteId: campaignId.includes("projectorenclosure") ? "site-ssi-projectorenclosure" : campaignId.includes("led-display-warehouse") ? "site-led-display-warehouse-production" : "site-ssi-screen-solutions-international", productId: campaignId.includes("projectorenclosure") ? "prod-ssi-fan-cooled-projector-enclosures" : campaignId.includes("led-display-warehouse") ? "prod-indoor-digital-sphere" : "prod-ssi-accent-rear-projection-film" };
    const knownTarget = target({ campaignId, organizationId, siteId: knownCampaign.siteId, productId: knownCampaign.productId, stateCode, citySlug, status: status as GlwPersistedCampaignTarget["status"] });
    const result = getGlwCampaignOwnershipForTarget({ snapshot: { ...snapshot(), campaigns: [knownCampaign], targets: [knownTarget] }, organizationId, siteId: knownCampaign.siteId, productId: knownCampaign.productId, pageType: "city_service", stateCode, citySlug });
    expect(result).toMatchObject({ classification: "OWNED_BY_ACTIVE_CAMPAIGN", campaignId, targetState: status });
  });

  test("retains failed SSI Tennessee ownership as unreconciled", () => {
    const campaignId = "campaign-ssi-site-ssi-screen-solutions-international-ssi-accent-rear-projection-film-multi-state-benchmark";
    const stateCampaign = { ...campaign, campaignId, siteId: "site-ssi-screen-solutions-international", productId: "prod-ssi-accent-rear-projection-film", pageType: "state_service" as const };
    const tennessee = target({ campaignId, siteId: stateCampaign.siteId, productId: stateCampaign.productId, stateCode: "TN", citySlug: null, cityName: null, status: "failed", jobId: "9fa54ac3-36fe-48ce-b0f8-25e3e7e798c6", lastError: "Generation failed." });
    const result = getGlwCampaignOwnershipForTarget({ snapshot: { ...snapshot(), campaigns: [stateCampaign], targets: [tennessee] }, organizationId: "ssi", siteId: stateCampaign.siteId, productId: stateCampaign.productId, pageType: "state_service", stateCode: "TN", citySlug: null });
    expect(result).toMatchObject({ classification: "UNRECONCILED", campaignId, campaignState: "active", targetState: "failed" });
  });
});

describe("GLW broader intent authority", () => {
  const identity = createGlwTargetIntentIdentity({ siteId: "site-ssi", productId: "product-film", stateCode: "TX", citySlug: "dallas" });

  test("returns unavailable without a checked target index", () => {
    expect(evaluateGlwTargetIntentOwnership({ snapshot: null, identity }).classification).toBe("UNAVAILABLE");
  });

  test("returns an exact campaign intent owner", () => {
    expect(evaluateGlwTargetIntentOwnership({ snapshot: snapshot([target()]), identity })).toMatchObject({ classification: "EXISTING_INTENT_OWNER", campaignId: campaign.campaignId, targetState: "running" });
  });

  test("returns ambiguous when multiple campaign targets claim one intent", () => {
    expect(evaluateGlwTargetIntentOwnership({ snapshot: snapshot([target(), target({ targetId: "target-dallas-2", campaignId: "campaign-other" })]), identity }).classification).toBe("AMBIGUOUS");
  });

  test("returns clear only for a unique registered city with checked-empty ownership", () => {
    expect(evaluateGlwTargetIntentOwnership({ snapshot: snapshot([]), identity }).classification).toBe("CLEAR");
  });

  test("detects the same product and city persisted under another slug", () => {
    const alias = target({ citySlug: "dallas-city", cityName: "Dallas" });
    expect(evaluateGlwTargetIntentOwnership({ snapshot: snapshot([alias]), identity })).toMatchObject({ classification: "SAME_PRODUCT_GEO_CONFLICT", campaignId: campaign.campaignId });
  });

  test("returns ambiguous for an unsupported geography identity", () => {
    const unknown = createGlwTargetIntentIdentity({ siteId: "site-ssi", productId: "product-film", stateCode: "TX", citySlug: "not-a-city" });
    expect(evaluateGlwTargetIntentOwnership({ snapshot: snapshot([]), identity: unknown }).classification).toBe("AMBIGUOUS");
  });
});