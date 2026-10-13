import { NextRequest } from "next/server";

jest.mock("@/modules/glw/trusted-operator-principal", () => ({
  resolveGlwTrustedOperatorPrincipal: jest.fn(() => ({ ok: true, principal: { principalId: "owner", sessionId: "sess" } })),
}));

jest.mock("@/modules/foundation/api-auth", () => ({
  authorizeRequest: jest.fn(() => ({ ok: true })),
  hasOrganizationScope: jest.fn(() => true),
  resolveRequestScope: jest.fn(() => ({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production" })),
}));

jest.mock("@/modules/glw/campaign-repository", () => ({
  listGlwCampaigns: jest.fn(() => [{
    campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-outdoor-digital-sphere",
  }]),
}));

const abandon = jest.fn((input) => ({
  targetId: input.targetId,
  stateCode: input.stateCode,
  citySlug: input.citySlug ?? null,
  status: "queued",
  jobId: null,
  wordpressObjectId: null,
}));

jest.mock("@/modules/glw/campaign-target-repository", () => ({
  listGlwCampaignTargets: jest.fn(() => [{
    targetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-de",
    campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-outdoor-digital-sphere",
    stateCode: "DE",
    citySlug: null,
    cityName: null,
    status: "failed",
    jobId: "67b15376-563c-42b7-8fee-b2f2139b114b",
    wordpressObjectId: null,
    attemptCount: 1,
    lastError: "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED",
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
  }]),
  abandonGlwUnfinishedTargetAndRequeue: abandon,
}));

jest.mock("@/modules/glw/page-execution-repository", () => ({
  glwPageExecutionRepository: {
    getById: jest.fn(async () => ({
      jobId: "67b15376-563c-42b7-8fee-b2f2139b114b",
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      externalExecutionId: "686290",
    })),
  },
}));

import { POST } from "../route";

describe("governed reset and requeue route", () => {
  test("requeues exact unfinished target without dispatch or generation", async () => {
    const request = new NextRequest("http://localhost/api/glw/campaigns/campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview/governed-reset-requeue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        confirm: "ABANDON_UNFINISHED_TARGETS_AND_REQUEUE",
        operation: "ABANDON_UNFINISHED_TARGET_AND_REQUEUE",
        targets: [{
          targetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-de",
          stateCode: "DE",
          citySlug: null,
          expectedLifecycle: "FAILED",
          expectedJobId: "67b15376-563c-42b7-8fee-b2f2139b114b",
          expectedExecutionId: "686290",
          expectedWordpressObjectId: null,
        }],
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview" }) });
    expect(response.status).toBe(200);
    expect(abandon).toHaveBeenCalledWith({
      campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      targetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-de",
      stateCode: "DE",
      citySlug: null,
      expectedStatus: "failed",
      expectedJobId: "67b15376-563c-42b7-8fee-b2f2139b114b",
      expectedWordpressObjectId: null,
    });
    expect(await response.json()).toMatchObject({
      operation: "ABANDON_UNFINISHED_TARGET_AND_REQUEUE",
      resetCount: 1,
      dispatchPerformed: false,
      generationAttempted: false,
      publicationPerformed: false,
    });
  });
});
