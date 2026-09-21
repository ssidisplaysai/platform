jest.mock("server-only", () => ({}));

import {
  evaluateReferenceApprovalVisualCertificationBridge,
  type ReferenceApprovalBridgeReviewModel,
} from "../reference-current-visual-certification-bridge";

function model(overrides: Partial<ReferenceApprovalBridgeReviewModel> = {}): ReferenceApprovalBridgeReviewModel {
  return {
    identity: { campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2" },
    wordpress: { objectId: "20240" },
    trace: { jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb" },
    reviewState: "READY_FOR_OWNER_REVIEW",
    productMediaQa: { state: "PASS" },
    images: {
      productAuthority: { state: "RESOLVED_APPROVED" },
      contextualInUse: { state: "LEGACY_FEATURED" },
    },
    visualQa: {
      certificationState: "CURRENT",
      decisionState: "CURRENT",
      overallState: "PASS",
      decision: {
        decision: "APPROVED",
        pageRevisionIdentity: "job:a1371f29-8952-438d-9ed4-583da68d4fbb:2026-09-20T23:48:50.824Z",
        certificationId: "visual-certification-799a467e-286c-49cf-8519-8cb382605f1e",
      },
    },
    ...overrides,
  };
}

function evaluate(reviewModel: ReferenceApprovalBridgeReviewModel | null) {
  return evaluateReferenceApprovalVisualCertificationBridge({
    campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2",
    expectedJobId: "a1371f29-8952-438d-9ed4-583da68d4fbb",
    expectedWordPressObjectId: "20240",
    expectedPageRevisionIdentity: "job:a1371f29-8952-438d-9ed4-583da68d4fbb:2026-09-20T23:48:50.824Z",
    reviewModel,
  });
}

describe("current visual certification bridge", () => {
  test("current PASS + APPROVED rendered certification satisfies reference owner review bridge", () => {
    const result = evaluate(model());
    expect(result.ready).toBe(true);
    expect(result.failedChecks).toEqual([]);
  });

  test("stale certification is blocked", () => {
    const result = evaluate(model({
      visualQa: {
        certificationState: "STALE",
        decisionState: "CURRENT",
        overallState: "PASS",
        decision: {
          decision: "APPROVED",
          pageRevisionIdentity: "job:a1371f29-8952-438d-9ed4-583da68d4fbb:2026-09-20T23:48:50.824Z",
          certificationId: "visual-certification-799a467e-286c-49cf-8519-8cb382605f1e",
        },
      },
    }));
    expect(result.ready).toBe(false);
    expect(result.failedChecks).toContain("RENDERED_CERT_CURRENT");
  });

  test("NEEDS_FIX decision is blocked", () => {
    const result = evaluate(model({
      visualQa: {
        certificationState: "CURRENT",
        decisionState: "CURRENT",
        overallState: "PASS",
        decision: {
          decision: "NEEDS_FIX",
          pageRevisionIdentity: "job:a1371f29-8952-438d-9ed4-583da68d4fbb:2026-09-20T23:48:50.824Z",
          certificationId: "visual-certification-799a467e-286c-49cf-8519-8cb382605f1e",
        },
      },
    }));
    expect(result.ready).toBe(false);
    expect(result.failedChecks).toContain("RENDERED_DECISION_APPROVED");
  });

  test("PENDING decision state is blocked", () => {
    const result = evaluate(model({
      visualQa: {
        certificationState: "CURRENT",
        decisionState: "PENDING",
        overallState: "PASS",
        decision: {
          decision: "PENDING",
          pageRevisionIdentity: "job:a1371f29-8952-438d-9ed4-583da68d4fbb:2026-09-20T23:48:50.824Z",
          certificationId: "visual-certification-799a467e-286c-49cf-8519-8cb382605f1e",
        },
      },
    }));
    expect(result.ready).toBe(false);
    expect(result.failedChecks).toContain("RENDERED_DECISION_CURRENT");
  });

  test("wrong job/wordpress identity is blocked", () => {
    const result = evaluate(model({
      trace: { jobId: "other-job" },
      wordpress: { objectId: "99999" },
    }));
    expect(result.ready).toBe(false);
    expect(result.failedChecks).toContain("JOB_IDENTITY_MATCH");
    expect(result.failedChecks).toContain("WORDPRESS_IDENTITY_MATCH");
  });

  test("current product/media authority requirements remain enforced", () => {
    const result = evaluate(model({
      productMediaQa: { state: "FAIL" },
      images: {
        productAuthority: { state: "NOT_WIRED" },
        contextualInUse: { state: "MISSING" },
      },
    }));
    expect(result.ready).toBe(false);
    expect(result.failedChecks).toContain("PRODUCT_MEDIA_QA_PASS");
    expect(result.failedChecks).toContain("PRODUCT_AUTHORITY_RESOLVED");
    expect(result.failedChecks).toContain("CONTEXTUAL_MEDIA_PRESENT");
  });
});
