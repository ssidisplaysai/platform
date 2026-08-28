import type { GlwPageExecutionRecord } from "@/modules/glw/page-execution";
import type { CampaignApproval } from "@/modules/foundation/campaign-approval";
import {
  CAMPAIGN_EXECUTION_LIMITS,
  createExecutionIdempotencyKey,
  summarizeCampaignExecution,
  type CampaignExecutionPlan,
  type CampaignTargetExecutionRecord,
} from "@/modules/foundation/campaign-execution";
import {
  checkpointCampaignExecution,
  checkpointCampaignExecutionRuntimeState,
  createCampaignExecutionRecordSet,
  getCampaignApprovalRecord,
  getCampaignExecutionPersistenceReplacementCount,
  getCampaignExecutionPlanRecord,
  getCampaignExecutionRuntimeState,
  getCampaignTargetRetryAuthorization,
  listCampaignTargetExecutionRecords,
  pauseCampaignExecution,
  prepareCampaignExecutionBatch,
  recoverCampaignCircuit,
  reloadCampaignExecutionRepositoryForTests,
  resetCampaignExecutionRepositoryForTests,
  resumeCampaignExecution,
  saveReviewedRetryAuthorization,
} from "@/modules/foundation/campaign-execution-repository";
import {
  CAMPAIGN_SCALE_RAMP_POLICY,
  classifyCampaignResumeDisposition,
  deriveCampaignHealth,
  reconcilePersistedExecutionRecord,
  reconstructCampaignExecution,
} from "@/modules/foundation/campaign-recovery";
import { summarizeCampaignQa } from "@/modules/foundation/campaign-qa-summary";
import {
  createCampaignTargetRetryAuthorization,
  evaluateMutationReconciliation,
  MAX_REVIEWED_RETRY_ATTEMPTS_PER_TARGET,
  prepareReviewedRetry,
} from "@/modules/foundation/campaign-retry-authorization";

const NOW = "2026-08-28T18:00:00.000Z";
const PASS_CHECKS = Object.fromEntries([
  "pageExists", "hierarchy", "slug", "title", "h1", "uniquePrimaryHeading",
  "duplicateSectionHeadings", "duplicateSectionContent", "placeholderResourceLinks", "body",
  "featuredImage", "heroImage", "seo", "internalLinks", "imageAlt", "duplicateCheck",
].map((check) => [check, "PASS"]));

function plan(targetCount: number): CampaignExecutionPlan {
  const targetIds = Array.from({ length: targetCount }, (_, index) => `target-${index}`);
  const operations = Object.fromEntries(targetIds.map((targetId) => [targetId, "CREATE" as const]));
  return {
    executionPlanId: `execution-plan-${targetCount}`,
    campaignId: `campaign-${targetCount}`,
    campaignFingerprint: `campaign-fingerprint-${targetCount}`,
    approvalFingerprint: `approval-fingerprint-${targetCount}`,
    matrixFingerprint: `matrix-fingerprint-${targetCount}`,
    targetIds,
    operations,
    exactWordpressObjectIds: {},
    operationCounts: { CREATE: targetCount, EXACT_UPDATE: 0 },
    concurrency: 2,
    batchSize: 20,
    dispatchPacingMs: 250,
    publicationIntent: "draft",
    createdAt: NOW,
    status: "APPROVED",
    version: 1,
  };
}

function approval(value: CampaignExecutionPlan): CampaignApproval {
  return {
    campaignId: value.campaignId,
    campaignFingerprint: value.campaignFingerprint,
    matrixFingerprint: value.matrixFingerprint,
    approvedTargetIds: value.targetIds,
    excludedTargetIds: [],
    approvedOperations: value.operations,
    approvedOperationCounts: value.operationCounts,
    publicationIntent: "draft",
    preflightPolicyVersion: "1.0.0",
    preflightCompletedAt: NOW,
    approvedBy: "operator",
    approvedAt: NOW,
    approvalFingerprint: value.approvalFingerprint,
  };
}

