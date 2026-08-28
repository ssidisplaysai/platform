import {
  createCampaignApproval,
  validateCampaignApproval,
} from "@/modules/foundation/campaign-approval";
import {
  completeCampaignPreflight,
  createCampaignPlan,
  type CampaignTargetPreflightResult,
} from "@/modules/foundation/campaign-plan";
import {
  CampaignDispatchRejectedError,
  createCampaignExecutionPlan,
  createCampaignTargetExecutionRecords,
  createExecutionIdempotencyKey,
  projectApprovedTargetToGlwRequest,
  projectGlwTerminalExecution,
  summarizeCampaignExecution,
} from "@/modules/foundation/campaign-execution";
import {
  cancelPendingCampaignExecution,
  checkpointCampaignExecution,
  createCampaignExecutionRecordSet,
  getCampaignApprovalRecord,
  getCampaignExecutionPersistenceReplacementCount,
  resetCampaignExecutionRepositoryForTests,
  resumeCampaignExecution,
} from "@/modules/foundation/campaign-execution-repository";
import {
  createExistingGlwCampaignDispatcher,
  executeApprovedCampaign,
  type CampaignGlwDispatcher,
} from "@/modules/foundation/campaign-execution-service";
import { GLW_PRODUCT_PAGE_BLUEPRINT } from "@/modules/foundation/page-blueprint";
import { buildTargetMatrixPreview, type TargetMatrix } from "@/modules/foundation/target-matrix";
import type { ProductPlanningCandidate, ResolvedOperatorTargetSelection } from "@/modules/foundation/target-selection-resolution";
import type { GlwPageExecutionRecord, GlwPageExecutionStatus } from "@/modules/glw/page-execution";

const ORGANIZATION_ID = "led-display-warehouse";
const SITE_ID = "site-led-display-warehouse-production";
const CHECKED_AT = "2026-08-27T01:00:00.000Z";
const EXECUTION_AT = "2026-08-27T01:05:00.000Z";

function matrix(targetCount: number): TargetMatrix {
  const products = Array.from({ length: targetCount }, (_, index): ProductPlanningCandidate => ({
    productFamilyId: "family-standard-dvled",
    productId: `execution-product-${index}`,
    variantId: null,
    applicationProductSlug: `execution-product-${index}`,
    canonicalProductSlug: `canonical-product-${index}`,
    organizationId: ORGANIZATION_ID,
    siteIds: [SITE_ID],
    eligible: true,
    reviewRequired: false,
    sourceAuthority: "CERTIFIED_RECONCILIATION_PLAN",
  }));
  const resolved: ResolvedOperatorTargetSelection = {
    selection: {
      selectionId: `execution-selection-${targetCount}`,
      organizationId: ORGANIZATION_ID,
      siteId: SITE_ID,
      pageBlueprintIds: [GLW_PRODUCT_PAGE_BLUEPRINT.pageBlueprintId],
      productSelection: { mode: "ALL_ELIGIBLE", values: [] },
      variantSelection: { mode: "ALL_ELIGIBLE", values: [] },
      stateSelection: { mode: "ONE", values: ["TX"] },
      citySelection: { mode: "ONE", values: [{ stateCode: "TX", citySlug: "austin" }] },
      catalogAuthority: "CERTIFIED_RECONCILIATION_PLAN",
      catalogRevisionId: null,
      reconciliationPlanFingerprint: "certified-plan",
      createdBy: "operator",
      createdAt: CHECKED_AT,
      selectionSource: "002d-test",
      notes: null,
    },
    blueprints: [GLW_PRODUCT_PAGE_BLUEPRINT],
    products,
    variants: [],
    states: [{ code: "TX", name: "Texas", slug: "texas" }],
    cities: [],
    filters: [],
    sourceProvenance: {
      catalogAuthority: "CERTIFIED_RECONCILIATION_PLAN",
      catalogRevisionId: null,
      reconciliationPlanFingerprint: "certified-plan",
      selectionSource: "002d-test",
    },
  };
  return buildTargetMatrixPreview({ resolved, now: CHECKED_AT });
}

