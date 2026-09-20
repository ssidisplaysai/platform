jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GlwCampaign } from "@/modules/glw/campaign-types";
import { ensureDraftCampaignContinuationTarget } from "@/modules/glw/reference-continuation-targets";
import {
  initializeGlwCampaignTargets,
  listGlwCampaignTargets,
} from "@/modules/glw/campaign-target-repository";

const stateCodes = [
  "DE", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH",
  "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY",
] as const;

function draftCampaign(): GlwCampaign {
  return {
    campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2",
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-outdoor-digital-sphere",
    name: "Outdoor Digital Sphere Unpublished States V2",
    pageType: "state_service",
    stateCodes,
    pagesPerDay: 1,
    publicationPolicy: "publish_after_gates",
    imageRequired: true,
    status: "draft",
    completedTargetCount: 0,
    failedTargetCount: 0,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };
}

describe("reference continuation target initialization", () => {
  let root: string;
  const original = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "glw-ref-continuation-targets-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = original;
    rmSync(root, { recursive: true, force: true });
  });

  test("materializes draft selected-states targets before continuation and includes TX", () => {
    const campaign = draftCampaign();
    expect(listGlwCampaignTargets(campaign.campaignId)).toHaveLength(0);

    const initialized = ensureDraftCampaignContinuationTarget({
      campaign,
      targetStateCode: "TX",
      targetCitySlug: null,
      referenceJobId: "a1371f29-8952-438d-9ed4-583da68d4fbb",
      referenceJobStatus: "CONTENT_READY",
      referenceWordpressObjectId: null,
    });

    const targets = listGlwCampaignTargets(campaign.campaignId);
    expect(initialized).toBe(true);
    expect(targets).toHaveLength(30);
    expect(targets.some((target) => target.stateCode === "TX" && target.citySlug === null)).toBe(true);
    const referenceTarget = targets.find((target) => target.stateCode === "TX" && target.citySlug === null);
    expect(referenceTarget?.status).toBe("content_ready");
    expect(targets.filter((target) => target.status === "queued")).toHaveLength(29);
    expect(campaign.status).toBe("draft");
  });

  test("is idempotent and does not duplicate targets", () => {
    const campaign = draftCampaign();

    expect(ensureDraftCampaignContinuationTarget({
      campaign,
      targetStateCode: "TX",
      targetCitySlug: null,
      referenceJobId: "job-1",
      referenceJobStatus: "CONTENT_READY",
      referenceWordpressObjectId: null,
    })).toBe(true);

    const first = listGlwCampaignTargets(campaign.campaignId);
    expect(first).toHaveLength(30);

    expect(ensureDraftCampaignContinuationTarget({
      campaign,
      targetStateCode: "TX",
      targetCitySlug: null,
      referenceJobId: "job-1",
      referenceJobStatus: "CONTENT_READY",
      referenceWordpressObjectId: null,
    })).toBe(true);

    const second = listGlwCampaignTargets(campaign.campaignId);
    expect(second).toHaveLength(30);
    expect(second.map((target) => target.targetId).sort()).toEqual(first.map((target) => target.targetId).sort());
  });

  test("fails closed when requested target identity is not part of canonical preview", () => {
    const campaign = draftCampaign();

    const initialized = ensureDraftCampaignContinuationTarget({
      campaign,
      targetStateCode: "AK",
      targetCitySlug: null,
      referenceJobId: "job-1",
      referenceJobStatus: "CONTENT_READY",
      referenceWordpressObjectId: null,
    });

    expect(initialized).toBe(false);
    expect(listGlwCampaignTargets(campaign.campaignId)).toHaveLength(0);
  });

  test("later activation target initialization can reuse the preinitialized target set", () => {
    const campaign = draftCampaign();

    expect(ensureDraftCampaignContinuationTarget({
      campaign,
      targetStateCode: "TX",
      targetCitySlug: null,
      referenceJobId: "job-1",
      referenceJobStatus: "CONTENT_READY",
      referenceWordpressObjectId: null,
    })).toBe(true);

    const reused = initializeGlwCampaignTargets({
      campaignId: campaign.campaignId,
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
      stateCodes: campaign.stateCodes,
      referenceStateCode: "TX",
      referenceJobId: "job-1",
      referenceWordpressObjectId: null,
    });

    expect(reused).toHaveLength(30);
    expect(reused.some((target) => target.stateCode === "TX" && target.jobId === "job-1")).toBe(true);
  });
});