function record(index: number, overrides: Partial<CampaignTargetExecutionRecord> = {}): CampaignTargetExecutionRecord {
  const targetId = overrides.targetId ?? `target-${index}`;
  return {
    campaignId: overrides.campaignId ?? "campaign-100",
    executionPlanId: overrides.executionPlanId ?? "execution-plan-100",
    targetId,
    pageBlueprintId: "blueprint-product-city",
    productId: `product-${index % 5}`,
    stateCode: index % 2 ? "TX" : "CA",
    operation: "CREATE",
    status: "PENDING",
    attemptCount: 0,
    reviewedRetryCount: 0,
    glwJobId: null,
    glwExternalExecutionId: null,
    idempotencyKey: createExecutionIdempotencyKey({
      campaignFingerprint: overrides.campaignId ?? "campaign-fingerprint-100",
      approvalFingerprint: "approval-fingerprint-100",
      targetId,
      operation: "CREATE",
    }),
    dispatchedAt: null,
    terminalAt: null,
    failureClass: null,
    failureReason: null,
    requiresReview: false,
    resultReference: null,
    wordpressObjectId: null,
    wordpressUrl: null,
    wordpressStatus: null,
    qaStatus: null,
    qaChecks: null,
    qaFailureReasons: null,
    featuredImagePresent: null,
    version: 1,
    ...overrides,
  };
}

function succeeded(index: number): CampaignTargetExecutionRecord {
  return record(index, {
    status: "SUCCEEDED",
    attemptCount: 1,
    glwJobId: `job-${index}`,
    glwExternalExecutionId: `execution-${index}`,
    dispatchedAt: NOW,
    terminalAt: NOW,
    resultReference: `glw-job:job-${index}`,
    wordpressObjectId: `wp-${index}`,
    wordpressUrl: `https://example.test/?page_id=${index}`,
    wordpressStatus: "draft",
    qaStatus: "COMPLETE",
    qaChecks: PASS_CHECKS,
    qaFailureReasons: {},
    featuredImagePresent: true,
    version: 2,
  });
}

function review(index: number, failureClass: CampaignTargetExecutionRecord["failureClass"]): CampaignTargetExecutionRecord {
  const qaFailure = failureClass === "QA_FAILURE";
  return record(index, {
    status: "RETRY_REVIEW_REQUIRED",
    attemptCount: 1,
    glwJobId: `job-${index}`,
    glwExternalExecutionId: `execution-${index}`,
    dispatchedAt: NOW,
    terminalAt: NOW,
    failureClass,
    failureReason: `${failureClass} synthetic evidence`,
    requiresReview: true,
    qaStatus: qaFailure ? "FAILED_QA" : null,
    qaChecks: qaFailure ? { ...PASS_CHECKS, seo: "FAIL", featuredImage: "FAIL", internalLinks: "FAIL" } : null,
    qaFailureReasons: qaFailure ? { seo: "missing", featuredImage: "missing", internalLinks: "missing" } : null,
    version: 2,
  });
}

function glw(index: number, status: "COMPLETE" | "FAILED" | "RUNNING" = "COMPLETE"): GlwPageExecutionRecord {
  return {
    jobId: `job-${index}`,
    correlationId: `job-${index}`,
    executionTransport: "N8N_MCP",
    organizationId: "org",
    siteId: "site",
    productId: `product-${index}`,
    productTopic: `Product ${index}`,
    state: "Texas",
    city: `City ${index}`,
    slug: `product/texas/city-${index}`,
    title: `Product ${index}`,
    seoTitle: `Product ${index}`,
    metaDescription: `Product ${index}`,
    publicationIntent: "draft",
    status,
    externalExecutionId: `execution-${index}`,
    wordpressObjectId: status === "COMPLETE" ? `wp-${index}` : null,
    wordpressUrl: status === "COMPLETE" ? `https://example.test/${index}` : null,
    wordpressStatus: status === "COMPLETE" ? "draft" : null,
    errorCode: status === "FAILED" ? "GLW_FAILED" : null,
    errorMessage: status === "FAILED" ? "failed" : null,
    requestedPublicationMode: "draft",
    disposition: status === "COMPLETE" ? "CREATED" : null,
    qaStatus: status === "COMPLETE" ? "COMPLETE" : null,
    qaChecks: status === "COMPLETE" ? PASS_CHECKS : null,
    qaFailureReasons: {},
    focusKeyphrase: null,
    wordCount: status === "COMPLETE" ? 1000 : null,
    featuredImagePresent: status === "COMPLETE" ? true : null,
    createdAt: NOW,
    dispatchedAt: NOW,
    updatedAt: NOW,
    completedAt: status === "RUNNING" ? null : NOW,
  };
}