function preflightResult(
  target: TargetMatrix["targets"][number],
  operation: "CREATE" | "EXACT_UPDATE" | "NO_ACTION" | "REVIEW_REQUIRED" | "BLOCKED",
): CampaignTargetPreflightResult {
  const create = operation === "CREATE";
  const update = operation === "EXACT_UPDATE";
  const published = operation === "NO_ACTION";
  const blocked = operation === "BLOCKED";
  return {
    campaignId: "pending",
    targetId: target.targetId,
    pageBlueprintId: target.pageBlueprintId,
    productId: target.subject.productId,
    stateCode: target.geography.stateCode,
    targetState: create ? "ABSENT" : update ? "EXISTS_DRAFT" : published ? "EXISTS_PUBLISHED" : blocked ? "BLOCKED" : "UNKNOWN",
    eligibility: create ? "ELIGIBLE_CREATE" : update ? "ELIGIBLE_UPDATE" : published ? "NOT_ELIGIBLE_PUBLISHED" : blocked ? "NOT_ELIGIBLE_POLICY" : "UNKNOWN_REQUIRES_PREFLIGHT",
    plannedOperation: operation,
    wordpressObjectId: update || published ? `wp-${target.targetId}` : null,
    wordpressStatus: update ? "draft" : published ? "publish" : null,
    wordpressUrl: update || published ? `https://example.test/${target.targetId}` : null,
    wordpressTitle: null,
    canonicalPath: target.canonicalPath,
    applicationPath: target.applicationPath,
    canonicalParentId: null,
    reasonCodes: create ? ["EXACT_ABSENCE_CONFIRMED"] : update ? ["EXACT_DRAFT_FOUND"] : published ? ["PUBLISHED_UPDATE_NOT_AUTHORIZED"] : blocked ? ["TARGET_POLICY_BLOCK"] : ["PRIVATE_ABSENCE_UNPROVEN"],
    attemptCount: 1,
    checkedAt: CHECKED_AT,
    preflightPolicyVersion: "1.0.0",
  };
}

function readyCampaign(input: {
  targetCount: number;
  createCount?: number;
  unsafeOperation?: "NO_ACTION" | "REVIEW_REQUIRED" | "BLOCKED";
}) {
  const targetMatrix = matrix(input.targetCount);
  const draft = createCampaignPlan({
    matrix: targetMatrix,
    organizationId: ORGANIZATION_ID,
    siteId: SITE_ID,
    name: "Execution certification",
    createdBy: "operator",
    createdAt: CHECKED_AT,
  });
  const results = targetMatrix.targets.map((target, index) => {
    const operation = input.unsafeOperation ?? (index < (input.createCount ?? input.targetCount) ? "CREATE" : "EXACT_UPDATE");
    return { ...preflightResult(target, operation), campaignId: draft.campaignId };
  });
  const campaign = completeCampaignPreflight({ campaign: draft, matrix: targetMatrix, results });
  return { matrix: targetMatrix, campaign };
}

function approvedExecution(targetCount: number, createCount = targetCount) {
  const { matrix: targetMatrix, campaign } = readyCampaign({ targetCount, createCount });
  const approval = createCampaignApproval({ campaign, approvedBy: "operator", approvedAt: EXECUTION_AT });
  const plan = createCampaignExecutionPlan({ campaign, approval, now: EXECUTION_AT, dispatchPacingMs: 0 });
  return { matrix: targetMatrix, campaign, approval, plan, now: () => EXECUTION_AT };
}

function glwRecord(input: {
  request: Parameters<CampaignGlwDispatcher>[0]["request"];
  targetId: string;
  status?: GlwPageExecutionStatus;
  errorCode?: string | null;
}): GlwPageExecutionRecord {
  const status = input.status ?? "COMPLETE";
  return {
    jobId: `job-${input.targetId}`,
    correlationId: `job-${input.targetId}`,
    executionTransport: "N8N_MCP",
    organizationId: input.request.organizationId,
    siteId: input.request.siteId,
    productId: input.request.productId,
    productTopic: input.request.productTopic,
    state: input.request.stateName,
    city: input.request.cityName,
    slug: input.request.canonicalPath,
    title: input.request.title,
    seoTitle: input.request.seoTitle,
    metaDescription: input.request.metaDescription,
    publicationIntent: "draft",
    status,
    externalExecutionId: `n8n-${input.targetId}`,
    wordpressObjectId: status === "COMPLETE" ? `wp-${input.targetId}` : null,
    wordpressUrl: status === "COMPLETE" ? `https://example.test/${input.targetId}` : null,
    wordpressStatus: status === "COMPLETE" ? "draft" : null,
    errorCode: input.errorCode ?? (status === "FAILED" ? "GLW_FAILED" : null),
    errorMessage: status === "FAILED" ? "Synthetic terminal failure" : null,
    requestedPublicationMode: "draft",
    disposition: status === "COMPLETE" ? "CREATED" : null,
    qaStatus: status === "COMPLETE" ? "COMPLETE" : input.errorCode === "FAILED_QA" ? "FAILED_QA" : null,
    qaChecks: status === "COMPLETE" ? { passed: true } : null,
    qaFailureReasons: null,
    focusKeyphrase: null,
    wordCount: status === "COMPLETE" ? 1000 : null,
    featuredImagePresent: status === "COMPLETE" ? true : null,
    createdAt: EXECUTION_AT,
    dispatchedAt: EXECUTION_AT,
    updatedAt: EXECUTION_AT,
    completedAt: status === "COMPLETE" || status === "FAILED" ? EXECUTION_AT : null,
  };
}

