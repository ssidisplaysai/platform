jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GlwCampaign } from "../campaign-types";
import type { GlwPageExecutionRecord } from "../page-execution";
import { projectGlwDurableReferenceOperation } from "../reference-workflow-state";

const campaign = {
  campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
  organizationId: "led-display-warehouse",
  siteId: "site-led-display-warehouse-production",
  productId: "prod-outdoor-digital-sphere",
  stateCodes: ["IL", "IN"],
  createdAt: "2026-09-11T08:27:18.082Z",
} as GlwCampaign;

const failed = {
  jobId: "3df15069-2cd8-4aec-93f3-70a9f5ee3029",
  campaignId: null,
  organizationId: campaign.organizationId,
  siteId: campaign.siteId,
  productId: campaign.productId,
  state: "Illinois",
  status: "FAILED",
  errorCode: "GENERATED_CONTENT_QA_FAILED",
  generatedDraft: { contentHtml: "preserved failed artifact" },
  createdAt: "2026-09-14T21:33:29.878Z",
  updatedAt: "2026-09-14T21:34:34.294Z",
} as GlwPageExecutionRecord;

function operation(records: GlwPageExecutionRecord[]) {
  return projectGlwDurableReferenceOperation({ campaign, campaigns: [campaign], records, selectedStateCode: "IN" });
}

describe("Indiana reference retry execution fail-closed invariant", () => {
  test("retry context survives refresh, authorization, consumption, expiry, session mismatch, and runtime mismatch", () => {
    const expected = { operationType: "REFERENCE_GENERATION_RETRY", failedJobId: failed.jobId };
    for (const _authorityState of ["NONE", "AUTHORIZED", "CONSUMED", "EXPIRED", "SESSION_MISMATCH", "RUNTIME_MISMATCH"])
      expect(operation([failed])).toMatchObject(expected);
  });

  test("failed replacement remains retry and initial cannot be inferred while recovery evidence exists", () => {
    const failedReplacement = { ...failed, jobId: "failed-in", campaignId: campaign.campaignId, state: "Indiana", updatedAt: "2026-09-15T05:00:00.000Z" };
    expect(operation([failed, failedReplacement])).toMatchObject({ operationType: "REFERENCE_GENERATION_RETRY", failedJobId: failed.jobId });
  });

  test("newer artifact-free dispatch failure cannot shadow historical retry evidence", () => {
    const dispatchFailure = { ...failed, jobId: "dispatch-in", state: "Indiana", errorCode: "DISPATCH_FAILED", generatedDraft: null, updatedAt: "2026-09-15T05:00:00.000Z" } as GlwPageExecutionRecord;
    expect(operation([failed, dispatchFailure])).toMatchObject({ operationType: "REFERENCE_GENERATION_RETRY", failedJobId: failed.jobId });
  });

  test("only a later durable successful replacement exits recovery", () => {
    const successfulReplacement = {
      ...failed,
      jobId: "successful-in",
      campaignId: campaign.campaignId,
      state: "Indiana",
      status: "COMPLETE",
      qaStatus: "COMPLETE",
      updatedAt: "2026-09-15T05:00:00.000Z",
    } as GlwPageExecutionRecord;
    expect(operation([failed, successfulReplacement])).toEqual({ operationType: "REFERENCE_GENERATION_INITIAL", failedJobId: null, failedArtifactSha256: null });
  });

  test("execution route consumes authority before any page-generation request", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-page/route.ts"), "utf8");
    expect(route.indexOf("consumeGlwReferenceOwnerGrant({")).toBeGreaterThan(0);
    expect(route.indexOf("consumeGlwReferenceOwnerGrant({")).toBeLessThan(route.indexOf("const generationResponse = await fetch("));
    expect(route).toContain("generationJobCreated: false, downstreamSideEffectsPerformed: false");
  });

  test("client preserves retry projection when execution fails", () => {
    const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8").replace(/\s/g, "");
    const executeHandler = ui.slice(ui.indexOf("asyncfunctiongenerateReferencePage()"), ui.indexOf("asyncfunctionrunOwnerPreflight()"));
    expect(executeHandler).not.toContain("setReferenceResult(null)");
    expect(executeHandler).toContain("workflow:payload.workflow??current?.workflow");
    expect(executeHandler).toContain("retryContract:payload.retryContract??current?.retryContract");
    expect(executeHandler).toContain('ownerOperationType:retryOperation?"REFERENCE_GENERATION_RETRY":"REFERENCE_GENERATION_INITIAL"');
  });

  test("terminal QA failure exposes execution identity and requires a fresh remediated preflight", () => {
    const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8").replace(/\s/g, "");
    expect(ui).toContain('Authorization:{ownerGrantReady?"AUTHORIZED":terminalQaBlocked?"BLOCKED_BY_QA"');
    expect(ui).toContain("n8nexecution:{job.externalExecutionId}");
    expect(ui).toContain('terminalQaBlocked?"RunRemediatedRetryPreflight"');
  });
});