describe("002E mass QA and terminal accounting", () => {
  test("1. every approved target is accounted exactly once in a 100-target campaign", () => {
    const records = [
      ...Array.from({ length: 80 }, (_, index) => succeeded(index)),
      ...Array.from({ length: 5 }, (_, index) => review(80 + index, "GLW_TERMINAL_FAILURE")),
      ...Array.from({ length: 3 }, (_, index) => review(85 + index, "QA_FAILURE")),
      ...Array.from({ length: 2 }, (_, index) => review(88 + index, "DISPATCH_AMBIGUOUS")),
      ...Array.from({ length: 10 }, (_, index) => record(90 + index)),
    ];
    const summary = summarizeCampaignExecution(records);
    expect(summary).toMatchObject({ approved: 100, succeeded: 80, reviewRequired: 10, pending: 10 });
    expect(summary.approved).toBe(records.length);
    expect(new Set(records.map((entry) => entry.targetId)).size).toBe(100);
  });

  test("2. dispatch acceptance does not count as success", () => {
    expect(summarizeCampaignExecution([record(1, { status: "DISPATCHED" })])).toMatchObject({ dispatched: 1, succeeded: 0 });
  });

  test("3. GLW QA PASS targets aggregate all 16 existing checks", () => {
    expect(summarizeCampaignQa([succeeded(1), succeeded(2)])).toMatchObject({
      qaPassTargetCount: 2,
      qaFailTargetCount: 0,
      totalCheckPassCount: 32,
      totalCheckFailureCount: 0,
    });
  });

  test("4. QA failures aggregate by existing GLW check name", () => {
    const summary = summarizeCampaignQa([review(1, "QA_FAILURE"), review(2, "QA_FAILURE"), review(3, "QA_FAILURE")]);
    expect(summary).toMatchObject({
      qaPassTargetCount: 0,
      qaFailTargetCount: 3,
      totalCheckFailureCount: 9,
      failureReasonsByCheck: { seo: 3, featuredImage: 3, internalLinks: 3 },
    });
    expect(summary.affectedProducts).toHaveLength(3);
  });

  test("5. nonterminal targets remain visible as without terminal QA", () => {
    expect(summarizeCampaignQa([succeeded(1), record(2), review(3, "GLW_TERMINAL_FAILURE")]).withoutTerminalQaCount).toBe(2);
  });

  test("6. failed and ambiguous records retain independent evidence", () => {
    const failed = review(1, "GLW_TERMINAL_FAILURE");
    const ambiguous = review(2, "DISPATCH_AMBIGUOUS");
    expect(failed).toMatchObject({ targetId: "target-1", glwJobId: "job-1", requiresReview: true });
    expect(ambiguous).toMatchObject({ targetId: "target-2", status: "RETRY_REVIEW_REQUIRED", requiresReview: true });
  });
});