const successDispatcher: CampaignGlwDispatcher = async ({ request, targetId }) => glwRecord({ request, targetId });

describe("002D explicit campaign approval", () => {
  test("1. execution plan requires explicit approval", () => {
    const { campaign } = readyCampaign({ targetCount: 1 });
    expect(() => createCampaignExecutionPlan({ campaign, approval: undefined as never, now: EXECUTION_AT })).toThrow();
  });

  test("2. approved subset is exact and exclusions remain visible", () => {
    const { matrix: targetMatrix, campaign } = readyCampaign({ targetCount: 3 });
    const approval = createCampaignApproval({ campaign, approvedTargetIds: campaign.targetIds.slice(0, 2), approvedBy: "operator", approvedAt: EXECUTION_AT });
    expect(approval.approvedTargetIds).toHaveLength(2);
    expect(approval.excludedTargetIds).toHaveLength(1);
    expect(approval.matrixFingerprint).toBe(targetMatrix.fingerprint);
  });

  test.each(["NO_ACTION", "REVIEW_REQUIRED", "BLOCKED"] as const)("3. unsafe %s target cannot be approved", (unsafeOperation) => {
    const { campaign } = readyCampaign({ targetCount: 1, unsafeOperation });
    expect(() => createCampaignApproval({ campaign: { ...campaign, status: "READY_FOR_APPROVAL" }, approvedBy: "operator", approvedAt: EXECUTION_AT })).toThrow();
  });

  test("4. approval fingerprint is deterministic and excludes timestamps", () => {
    const { campaign } = readyCampaign({ targetCount: 2 });
    const first = createCampaignApproval({ campaign, approvedBy: "first", approvedAt: EXECUTION_AT });
    const second = createCampaignApproval({ campaign, approvedBy: "second", approvedAt: "2026-08-27T01:06:00.000Z" });
    expect(second.approvalFingerprint).toBe(first.approvalFingerprint);
  });

  test("5. target or operation tampering invalidates approval", () => {
    const { campaign } = readyCampaign({ targetCount: 2 });
    const approval = createCampaignApproval({ campaign, approvedBy: "operator", approvedAt: EXECUTION_AT });
    expect(() => validateCampaignApproval({ campaign, approval: { ...approval, approvedOperations: { ...approval.approvedOperations, [approval.approvedTargetIds[0]]: "EXACT_UPDATE" } }, now: EXECUTION_AT })).toThrow("fingerprint is invalid");
  });

  test("6. expired preflight blocks approval before dispatch", () => {
    const { campaign } = readyCampaign({ targetCount: 1 });
    expect(() => createCampaignApproval({ campaign, approvedBy: "operator", approvedAt: "2026-08-27T01:31:00.000Z" })).toThrow("preflight is stale");
  });

  test("7. draft-only approval rejects publication tampering", () => {
    const { campaign } = readyCampaign({ targetCount: 1 });
    expect(() => createCampaignApproval({ campaign: { ...campaign, publicationIntent: "publish" } as never, approvedBy: "operator", approvedAt: EXECUTION_AT })).toThrow("draft-only");
  });
});

