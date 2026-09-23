jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GlwCampaign } from "@/modules/glw/campaign-types";
import {
  ensureDraftCampaignContinuationTarget,
  promoteDrainedActiveReferenceTargetForProduction,
  reconcileReferenceTargetExecutionProjection,
} from "@/modules/glw/reference-continuation-targets";
import {
  initializeGlwCityCampaignTargets,
  initializeGlwCampaignTargets,
  listGlwCampaignTargets,
  reconcileGlwReferenceTargetQueuedForProduction,
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

function activeCityCampaign(): GlwCampaign {
  return {
    campaignId: "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities",
    organizationId: "ssi",
    siteId: "site-ssi-projectorenclosure",
    productId: "prod-ssi-fan-cooled-projector-enclosures",
    name: "Fan Cooled Projector Enclosures Texas Cities",
    pageType: "city_service",
    stateCodes: ["TX"],
    cityTargets: [
      { stateCode: "TX", citySlug: "austin", cityName: "Austin" },
      { stateCode: "TX", citySlug: "dallas", cityName: "Dallas" },
    ],
    pagesPerDay: 10,
    publicationPolicy: "draft_only",
    imageRequired: true,
    status: "active",
    completedTargetCount: 0,
    failedTargetCount: 0,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };
}

function activeSingleCityReferenceCampaign(): GlwCampaign {
  return {
    campaignId: "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-austin-only",
    organizationId: "ssi",
    siteId: "site-ssi-projectorenclosure",
    productId: "prod-ssi-fan-cooled-projector-enclosures",
    name: "Fan Cooled Projector Enclosures Austin",
    pageType: "city_service",
    stateCodes: ["TX"],
    cityTargets: [
      { stateCode: "TX", citySlug: "austin", cityName: "Austin" },
    ],
    pagesPerDay: 10,
    publicationPolicy: "draft_only",
    imageRequired: true,
    status: "active",
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

  test("promotes drained active reference_complete target without job into queued production", () => {
    const campaign = activeSingleCityReferenceCampaign();
    initializeGlwCityCampaignTargets({
      campaignId: campaign.campaignId,
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
      cityTargets: campaign.cityTargets ?? [],
      referenceTarget: { stateCode: "TX", citySlug: "austin" },
      referenceJobId: null,
      referenceWordpressObjectId: null,
    });

    expect(listGlwCampaignTargets(campaign.campaignId).find((target) => target.citySlug === "austin")?.status).toBe("reference_complete");

    const promoted = promoteDrainedActiveReferenceTargetForProduction({ campaign });
    expect(promoted).toBe(true);

    const after = listGlwCampaignTargets(campaign.campaignId);
    expect(after.find((target) => target.citySlug === "austin")?.status).toBe("queued");
  });

  test("does not promote reference_complete target when reference already has a job", () => {
    const campaign = activeCityCampaign();
    initializeGlwCityCampaignTargets({
      campaignId: campaign.campaignId,
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
      cityTargets: campaign.cityTargets ?? [],
      referenceTarget: { stateCode: "TX", citySlug: "austin" },
      referenceJobId: "job-existing-reference",
      referenceWordpressObjectId: null,
    });

    const promoted = promoteDrainedActiveReferenceTargetForProduction({ campaign });
    expect(promoted).toBe(false);
    expect(listGlwCampaignTargets(campaign.campaignId).find((target) => target.citySlug === "austin")?.status).toBe("reference_complete");
  });

  test("reconciles reference_complete target to content_ready for recoverable failed continuation", () => {
    const campaign = draftCampaign();

    expect(ensureDraftCampaignContinuationTarget({
      campaign,
      targetStateCode: "TX",
      targetCitySlug: null,
      referenceJobId: "job-failed-continuable",
      referenceJobStatus: "FAILED",
      referenceWordpressObjectId: null,
    })).toBe(true);

    const targets = listGlwCampaignTargets(campaign.campaignId);
    const referenceTarget = targets.find((target) => target.stateCode === "TX" && target.citySlug === null);
    expect(referenceTarget?.jobId).toBe("job-failed-continuable");
    expect(referenceTarget?.status).toBe("content_ready");
  });

  test("adopts queued city reference target to existing fresh CONTENT_READY job without redispatch", () => {
    const campaign = activeSingleCityReferenceCampaign();
    initializeGlwCityCampaignTargets({
      campaignId: campaign.campaignId,
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
      cityTargets: campaign.cityTargets ?? [],
      referenceTarget: { stateCode: "TX", citySlug: "austin" },
      referenceJobId: null,
      referenceWordpressObjectId: null,
    });
    reconcileGlwReferenceTargetQueuedForProduction({
      campaignId: campaign.campaignId,
      stateCode: "TX",
      citySlug: "austin",
    });

    const before = listGlwCampaignTargets(campaign.campaignId).find((target) => target.citySlug === "austin");
    expect(before?.status).toBe("queued");
    expect(before?.jobId).toBeNull();

    const changed = reconcileReferenceTargetExecutionProjection({
      campaign,
      stateCode: "TX",
      citySlug: "austin",
      execution: {
        jobId: "fresh-job-austin",
        status: "CONTENT_READY",
        externalExecutionId: "764950",
        wordpressObjectId: null,
        errorCode: null,
        errorMessage: null,
      },
    });

    const after = listGlwCampaignTargets(campaign.campaignId).find((target) => target.citySlug === "austin");
    expect(changed).toBe(true);
    expect(after?.status).toBe("content_ready");
    expect(after?.jobId).toBe("fresh-job-austin");
    expect(after?.wordpressObjectId).toBeNull();
  });

  test("projects completed existing WordPress draft to draft_ready without a new job", () => {
    const campaign = activeSingleCityReferenceCampaign();
    initializeGlwCityCampaignTargets({
      campaignId: campaign.campaignId,
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
      cityTargets: campaign.cityTargets ?? [],
      referenceTarget: { stateCode: "TX", citySlug: "austin" },
      referenceJobId: "job-complete-austin",
      referenceWordpressObjectId: null,
    });

    expect(ensureDraftCampaignContinuationTarget({
      campaign,
      targetStateCode: "TX",
      targetCitySlug: "austin",
      referenceJobId: "job-complete-austin",
      referenceJobStatus: "CONTENT_READY",
      referenceWordpressObjectId: null,
    })).toBe(true);

    const before = listGlwCampaignTargets(campaign.campaignId).find((target) => target.citySlug === "austin");
    expect(before?.status).toBe("content_ready");

    const changed = reconcileReferenceTargetExecutionProjection({
      campaign,
      stateCode: "TX",
      citySlug: "austin",
      execution: {
        jobId: "job-complete-austin",
        status: "COMPLETE",
        externalExecutionId: "764956",
        wordpressObjectId: "13167",
        errorCode: null,
        errorMessage: null,
      },
    });

    const after = listGlwCampaignTargets(campaign.campaignId).find((target) => target.citySlug === "austin");
    expect(changed).toBe(true);
    expect(after?.status).toBe("draft_ready");
    expect(after?.jobId).toBe("job-complete-austin");
    expect(after?.wordpressObjectId).toBe("13167");
  });

  test("binds queued city reference target to RUNNING job when dispatch is accepted", () => {
    const campaign = activeSingleCityReferenceCampaign();
    initializeGlwCityCampaignTargets({
      campaignId: campaign.campaignId,
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
      cityTargets: campaign.cityTargets ?? [],
      referenceTarget: { stateCode: "TX", citySlug: "austin" },
      referenceJobId: null,
      referenceWordpressObjectId: null,
    });
    reconcileGlwReferenceTargetQueuedForProduction({
      campaignId: campaign.campaignId,
      stateCode: "TX",
      citySlug: "austin",
    });

    const changed = reconcileReferenceTargetExecutionProjection({
      campaign,
      stateCode: "TX",
      citySlug: "austin",
      execution: {
        jobId: "fresh-job-running",
        status: "RUNNING",
        externalExecutionId: "764950",
        wordpressObjectId: null,
        errorCode: null,
        errorMessage: null,
      },
    });

    const after = listGlwCampaignTargets(campaign.campaignId).find((target) => target.citySlug === "austin");
    expect(changed).toBe(true);
    expect(after?.status).toBe("running");
    expect(after?.jobId).toBe("fresh-job-running");
  });
});