describe("002E mutation reconciliation and reviewed retry", () => {
  test("7. ambiguous CREATE plus exact absence remains review-required until explicit authorization", () => {
    const source = review(1, "DISPATCH_AMBIGUOUS");
    const reconciliation = evaluateMutationReconciliation({ record: source, state: "ABSENT", exactWordpressObjectId: null, exactTargetIdentityMatched: true, checkedAt: NOW });
    expect(source.status).toBe("RETRY_REVIEW_REQUIRED");
    expect(reconciliation.state).toBe("ABSENT");
  });

  test.each(["EXISTS_DRAFT", "EXISTS_PUBLISHED", "UNKNOWN"] as const)("8. ambiguous CREATE cannot retry when mutation evidence is %s", (state) => {
    const source = review(1, "DISPATCH_AMBIGUOUS");
    const reconciliation = evaluateMutationReconciliation({ record: source, state, exactWordpressObjectId: state === "UNKNOWN" ? null : "wp-1", exactTargetIdentityMatched: true, checkedAt: NOW });
    expect(() => createCampaignTargetRetryAuthorization({ record: source, mutationReconciliation: reconciliation, previousReviewedRetryCount: 0, authorizedBy: "operator", authorizedAt: NOW })).toThrow("CREATE retry requires authenticated exact absence");
  });

  test("11. failed UPDATE reconciliation requires the same exact WordPress ID", () => {
    const source = review(1, "GLW_TERMINAL_FAILURE");
    const update = { ...source, operation: "EXACT_UPDATE" as const, wordpressObjectId: "19613" };
    expect(() => evaluateMutationReconciliation({ record: update, state: "EXISTS_DRAFT", exactWordpressObjectId: "other", exactTargetIdentityMatched: true, checkedAt: NOW })).toThrow("same exact WordPress object ID");
  });

  test("12. reviewed retry authorization preserves identity and authorizes attempt two", () => {
    const source = review(1, "DISPATCH_AMBIGUOUS");
    const reconciliation = evaluateMutationReconciliation({ record: source, state: "ABSENT", exactWordpressObjectId: null, exactTargetIdentityMatched: true, checkedAt: NOW });
    const authorization = createCampaignTargetRetryAuthorization({ record: source, mutationReconciliation: reconciliation, previousReviewedRetryCount: 0, authorizedBy: "operator", authorizedAt: NOW });
    const prepared = prepareReviewedRetry({ record: source, authorization });
    expect(authorization).toMatchObject({ targetId: source.targetId, originalAttempt: 1, authorizedAttempt: 2, authorizedOperation: "CREATE" });
    expect(prepared).toMatchObject({ targetId: source.targetId, status: "PENDING", attemptCount: 1, reviewedRetryCount: 1 });
    expect(prepared.idempotencyKey).not.toBe(source.idempotencyKey);
    expect(reconcilePersistedExecutionRecord({
      record: { ...prepared, status: "RUNNING", attemptCount: 2, glwJobId: "job-1" },
      glwRecord: glw(1, "COMPLETE"),
      now: NOW,
    }).attemptCount).toBe(2);
  });

  test("13. retry authorization does not execute automatically", () => {
    const source = review(1, "DISPATCH_AMBIGUOUS");
    const reconciliation = evaluateMutationReconciliation({ record: source, state: "ABSENT", exactWordpressObjectId: null, exactTargetIdentityMatched: true, checkedAt: NOW });
    createCampaignTargetRetryAuthorization({ record: source, mutationReconciliation: reconciliation, previousReviewedRetryCount: 0, authorizedBy: "operator", authorizedAt: NOW });
    expect(source.status).toBe("RETRY_REVIEW_REQUIRED");
  });

  test("14. reviewed retry limit fails closed", () => {
    const source = review(1, "DISPATCH_AMBIGUOUS");
    const reconciliation = evaluateMutationReconciliation({ record: source, state: "ABSENT", exactWordpressObjectId: null, exactTargetIdentityMatched: true, checkedAt: NOW });
    expect(() => createCampaignTargetRetryAuthorization({ record: { ...source, reviewedRetryCount: 1 }, mutationReconciliation: reconciliation, previousReviewedRetryCount: 1, authorizedBy: "operator", authorizedAt: NOW })).toThrow("retry limit");
    expect(MAX_REVIEWED_RETRY_ATTEMPTS_PER_TARGET).toBe(1);
  });

  test("tampered retry authorization cannot prepare another attempt", () => {
    const source = review(1, "DISPATCH_AMBIGUOUS");
    const reconciliation = evaluateMutationReconciliation({ record: source, state: "ABSENT", exactWordpressObjectId: null, exactTargetIdentityMatched: true, checkedAt: NOW });
    const authorization = createCampaignTargetRetryAuthorization({ record: source, mutationReconciliation: reconciliation, previousReviewedRetryCount: 0, authorizedBy: "operator", authorizedAt: NOW });
    expect(() => prepareReviewedRetry({ record: source, authorization: { ...authorization, authorizedOperation: "EXACT_UPDATE" } })).toThrow();
  });

  test("15. successful targets can never receive retry authorization", () => {
    const source = succeeded(1);
    const reconciliation = evaluateMutationReconciliation({ record: source, state: "EXISTS_DRAFT", exactWordpressObjectId: "wp-1", exactTargetIdentityMatched: true, checkedAt: NOW });
    expect(() => createCampaignTargetRetryAuthorization({ record: source, mutationReconciliation: reconciliation, previousReviewedRetryCount: 0, authorizedBy: "operator", authorizedAt: NOW })).toThrow("Successful targets cannot be retried");
  });
});

