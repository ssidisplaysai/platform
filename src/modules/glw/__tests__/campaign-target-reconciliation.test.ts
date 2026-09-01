jest.mock("server-only", () => ({}));

import {
  resolveGlwCampaignJobReconciliationDecision,
  resolveGlwCampaignTargetRecoveryAction,
} from "@/modules/glw/campaign-target-reconciliation";

function runningTarget(
  overrides: Partial<{
    jobId: string | null;
    dispatchDate: string | null;
    leaseId: string | null;
  }> = {},
) {
  return {
    targetId: "target-campaign-1-fl",
    campaignId: "campaign-1",
    organizationId: "org-1",
    siteId: "site-1",
    productId: "product-1",
    stateCode: "FL",
    status: "running" as const,
    jobId:
      overrides.jobId === undefined
        ? "job-1"
        : overrides.jobId,
    wordpressObjectId: null,
    attemptCount: 1,
    lastError: null,
    dispatchDate:
      overrides.dispatchDate === undefined
        ? "2026-08-31"
        : overrides.dispatchDate,
    leaseId:
      overrides.leaseId === undefined
        ? "lease-1"
        : overrides.leaseId,
    leasedAt: "2026-08-31T20:00:00.000Z",
    leaseExpiresAt: "2026-08-31T21:00:00.000Z",
    createdAt: "2026-08-31T20:00:00.000Z",
    updatedAt: "2026-08-31T20:00:00.000Z",
  };
}

describe("GLW campaign target reconciliation", () => {
  test("job-bearing running target recovers exact job", () => {
    expect(
      resolveGlwCampaignTargetRecoveryAction(
        runningTarget(),
      ),
    ).toBe("recover_exact_job");
  });

  test("no-job dispatched target resumes exact target", () => {
    expect(
      resolveGlwCampaignTargetRecoveryAction(
        runningTarget({
          jobId: null,
        }),
      ),
    ).toBe("resume_exact_target");
  });

  test("content-ready requires exact continuation", () => {
    expect(
      resolveGlwCampaignJobReconciliationDecision({
        status: "CONTENT_READY",
      }),
    ).toEqual({
      action: "continue",
    });
  });

  test("complete verified draft becomes draft-ready", () => {
    expect(
      resolveGlwCampaignJobReconciliationDecision({
        status: "COMPLETE",
        wordpressObjectId: "19817",
        wordpressStatus: "draft",
      }),
    ).toEqual({
      action: "draft_ready",
      wordpressObjectId: "19817",
    });
  });

  test("numeric WordPress IDs normalize to canonical string", () => {
    expect(
      resolveGlwCampaignJobReconciliationDecision({
        status: "COMPLETE",
        wordpressObjectId: 19817,
        wordpressStatus: "draft",
      }),
    ).toEqual({
      action: "draft_ready",
      wordpressObjectId: "19817",
    });
  });

  test("published result fails closed", () => {
    expect(
      resolveGlwCampaignJobReconciliationDecision({
        status: "COMPLETE",
        wordpressObjectId: "19817",
        wordpressStatus: "publish",
      }),
    ).toEqual({
      action: "failed",
      error:
        "Completed generation did not resolve to a verified WordPress draft.",
    });
  });

  test("complete result without WordPress ID fails closed", () => {
    expect(
      resolveGlwCampaignJobReconciliationDecision({
        status: "COMPLETE",
        wordpressObjectId: null,
        wordpressStatus: "draft",
      }),
    ).toEqual({
      action: "failed",
      error:
        "Completed generation did not resolve to a verified WordPress draft.",
    });
  });

  test("failed generation synchronizes failure", () => {
    expect(
      resolveGlwCampaignJobReconciliationDecision({
        status: "FAILED",
        error: "Generation failed upstream.",
      }),
    ).toEqual({
      action: "failed",
      error: "Generation failed upstream.",
    });
  });

  test("running generation waits", () => {
    expect(
      resolveGlwCampaignJobReconciliationDecision({
        status: "RUNNING",
      }),
    ).toEqual({
      action: "wait",
    });
  });
});