describe("002D exact request projection and terminal authority", () => {
  test("8. ABSENT projects exact CREATE with no update ID", () => {
    const input = approvedExecution(1);
    expect(projectApprovedTargetToGlwRequest({ ...input, targetId: input.plan.targetIds[0], now: EXECUTION_AT })).toMatchObject({ publicationIntent: "draft", plannedOperation: "CREATE_GENERAL", wordpressObjectId: null });
  });

  test("9. exact draft projects UPDATE with the preflight WordPress ID", () => {
    const input = approvedExecution(1, 0);
    const targetId = input.plan.targetIds[0];
    expect(projectApprovedTargetToGlwRequest({ ...input, targetId, now: EXECUTION_AT })).toMatchObject({ plannedOperation: "UPDATE_GENERAL", wordpressObjectId: `wp-${targetId}` });
  });

  test("10. exact update without WordPress ID fails approval", () => {
    const { campaign } = readyCampaign({ targetCount: 1, createCount: 0 });
    const unsafe = { ...campaign, preflightResults: campaign.preflightResults.map((result) => ({ ...result, wordpressObjectId: null })) };
    expect(() => createCampaignApproval({ campaign: unsafe, approvedBy: "operator", approvedAt: EXECUTION_AT })).toThrow(/executable target/);
  });

  test("11. dispatch acceptance is not success", () => {
    const input = approvedExecution(1);
    const record = createCampaignTargetExecutionRecords({ plan: input.plan, matrix: input.matrix })[0];
    const request = projectApprovedTargetToGlwRequest({ ...input, targetId: record.targetId, now: EXECUTION_AT });
    expect(projectGlwTerminalExecution({ record, glw: glwRecord({ request, targetId: record.targetId, status: "DISPATCHED" }), now: EXECUTION_AT }).status).toBe("DISPATCHED");
  });

  test("12. only terminal GLW success with QA and draft identity succeeds", () => {
    const input = approvedExecution(1);
    const record = createCampaignTargetExecutionRecords({ plan: input.plan, matrix: input.matrix })[0];
    const request = projectApprovedTargetToGlwRequest({ ...input, targetId: record.targetId, now: EXECUTION_AT });
    expect(projectGlwTerminalExecution({ record, glw: glwRecord({ request, targetId: record.targetId }), now: EXECUTION_AT })).toMatchObject({ status: "SUCCEEDED", qaStatus: "COMPLETE", wordpressStatus: "draft" });
  });

  test("13. QA failure requires review and is never success", () => {
    const input = approvedExecution(1);
    const record = createCampaignTargetExecutionRecords({ plan: input.plan, matrix: input.matrix })[0];
    const request = projectApprovedTargetToGlwRequest({ ...input, targetId: record.targetId, now: EXECUTION_AT });
    expect(projectGlwTerminalExecution({ record, glw: glwRecord({ request, targetId: record.targetId, status: "FAILED", errorCode: "FAILED_QA" }), now: EXECUTION_AT })).toMatchObject({ status: "RETRY_REVIEW_REQUIRED", failureClass: "QA_FAILURE", requiresReview: true });
  });

  test("14. existing GLW service adapter preserves one-job ownership", async () => {
    const execute = jest.fn(async (request) => glwRecord({ request, targetId: "adapter" }));
    const dispatcher = createExistingGlwCampaignDispatcher({ execute });
    const input = approvedExecution(1);
    const request = projectApprovedTargetToGlwRequest({ ...input, targetId: input.plan.targetIds[0], now: EXECUTION_AT });
    expect((await dispatcher({ request, idempotencyKey: "key", campaignId: input.campaign.campaignId, executionPlanId: input.plan.executionPlanId, targetId: input.plan.targetIds[0] })).jobId).toBe("job-adapter");
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("002D bounded synthetic execution", () => {
  beforeEach(() => resetCampaignExecutionRepositoryForTests());

  test("15. 20 approved targets isolate 17 success, 2 terminal failures, and 1 ambiguous dispatch", async () => {
    const input = approvedExecution(20, 12);
    const index = new Map(input.plan.targetIds.map((targetId, position) => [targetId, position]));
    const dispatcher: CampaignGlwDispatcher = async ({ request, targetId }) => {
      const position = index.get(targetId)!;
      if (position === 19) throw new Error("ambiguous acknowledgement");
      return glwRecord({ request, targetId, status: position >= 17 ? "FAILED" : "COMPLETE" });
    };
    const run = await executeApprovedCampaign({ ...input, dispatcher, delay: async () => {} });
    expect(run.summary).toMatchObject({ approved: 20, succeeded: 17, reviewRequired: 3, createSuccessCount: 12, exactUpdateSuccessCount: 5 });
    expect(run.metrics.dispatchedCount).toBe(20);
    expect(run.plan.status).toBe("FAILED");
  });

  test("16. observed execution concurrency never exceeds two", async () => {
    const input = approvedExecution(20);
    let inFlight = 0;
    let observed = 0;
    const dispatcher: CampaignGlwDispatcher = async ({ request, targetId }) => {
      inFlight += 1;
      observed = Math.max(observed, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return glwRecord({ request, targetId });
    };
    const run = await executeApprovedCampaign({ ...input, dispatcher, delay: async () => {} });
    expect(observed).toBeLessThanOrEqual(2);
    expect(run.metrics.observedMaximumInFlight).toBeLessThanOrEqual(2);
  });

  test("17. campaign target and GLW job remain correlated", async () => {
    const input = approvedExecution(1);
    const run = await executeApprovedCampaign({ ...input, dispatcher: successDispatcher, delay: async () => {} });
    expect(run.records[0]).toMatchObject({ campaignId: input.campaign.campaignId, executionPlanId: input.plan.executionPlanId, targetId: input.plan.targetIds[0], glwJobId: `job-${input.plan.targetIds[0]}` });
    expect(getCampaignApprovalRecord(input.approval.approvalFingerprint)).toEqual(input.approval);
  });

  test("18. idempotency key is deterministic by approved operation", () => {
    const values = { campaignFingerprint: "campaign", approvalFingerprint: "approval", targetId: "target", operation: "CREATE" as const };
    expect(createExecutionIdempotencyKey(values)).toBe(createExecutionIdempotencyKey(values));
    expect(createExecutionIdempotencyKey({ ...values, operation: "EXACT_UPDATE" })).not.toBe(createExecutionIdempotencyKey(values));
  });

  test("19. successful records are never redispatched", async () => {
    const input = approvedExecution(5);
    const dispatcher = jest.fn(successDispatcher);
    const first = await executeApprovedCampaign({ ...input, dispatcher, delay: async () => {} });
    expect(first.summary.succeeded).toBe(5);
    const second = await executeApprovedCampaign({ ...input, dispatcher, delay: async () => {} });
    expect(second.metrics.dispatchedCount).toBe(0);
    expect(dispatcher).toHaveBeenCalledTimes(5);
  });

  test("20. failed and ambiguous records receive no automatic retry", async () => {
    const input = approvedExecution(2);
    const dispatcher = jest.fn(async ({ request, targetId }) => targetId === input.plan.targetIds[0]
      ? glwRecord({ request, targetId, status: "FAILED" })
      : Promise.reject(new Error("ambiguous")));
    await executeApprovedCampaign({ ...input, dispatcher, delay: async () => {} });
    const resumed = await executeApprovedCampaign({ ...input, dispatcher, delay: async () => {} });
    expect(resumed.metrics.dispatchedCount).toBe(0);
    expect(dispatcher).toHaveBeenCalledTimes(2);
  });

  test("21. explicit pre-dispatch rejection is distinguished", async () => {
    const input = approvedExecution(1);
    const run = await executeApprovedCampaign({ ...input, dispatcher: async () => { throw new CampaignDispatchRejectedError("rejected before acknowledgement"); }, delay: async () => {} });
    expect(run.records[0]).toMatchObject({ status: "FAILED", failureClass: "DISPATCH_REJECTED", requiresReview: false });
  });

  test("22. one target failure does not abort independent targets", async () => {
    const input = approvedExecution(4);
    const dispatcher: CampaignGlwDispatcher = async ({ request, targetId }) => targetId === input.plan.targetIds[0]
      ? glwRecord({ request, targetId, status: "FAILED" })
      : glwRecord({ request, targetId });
    const run = await executeApprovedCampaign({ ...input, dispatcher, delay: async () => {} });
    expect(run.summary).toMatchObject({ succeeded: 3, reviewRequired: 1 });
  });

  test("23. three consecutive infrastructure failures trip the circuit breaker", async () => {
    const input = approvedExecution(10);
    const run = await executeApprovedCampaign({ ...input, dispatcher: async () => { throw new Error("infrastructure unavailable"); }, delay: async () => {} });
    expect(run.metrics.circuitBreakerTripped).toBe(true);
    expect(run.metrics.dispatchedCount).toBeLessThan(10);
    expect(run.summary.pending).toBeGreaterThan(0);
    expect(run.plan.status).toBe("PAUSED");
  });

  test("24. pause stops new acquisition while already active workers finish", async () => {
    const input = approvedExecution(10);
    let completed = 0;
    const run = await executeApprovedCampaign({
      ...input,
      dispatcher: async ({ request, targetId }) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        completed += 1;
        return glwRecord({ request, targetId });
      },
      shouldPause: () => completed >= 2,
      delay: async () => {},
    });
    expect(run.plan.status).toBe("PAUSED");
    expect(run.summary.succeeded).toBeGreaterThanOrEqual(2);
    expect(run.summary.pending).toBeGreaterThan(0);
  });

  test("25. resume dispatches pending only and skips unresolved failures", async () => {
    const input = approvedExecution(6);
    let pause = false;
    let calls = 0;
    const first = await executeApprovedCampaign({
      ...input,
      dispatcher: async ({ request, targetId }) => {
        calls += 1;
        if (calls === 1) return glwRecord({ request, targetId, status: "FAILED" });
        if (calls >= 3) pause = true;
        return glwRecord({ request, targetId });
      },
      shouldPause: () => pause,
      delay: async () => {},
    });
    const succeededBefore = first.summary.succeeded;
    const reviewBefore = first.summary.reviewRequired;
    resumeCampaignExecution(input.plan.executionPlanId);
    pause = false;
    const second = await executeApprovedCampaign({ ...input, dispatcher: successDispatcher, delay: async () => {} });
    expect(second.summary.succeeded).toBe(succeededBefore + first.summary.pending);
    expect(second.summary.reviewRequired).toBe(reviewBefore);
  });

  test("26. cancel marks only pending work and does not imply rollback", () => {
    const input = approvedExecution(3);
    const records = createCampaignTargetExecutionRecords({ plan: input.plan, matrix: input.matrix });
    createCampaignExecutionRecordSet({ approval: input.approval, plan: input.plan, records });
    checkpointCampaignExecution({ executionPlanId: input.plan.executionPlanId, planStatus: "EXECUTING", records: [{ ...records[0], status: "RUNNING", attemptCount: 1, glwJobId: "job-active" }] });
    const cancelled = cancelPendingCampaignExecution({ executionPlanId: input.plan.executionPlanId, now: EXECUTION_AT });
    expect(cancelled.records.filter((record) => record.status === "CANCELLED")).toHaveLength(2);
    expect(cancelled.records.find((record) => record.targetId === records[0].targetId)?.status).toBe("RUNNING");
    expect(cancelled.records.some((record) => record.failureReason?.includes("no rollback"))).toBe(true);
  });

  test("27. execution summary and progress are exact", () => {
    const input = approvedExecution(4, 2);
    const records = createCampaignTargetExecutionRecords({ plan: input.plan, matrix: input.matrix });
    const summary = summarizeCampaignExecution([
      { ...records[0], status: "SUCCEEDED" },
      { ...records[1], status: "FAILED" },
      { ...records[2], status: "RETRY_REVIEW_REQUIRED" },
      records[3],
    ]);
    expect(summary).toMatchObject({ approved: 4, succeeded: 1, failed: 1, reviewRequired: 1, pending: 1, completedCount: 3, remainingCount: 1, successPercent: 25, failurePercent: 50 });
  });

  test("28. persistence checkpoints are bounded by execution batches", async () => {
    const input = approvedExecution(45);
    const run = await executeApprovedCampaign({ ...input, dispatcher: successDispatcher, delay: async () => {} });
    expect(run.metrics.persistenceReplacementCount).toBe(6);
    expect(getCampaignExecutionPersistenceReplacementCount()).toBe(7);
  });

  test("29. 1000 mocked targets are accounted with no duplicate dispatch", async () => {
    const input = approvedExecution(1_000);
    const run = await executeApprovedCampaign({ ...input, dispatcher: successDispatcher, delay: async () => {} });
    expect(run.records).toHaveLength(1_000);
    expect(run.summary.succeeded).toBe(1_000);
    expect(run.metrics).toMatchObject({ dispatchedCount: 1_000, duplicateDispatchCount: 0, observedMaximumInFlight: 2 });
    expect(new Set(run.records.map((record) => record.targetId)).size).toBe(1_000);
    expect(run.metrics.persistenceReplacementCount).toBe(100);
  }, 30_000);

  test("30. no automatic generation retry or publish path exists", async () => {
    const input = approvedExecution(1);
    const dispatcher = jest.fn(async () => { throw new Error("ambiguous"); });
    const run = await executeApprovedCampaign({ ...input, dispatcher, delay: async () => {} });
    expect(dispatcher).toHaveBeenCalledTimes(1);
    expect(run.records[0].attemptCount).toBe(1);
    expect(input.plan.publicationIntent).toBe("draft");
  });
});