describe("002E restart and crash-window recovery", () => {
  beforeEach(() => resetCampaignExecutionRepositoryForTests());

  test("16. durable reload preserves approval, plan, success, review, running, and pending states", () => {
    const value = plan(100);
    const records = [
      ...Array.from({ length: 40 }, (_, index) => succeeded(index)),
      ...Array.from({ length: 5 }, (_, index) => review(40 + index, "GLW_TERMINAL_FAILURE")),
      ...Array.from({ length: 5 }, (_, index) => record(45 + index, { status: "RUNNING", attemptCount: 1, glwJobId: `job-${45 + index}` })),
      ...Array.from({ length: 50 }, (_, index) => record(50 + index)),
    ];
    createCampaignExecutionRecordSet({ approval: approval(value), plan: value, records });
    checkpointCampaignExecution({ executionPlanId: value.executionPlanId, planStatus: "EXECUTING", records });
    reloadCampaignExecutionRepositoryForTests();
    expect(getCampaignApprovalRecord(value.approvalFingerprint)).not.toBeNull();
    expect(getCampaignExecutionPlanRecord(value.executionPlanId)?.status).toBe("EXECUTING");
    const reloaded = listCampaignTargetExecutionRecords(value.executionPlanId);
    expect(summarizeCampaignExecution(reloaded)).toMatchObject({ succeeded: 40, reviewRequired: 5, running: 5, pending: 50 });
  });

  test("17. restart reconciles exact external jobs without duplicate dispatch", () => {
    const value = plan(100);
    const records = [
      ...Array.from({ length: 40 }, (_, index) => succeeded(index)),
      ...Array.from({ length: 5 }, (_, index) => review(40 + index, "GLW_TERMINAL_FAILURE")),
      ...Array.from({ length: 5 }, (_, index) => record(45 + index, { status: "RUNNING", attemptCount: 1, glwJobId: `job-${45 + index}` })),
      ...Array.from({ length: 50 }, (_, index) => record(50 + index)),
    ];
    const glwRecords = new Map([
      ["job-45", glw(45, "COMPLETE")],
      ["job-46", glw(46, "COMPLETE")],
      ["job-47", glw(47, "COMPLETE")],
      ["job-48", glw(48, "FAILED")],
      ["job-49", glw(49, "RUNNING")],
    ]);
    const runtimeState = { executionPlanId: value.executionPlanId, circuitState: "CLOSED" as const, consecutiveInfrastructureFailures: 0, failureWindow: [], pauseReason: null, updatedAt: NOW };
    const recovered = reconstructCampaignExecution({ plan: value, runtimeState, records, glwRecordsByJobId: glwRecords, now: NOW });
    expect(summarizeCampaignExecution(recovered.records)).toMatchObject({ succeeded: 43, reviewRequired: 6, running: 1, pending: 50 });
    expect(recovered.records.filter((entry) => entry.status === "PENDING")).toHaveLength(50);
  });

  test("18. crash before dispatch remains safely pending", () => {
    expect(reconcilePersistedExecutionRecord({ record: record(1), now: NOW }).status).toBe("PENDING");
  });

  test("19. crash after DISPATCHING before acknowledgement becomes review-required", () => {
    expect(reconcilePersistedExecutionRecord({ record: record(1, { status: "DISPATCHING", dispatchedAt: NOW }), now: NOW })).toMatchObject({ status: "RETRY_REVIEW_REQUIRED", failureClass: "DISPATCH_AMBIGUOUS" });
  });

  test("20. crash after GLW job ID while running remains running", () => {
    const source = record(1, { status: "RUNNING", attemptCount: 1, glwJobId: "job-1" });
    expect(reconcilePersistedExecutionRecord({ record: source, glwRecord: glw(1, "RUNNING"), now: NOW }).status).toBe("RUNNING");
  });

  test("21. crash after WordPress mutation before callback requires mutation review", () => {
    const source = review(1, "CALLBACK_FAILURE");
    const reconciliation = evaluateMutationReconciliation({ record: source, state: "EXISTS_DRAFT", exactWordpressObjectId: "wp-1", exactTargetIdentityMatched: true, checkedAt: NOW });
    expect(() => createCampaignTargetRetryAuthorization({ record: source, mutationReconciliation: reconciliation, previousReviewedRetryCount: 0, authorizedBy: "operator", authorizedAt: NOW })).toThrow("CREATE retry requires authenticated exact absence");
  });

  test("22. crash after terminal success before summary reconstructs success and never pending", () => {
    const source = record(1, { status: "RUNNING", attemptCount: 1, glwJobId: "job-1" });
    expect(reconcilePersistedExecutionRecord({ record: source, glwRecord: glw(1, "COMPLETE"), now: NOW })).toMatchObject({ status: "SUCCEEDED", attemptCount: 1 });
  });

  test("23. missing prior GLW job never returns to pending", () => {
    const source = record(1, { status: "DISPATCHED", attemptCount: 1, glwJobId: "job-missing" });
    expect(reconcilePersistedExecutionRecord({ record: source, glwRecord: null, now: NOW }).status).toBe("RETRY_REVIEW_REQUIRED");
  });

  test("24. pre-dispatch batch intent survives repository reload", () => {
    const value = plan(2);
    const records = [record(0, { campaignId: value.campaignId, executionPlanId: value.executionPlanId }), record(1, { campaignId: value.campaignId, executionPlanId: value.executionPlanId })];
    createCampaignExecutionRecordSet({ approval: approval(value), plan: value, records });
    prepareCampaignExecutionBatch({ executionPlanId: value.executionPlanId, targetIds: ["target-0", "target-1"], now: NOW });
    reloadCampaignExecutionRepositoryForTests();
    expect(listCampaignTargetExecutionRecords(value.executionPlanId).every((entry) => entry.status === "DISPATCHING")).toBe(true);
  });

  test("reviewed retry authorization and prepared attempt survive repository reload", () => {
    const value = plan(1);
    const failed = {
      ...review(0, "DISPATCH_AMBIGUOUS"),
      campaignId: value.campaignId,
      executionPlanId: value.executionPlanId,
    };
    createCampaignExecutionRecordSet({ approval: approval(value), plan: value, records: [failed] });
    const reconciliation = evaluateMutationReconciliation({ record: failed, state: "ABSENT", exactWordpressObjectId: null, exactTargetIdentityMatched: true, checkedAt: NOW });
    const authorization = createCampaignTargetRetryAuthorization({ record: failed, mutationReconciliation: reconciliation, previousReviewedRetryCount: 0, authorizedBy: "operator", authorizedAt: NOW });
    saveReviewedRetryAuthorization({ executionPlanId: value.executionPlanId, targetId: failed.targetId, authorization });
    reloadCampaignExecutionRepositoryForTests();
    expect(getCampaignTargetRetryAuthorization(authorization.fingerprint)).toEqual(authorization);
    expect(listCampaignTargetExecutionRecords(value.executionPlanId)[0]).toMatchObject({ status: "PENDING", reviewedRetryCount: 1, attemptCount: 1 });
  });

  test.each([
    ["SUCCEEDED", false, "SKIP_SUCCEEDED"],
    ["RETRY_REVIEW_REQUIRED", false, "SKIP_REVIEW_REQUIRED"],
    ["CANCELLED", false, "SKIP_CANCELLED"],
    ["RUNNING", false, "EXTERNAL_RECONCILIATION_REQUIRED"],
    ["PENDING", true, "PREFLIGHT_REFRESH_REQUIRED"],
    ["PENDING", false, "DISPATCHABLE"],
  ] as const)("resume classifies %s with stale=%s as %s", (status, preflightStale, expected) => {
    expect(classifyCampaignResumeDisposition({ record: record(1, { status }), preflightStale })).toBe(expected);
  });
});

