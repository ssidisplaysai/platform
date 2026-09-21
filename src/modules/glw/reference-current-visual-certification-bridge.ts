import "server-only";

export type ReferenceApprovalBridgeReviewModel = {
  identity: { campaignId: string };
  wordpress: { objectId: string | null };
  trace: { jobId: string };
  reviewState: "READY_FOR_OWNER_REVIEW" | "NEEDS_ATTENTION" | "REVIEW_BLOCKED" | "BLOCKED";
  productMediaQa: { state: "PASS" | "FAIL" };
  images: {
    productAuthority: { state: "ASSIGNED" | "RESOLVED_APPROVED" | "NOT_WIRED" };
    contextualInUse: { state: "GENERATED_CONTEXTUAL" | "ASSIGNED_FEATURED" | "LEGACY_FEATURED" | "MISSING" };
  };
  visualQa: {
    certificationState: "NOT_CERTIFIED" | "CURRENT" | "STALE";
    decisionState: "PENDING" | "CURRENT" | "STALE";
    overallState: "PASS" | "WARNING" | "BLOCKED" | "NOT_EVALUATED";
    decision: {
      decision: "PENDING" | "APPROVED" | "NEEDS_FIX" | "BLOCKED";
      pageRevisionIdentity: string;
      certificationId: string;
    } | null;
  };
};

export type ReferenceApprovalVisualCertificationBridgeResult = {
  ready: boolean;
  failedChecks: readonly string[];
};

export function evaluateReferenceApprovalVisualCertificationBridge(input: {
  campaignId: string;
  expectedJobId: string;
  expectedWordPressObjectId: string;
  expectedPageRevisionIdentity: string;
  reviewModel: ReferenceApprovalBridgeReviewModel | null;
}): ReferenceApprovalVisualCertificationBridgeResult {
  const checks: Array<{ id: string; ok: boolean }> = [];
  const model = input.reviewModel;

  checks.push({ id: "REVIEW_MODEL_REQUIRED", ok: Boolean(model) });
  if (!model) {
    return { ready: false, failedChecks: checks.map((check) => check.id) };
  }

  checks.push({ id: "CAMPAIGN_IDENTITY_MATCH", ok: model.identity.campaignId === input.campaignId });
  checks.push({ id: "JOB_IDENTITY_MATCH", ok: model.trace.jobId === input.expectedJobId });
  checks.push({ id: "WORDPRESS_IDENTITY_MATCH", ok: model.wordpress.objectId === input.expectedWordPressObjectId });
  checks.push({ id: "REVIEW_STATE_READY", ok: model.reviewState === "READY_FOR_OWNER_REVIEW" });
  checks.push({ id: "PRODUCT_MEDIA_QA_PASS", ok: model.productMediaQa.state === "PASS" });
  checks.push({ id: "PRODUCT_AUTHORITY_RESOLVED", ok: model.images.productAuthority.state === "ASSIGNED" || model.images.productAuthority.state === "RESOLVED_APPROVED" });
  checks.push({ id: "CONTEXTUAL_MEDIA_PRESENT", ok: model.images.contextualInUse.state !== "MISSING" });
  checks.push({ id: "RENDERED_CERT_CURRENT", ok: model.visualQa.certificationState === "CURRENT" });
  checks.push({ id: "RENDERED_OVERALL_PASS", ok: model.visualQa.overallState === "PASS" });
  checks.push({ id: "RENDERED_DECISION_CURRENT", ok: model.visualQa.decisionState === "CURRENT" });
  checks.push({ id: "RENDERED_DECISION_APPROVED", ok: model.visualQa.decision?.decision === "APPROVED" });
  checks.push({ id: "RENDERED_DECISION_PAGE_REVISION_MATCH", ok: model.visualQa.decision?.pageRevisionIdentity === input.expectedPageRevisionIdentity });
  checks.push({ id: "RENDERED_CERTIFICATION_ID_PRESENT", ok: Boolean(model.visualQa.decision?.certificationId) });

  const failedChecks = checks.filter((check) => !check.ok).map((check) => check.id);
  return {
    ready: failedChecks.length === 0,
    failedChecks,
  };
}
