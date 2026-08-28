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
  CAMPAIGN_EXECUTION_LIMITS,
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

function approvedExecution(targetCount: number, createCount = targetCount, input?: {
  concurrency?: number;
  dispatchPacingMs?: number;
}) {
  const { matrix: targetMatrix, campaign } = readyCampaign({ targetCount, createCount });
  const approval = createCampaignApproval({ campaign, approvedBy: "operator", approvedAt: EXECUTION_AT });
  const plan = createCampaignExecutionPlan({
    campaign,
    approval,
    now: EXECUTION_AT,
    concurrency: input?.concurrency,
    dispatchPacingMs: input?.dispatchPacingMs ?? 0,
  });
  return { matrix: targetMatrix, campaign, approval, plan, now: () => EXECUTION_AT };
}

async function executeWithQueuedTimers(
  input: ReturnType<typeof approvedExecution>,
  dispatcher: CampaignGlwDispatcher = successDispatcher,
) {
  jest.useFakeTimers({ now: 0 });
  const invocationTimes: number[] = [];
  try {
    const execution = executeApprovedCampaign({
      ...input,
      dispatcher: async (dispatchInput) => {
        invocationTimes.push(performance.now());
        return dispatcher(dispatchInput);
      },
    });
    await jest.runAllTimersAsync();
    return { run: await execution, invocationTimes };
  } finally {
    jest.useRealTimers();
  }
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

  test("31. concurrent workers preserve the global pacing floor after an early timer wake", async () => {
    const input = approvedExecution(2, 2, { concurrency: 2, dispatchPacingMs: 5_000 });
    let monotonicTime = 0;
    let earlyWake = true;
    const invocationTimes: number[] = [];
    const run = await executeApprovedCampaign({
      ...input,
      dispatcher: async ({ request, targetId }) => {
        invocationTimes.push(monotonicTime);
        return glwRecord({ request, targetId });
      },
      delay: async (milliseconds) => {
        monotonicTime += earlyWake ? Math.max(0, milliseconds - 381) : milliseconds;
        earlyWake = false;
      },
      monotonicNow: () => monotonicTime,
    });
    expect(run.summary.succeeded).toBe(2);
    expect(invocationTimes[1] - invocationTimes[0]).toBeGreaterThanOrEqual(5_000);
  });

  test("32. simultaneous workers reserve distinct global dispatch slots", async () => {
    const input = approvedExecution(2, 2, { concurrency: 2, dispatchPacingMs: 5_000 });
    let monotonicTime = 0;
    const invocationTimes: number[] = [];
    const run = await executeApprovedCampaign({
      ...input,
      dispatcher: async ({ request, targetId }) => {
        invocationTimes.push(monotonicTime);
        return glwRecord({ request, targetId });
      },
      delay: async (milliseconds) => { monotonicTime += milliseconds; },
      monotonicNow: () => monotonicTime,
    });
    expect(invocationTimes).toEqual([0, 5_000]);
    expect(run.metrics.dispatchPacing.map((entry) => entry.dispatchReservedAt)).toEqual([0, 5_000]);
  });

  test("33. recycled worker slots retain second-wave global pacing", async () => {
    const input = approvedExecution(4, 4, { concurrency: 2, dispatchPacingMs: 5_000 });
    const { run, invocationTimes } = await executeWithQueuedTimers(input);
    expect(invocationTimes).toEqual([0, 5_000, 10_000, 15_000]);
    expect(run.metrics.dispatchedCount).toBe(4);
  });

  test("34. a 4999 ms wake waits for the remaining millisecond", async () => {
    const input = approvedExecution(2, 2, { concurrency: 2, dispatchPacingMs: 5_000 });
    let monotonicTime = 0;
    let earlyWake = true;
    const delays: number[] = [];
    const invocationTimes: number[] = [];
    await executeApprovedCampaign({
      ...input,
      dispatcher: async ({ request, targetId }) => {
        invocationTimes.push(monotonicTime);
        return glwRecord({ request, targetId });
      },
      delay: async (milliseconds) => {
        delays.push(milliseconds);
        monotonicTime += earlyWake ? milliseconds - 1 : milliseconds;
        earlyWake = false;
      },
      monotonicNow: () => monotonicTime,
    });
    expect(delays).toEqual([5_000, 1]);
    expect(invocationTimes).toEqual([0, 5_000]);
  });

  test("35. an exact 5000 ms wake is immediately dispatchable", async () => {
    const input = approvedExecution(2, 2, { concurrency: 2, dispatchPacingMs: 5_000 });
    let monotonicTime = 0;
    const delays: number[] = [];
    await executeApprovedCampaign({
      ...input,
      dispatcher: async ({ request, targetId }) => glwRecord({ request, targetId }),
      delay: async (milliseconds) => { delays.push(milliseconds); monotonicTime += milliseconds; },
      monotonicNow: () => monotonicTime,
    });
    expect(delays).toEqual([5_000]);
  });

  test.each([[4, 2], [10, 2]] as const)("36-37. %i targets at concurrency %i preserve every pacing interval", async (targetCount, concurrency) => {
    const input = approvedExecution(targetCount, targetCount, { concurrency, dispatchPacingMs: 5_000 });
    const { run, invocationTimes } = await executeWithQueuedTimers(
      input,
      async ({ request, targetId }) => {
        await new Promise((resolve) => setTimeout(resolve, 6_000));
        return glwRecord({ request, targetId });
      },
    );
    const intervals = invocationTimes.slice(1).map((value, index) => value - invocationTimes[index]);
    expect(run.metrics.dispatchedCount).toBe(targetCount);
    expect(Math.min(...intervals)).toBe(5_000);
    expect(run.metrics.observedMaximumInFlight).toBe(2);
  });

  test("38. concurrency one retains the global pacing floor", async () => {
    const input = approvedExecution(4, 4, { concurrency: 1, dispatchPacingMs: 5_000 });
    const { run, invocationTimes } = await executeWithQueuedTimers(input);
    expect(run.metrics.observedMaximumInFlight).toBe(1);
    expect(invocationTimes).toEqual([0, 5_000, 10_000, 15_000]);
  });

  test("39. a failed outbound dispatch consumes its pacing slot", async () => {
    const input = approvedExecution(3, 3, { concurrency: 2, dispatchPacingMs: 5_000 });
    let calls = 0;
    const { invocationTimes } = await executeWithQueuedTimers(
      input,
      async ({ request, targetId }) => {
        calls += 1;
        if (calls === 2) throw new Error("synthetic outbound failure");
        return glwRecord({ request, targetId });
      },
    );
    expect(invocationTimes).toEqual([0, 5_000, 10_000]);
  });

  test("40. read retry policy remains separate from dispatch pacing", () => {
    expect(CAMPAIGN_EXECUTION_LIMITS.dispatchPacingMs).toBe(5_000);
    expect(CAMPAIGN_EXECUTION_LIMITS).not.toHaveProperty("readRetryBackoffMs");
  });

  test("41. dispatch rate-limit failure is attempted once without auto-retry", async () => {
    const input = approvedExecution(1, 1, { concurrency: 2, dispatchPacingMs: 5_000 });
    const dispatcher = jest.fn(async () => { throw new Error("HTTP 429 Too many requests"); });
    const run = await executeApprovedCampaign({ ...input, dispatcher });
    expect(dispatcher).toHaveBeenCalledTimes(1);
    expect(run.records[0]).toMatchObject({ status: "RETRY_REVIEW_REQUIRED", attemptCount: 1 });
  });

  test("42. pause while waiting prevents the reserved target from dispatching", async () => {
    const input = approvedExecution(2, 2, { concurrency: 2, dispatchPacingMs: 5_000 });
    let monotonicTime = 0;
    const dispatcher = jest.fn(successDispatcher);
    const run = await executeApprovedCampaign({
      ...input,
      dispatcher,
      delay: async (milliseconds) => { monotonicTime += milliseconds; },
      monotonicNow: () => monotonicTime,
      shouldPause: () => monotonicTime >= 5_000,
    });
    expect(dispatcher).toHaveBeenCalledTimes(1);
    expect(run.plan.status).toBe("PAUSED");
  });

  test("43. circuit opening prevents later reserved dispatches", async () => {
    const input = approvedExecution(10, 10, { concurrency: 2, dispatchPacingMs: 5_000 });
    const { run, invocationTimes } = await executeWithQueuedTimers(input, async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      throw new Error("infrastructure unavailable");
    });
    expect(run.metrics.circuitBreakerTripped).toBe(true);
    expect(invocationTimes).toHaveLength(3);
  });

  test("44. stale preflight can be refreshed after a pacing wait", async () => {
    const input = approvedExecution(2, 2, { concurrency: 1, dispatchPacingMs: 5_000 });
    let monotonicTime = 0;
    let wallTime = EXECUTION_AT;
    const refreshTargetPreflight = jest.fn(async ({ targetId }: { targetId: string }) => ({
      ...input.campaign.preflightResults.find((result) => result.targetId === targetId)!,
      checkedAt: wallTime,
    }));
    const run = await executeApprovedCampaign({
      ...input,
      dispatcher: successDispatcher,
      now: () => wallTime,
      delay: async (milliseconds) => { monotonicTime += milliseconds; wallTime = "2026-08-27T01:40:00.000Z"; },
      monotonicNow: () => monotonicTime,
      refreshTargetPreflight,
    });
    expect(run.summary.succeeded).toBe(2);
    expect(refreshTargetPreflight).toHaveBeenCalledTimes(2);
  });

  test("45. unsafe refreshed preflight prevents outbound dispatch", async () => {
    const input = approvedExecution(1, 1, { concurrency: 1, dispatchPacingMs: 5_000 });
    const dispatcher = jest.fn(successDispatcher);
    const source = input.campaign.preflightResults[0];
    const run = await executeApprovedCampaign({
      ...input,
      dispatcher,
      refreshTargetPreflight: async () => ({
        ...source,
        targetState: "EXISTS_PUBLISHED",
        eligibility: "NOT_ELIGIBLE_PUBLISHED",
        plannedOperation: "NO_ACTION",
        wordpressObjectId: "protected",
      }),
    });
    expect(dispatcher).not.toHaveBeenCalled();
    expect(run.records[0]).toMatchObject({ status: "FAILED", attemptCount: 0 });
  });

  test("46. pacing reservations do not change idempotency or dispatch twice", async () => {
    const input = approvedExecution(4, 4, { concurrency: 2, dispatchPacingMs: 5_000 });
    let monotonicTime = 0;
    const dispatcher = jest.fn(successDispatcher);
    const first = await executeApprovedCampaign({ ...input, dispatcher, delay: async (milliseconds) => { monotonicTime += milliseconds; }, monotonicNow: () => monotonicTime });
    const second = await executeApprovedCampaign({ ...input, dispatcher, monotonicNow: () => monotonicTime });
    expect(first.metrics.dispatchPacing).toHaveLength(4);
    expect(second.metrics.dispatchedCount).toBe(0);
    expect(dispatcher).toHaveBeenCalledTimes(4);
  });

  test("47. dispatch pacing serializes initiation without reducing active concurrency", async () => {
    const input = approvedExecution(2, 2, { concurrency: 2, dispatchPacingMs: 5_000 });
    let monotonicTime = 0;
    let releaseFirst!: () => void;
    const firstActive = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let calls = 0;
    const run = await executeApprovedCampaign({
      ...input,
      dispatcher: async ({ request, targetId }) => {
        calls += 1;
        if (calls === 1) await firstActive;
        else releaseFirst();
        return glwRecord({ request, targetId });
      },
      delay: async (milliseconds) => { monotonicTime += milliseconds; },
      monotonicNow: () => monotonicTime,
    });
    expect(run.metrics.observedMaximumInFlight).toBe(2);
  });

  test("48. pacing observations distinguish eligibility, reservation, and invocation", async () => {
    const input = approvedExecution(2, 2, { concurrency: 2, dispatchPacingMs: 5_000 });
    let monotonicTime = 100;
    const run = await executeApprovedCampaign({
      ...input,
      dispatcher: successDispatcher,
      delay: async (milliseconds) => { monotonicTime += milliseconds; },
      monotonicNow: () => monotonicTime,
    });
    expect(run.metrics.dispatchPacing).toEqual([
      { targetId: expect.any(String), dispatchEligibleAt: 100, dispatchReservedAt: 100, dispatchInvokedAt: 100, dispatchPacingDelayMs: 0 },
      { targetId: expect.any(String), dispatchEligibleAt: 100, dispatchReservedAt: 5_100, dispatchInvokedAt: 5_100, dispatchPacingDelayMs: 5_000 },
    ]);
  });

  test("49. unequal preflight refresh latency cannot compress actual invocation spacing", async () => {
    const input = approvedExecution(2, 2, { concurrency: 2, dispatchPacingMs: 5_000 });
    let monotonicTime = 0;
    let refreshCount = 0;
    const invocationTimes: number[] = [];
    await executeApprovedCampaign({
      ...input,
      dispatcher: async ({ request, targetId }) => {
        invocationTimes.push(monotonicTime);
        return glwRecord({ request, targetId });
      },
      refreshTargetPreflight: async ({ targetId }) => {
        monotonicTime += refreshCount === 0 ? 500 : 100;
        refreshCount += 1;
        return input.campaign.preflightResults.find((result) => result.targetId === targetId)!;
      },
      delay: async (milliseconds) => { monotonicTime += milliseconds; },
      monotonicNow: () => monotonicTime,
    });
    expect(invocationTimes).toEqual([500, 5_600]);
    expect(invocationTimes[1] - invocationTimes[0]).toBeGreaterThanOrEqual(5_000);
  });
});