describe("002E pause, circuit, health, and scale policy", () => {
  beforeEach(() => resetCampaignExecutionRepositoryForTests());

  test("25. pause and open circuit survive durable reload", () => {
    const value = plan(1);
    createCampaignExecutionRecordSet({ approval: approval(value), plan: value, records: [record(0, { campaignId: value.campaignId, executionPlanId: value.executionPlanId })] });
    pauseCampaignExecution(value.executionPlanId);
    checkpointCampaignExecutionRuntimeState({ executionPlanId: value.executionPlanId, circuitState: "OPEN", consecutiveInfrastructureFailures: 3, failureWindow: [true, true, true], pauseReason: "CIRCUIT_BREAKER", updatedAt: NOW });
    reloadCampaignExecutionRepositoryForTests();
    expect(getCampaignExecutionPlanRecord(value.executionPlanId)?.status).toBe("PAUSED");
    expect(getCampaignExecutionRuntimeState(value.executionPlanId)).toMatchObject({ circuitState: "OPEN", consecutiveInfrastructureFailures: 3 });
  });

  test("26. restart does not auto-resume or auto-reset circuit", () => {
    const value = plan(1);
    createCampaignExecutionRecordSet({ approval: approval(value), plan: value, records: [record(0, { campaignId: value.campaignId, executionPlanId: value.executionPlanId })] });
    pauseCampaignExecution(value.executionPlanId);
    checkpointCampaignExecutionRuntimeState({ executionPlanId: value.executionPlanId, circuitState: "OPEN", consecutiveInfrastructureFailures: 3, failureWindow: [true], pauseReason: "CIRCUIT_BREAKER", updatedAt: NOW });
    reloadCampaignExecutionRepositoryForTests();
    expect(() => resumeCampaignExecution(value.executionPlanId)).not.toThrow();
    expect(getCampaignExecutionRuntimeState(value.executionPlanId)?.circuitState).toBe("OPEN");
  });

  test("27. circuit recovery requires explicit authority", () => {
    const value = plan(1);
    createCampaignExecutionRecordSet({ approval: approval(value), plan: value, records: [record(0, { campaignId: value.campaignId, executionPlanId: value.executionPlanId })] });
    checkpointCampaignExecutionRuntimeState({ executionPlanId: value.executionPlanId, circuitState: "OPEN", consecutiveInfrastructureFailures: 3, failureWindow: [true], pauseReason: "CIRCUIT_BREAKER", updatedAt: NOW });
    expect(() => recoverCampaignCircuit({ executionPlanId: value.executionPlanId, authorizedBy: "", recoveredAt: NOW })).toThrow("explicit operator authority");
    expect(recoverCampaignCircuit({ executionPlanId: value.executionPlanId, authorizedBy: "operator", recoveredAt: NOW }).circuitState).toBe("CLOSED");
  });

  test.each([
    ["APPROVED", "CLOSED", [record(1)], "HEALTHY"],
    ["PAUSED", "CLOSED", [record(1)], "PAUSED"],
    ["EXECUTING", "OPEN", [record(1)], "PAUSED"],
    ["EXECUTING", "CLOSED", [review(1, "QA_FAILURE")], "REVIEW_REQUIRED"],
    ["EXECUTING", "CLOSED", [record(1, { status: "FAILED" })], "DEGRADED"],
    ["FAILED", "CLOSED", [record(1, { status: "FAILED" })], "FAILED"],
  ] as const)("28. campaign health %s/%s resolves %s", (planStatus, circuitState, records, expected) => {
    expect(deriveCampaignHealth({
      plan: { ...plan(1), status: planStatus },
      runtimeState: { executionPlanId: "execution-plan-1", circuitState, consecutiveInfrastructureFailures: 0, failureWindow: [], pauseReason: null, updatedAt: NOW },
      records,
    })).toBe(expected);
  });

  test("33. scale ramp is explicit and never auto-advances", () => {
    expect(CAMPAIGN_SCALE_RAMP_POLICY.levels).toEqual([
      { level: "RAMP_0", maximumTargets: 1, concurrency: 1 },
      { level: "RAMP_1", maximumTargets: 3, concurrency: 1 },
      { level: "RAMP_2", maximumTargets: 10, concurrency: 2 },
      { level: "RAMP_3", maximumTargets: 25, concurrency: 2 },
      { level: "RAMP_4", maximumTargets: 100, concurrency: 2 },
    ]);
    expect(CAMPAIGN_SCALE_RAMP_POLICY).toMatchObject({ automaticAdvanceAllowed: false, requireAllSuccessfulDraftsQaPass: true, requireZeroAmbiguousExecution: true });
  });

  test("34. 10000 targets persist and account once with bounded policy", () => {
    const value = plan(10_000);
    const records = value.targetIds.map((targetId, index) => record(index, { targetId, campaignId: value.campaignId, executionPlanId: value.executionPlanId }));
    createCampaignExecutionRecordSet({ approval: approval(value), plan: value, records });
    expect(listCampaignTargetExecutionRecords(value.executionPlanId)).toHaveLength(10_000);
    expect(new Set(listCampaignTargetExecutionRecords(value.executionPlanId).map((entry) => entry.targetId)).size).toBe(10_000);
    expect(getCampaignExecutionPersistenceReplacementCount()).toBe(1);
    expect(CAMPAIGN_EXECUTION_LIMITS.maximumConcurrency).toBe(2);
  }, 30_000);

  test("35. publication remains unavailable and every plan is draft-only", () => {
    expect(plan(1).publicationIntent).toBe("draft");
    expect(CAMPAIGN_SCALE_RAMP_POLICY).not.toHaveProperty("publish");
  });
});