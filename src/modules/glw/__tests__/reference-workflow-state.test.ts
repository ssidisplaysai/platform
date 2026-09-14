import fs from "node:fs";
import path from "node:path";
import type { GlwCampaign } from "../campaign-types";
import type { GlwPageExecutionRecord } from "../page-execution";
import {
  findEvidenceBoundLegacyReferenceJob,
  projectGlwReferenceWorkflow,
} from "../reference-workflow-state";

const campaign = {
  campaignId: "campaign-outdoor",
  organizationId: "led-display-warehouse",
  siteId: "site-led-display-warehouse-production",
  productId: "prod-outdoor-digital-sphere",
  stateCodes: ["IL", "IN"],
  createdAt: "2026-09-11T08:27:18.082Z",
} as GlwCampaign;
const failedJob = {
  jobId: "job-il",
  correlationId: "job-il",
  campaignId: null,
  organizationId: campaign.organizationId,
  siteId: campaign.siteId,
  productId: campaign.productId,
  state: "Illinois",
  city: null,
  status: "FAILED",
  errorCode: "GENERATED_CONTENT_QA_FAILED",
  errorMessage: "State product authority link is missing.",
  qaFailureReasons: {
    stateProductAuthorityLink:
      "State pages must link Outdoor Digital Sphere to /outdoor-digital-sphere/.",
  },
  generatedDraft: {
    title: "Outdoor Digital Sphere in Illinois",
    contentHtml: "<h1>Outdoor Digital Sphere in Illinois</h1>",
    slug: "outdoor-digital-sphere/illinois",
    excerpt: null,
    seoTitle: null,
    metaDescription: null,
    focusKeyphrase: null,
  },
  createdAt: "2026-09-14T21:33:29.878Z",
  updatedAt: "2026-09-14T21:34:34.294Z",
} as GlwPageExecutionRecord;

describe("GLW reference workflow projection", () => {
  test("projects no job as ready without inventing durable state", () => {
    expect(projectGlwReferenceWorkflow(null)).toMatchObject({
      state: "READY_TO_GENERATE_REFERENCE",
      operationId: null,
      durable: false,
      safeOwnerAction: "GENERATE_REFERENCE",
    });
  });

  test("projects the failed existing operation with a no-retry action", () => {
    expect(projectGlwReferenceWorkflow(failedJob)).toMatchObject({
      state: "REFERENCE_BLOCKED",
      operationId: "job-il",
      targetStateCode: "IL",
      durable: true,
      safeOwnerAction: "DO_NOT_RETRY_ESCALATE",
      qaFailures: [
        expect.objectContaining({
          predicateId: "stateProductAuthorityLink",
          severity: "BLOCKING",
        }),
      ],
      proposedRecoveryAction: "REQUEST_NEW_EXACT_RETRY_AUTHORIZATION_AFTER_QA_REPAIR",
    });
  });

  test("distinguishes running, content-ready, and completed operations", () => {
    expect(projectGlwReferenceWorkflow({ ...failedJob, status: "RUNNING" })).toMatchObject({ state: "REFERENCE_GENERATION_IN_PROGRESS", safeOwnerAction: "WAIT_FOR_EXISTING_GENERATION" });
    expect(projectGlwReferenceWorkflow({ ...failedJob, status: "CONTENT_READY" })).toMatchObject({ state: "REFERENCE_RECOVERY_REQUIRED", safeOwnerAction: "CONTINUE_EXISTING_REFERENCE" });
    expect(projectGlwReferenceWorkflow({ ...failedJob, status: "COMPLETE" })).toMatchObject({ state: "REFERENCE_DRAFT_READY", safeOwnerAction: "OPEN_REFERENCE_DRAFT_FOR_REVIEW" });
  });

  test("recovers an unlinked job only when campaign ownership is unique", () => {
    expect(findEvidenceBoundLegacyReferenceJob({ campaign, campaigns: [campaign], records: [failedJob] })?.jobId).toBe("job-il");
    expect(findEvidenceBoundLegacyReferenceJob({ campaign, campaigns: [campaign, { ...campaign, campaignId: "other" }], records: [failedJob] })).toBeNull();
    expect(findEvidenceBoundLegacyReferenceJob({ campaign, campaigns: [campaign], records: [{ ...failedJob, state: "Ohio" }] })).toBeNull();
  });
});

const execution = fs.readFileSync(path.join(process.cwd(), "src/modules/glw/page-execution.ts"), "utf8").replace(/\s/g, "");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-page/route.ts"), "utf8").replace(/\s/g, "");
const ui = fs.readFileSync(path.join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8").replace(/\s/g, "");

describe("GLW reference recovery contract", () => {
  test("future jobs persist campaign identity and legacy jobs are projected read-only", () => {
    expect(execution).toContain("campaignId:request.campaignId??null");
    expect(route).toContain("findEvidenceBoundLegacyReferenceJob");
    expect(route).toContain('attribution:"UNIQUE_CAMPAIGN_SITE_PRODUCT_RECOVERY"');
  });

  test("operator UI exposes exact state and blocks duplicate generation", () => {
    for (const marker of ["REFERENCE_BLOCKED", "Operation:", "Lastupdate:", "Safeowneraction:", "Expected:", "Observed:", "Evidence:", "Proposedrecovery:", "existingOperationBlocksGeneration", "projectedReferenceState.current===referenceState", "StartingReferenceGeneration...", "CheckingExistingReference..."])
      expect(ui).toContain(marker);
    expect(ui).not.toContain('generationBusy?"RecoveringReference..."');
  });
});
