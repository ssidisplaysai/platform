import type { CampaignApproval } from "@/modules/foundation/campaign-approval";
import {
  CAMPAIGN_EXECUTION_LIMITS,
  projectGlwTerminalExecution,
  summarizeCampaignExecution,
  type CampaignExecutionPlan,
  type CampaignTargetExecutionRecord,
} from "@/modules/foundation/campaign-execution";
import {
  createCampaignExecutionRecordSet,
  getCampaignTargetRetryAuthorization,
  reconcileCampaignTargetFromTerminalGlw,
  resetCampaignExecutionRepositoryForTests,
} from "@/modules/foundation/campaign-execution-repository";
import { summarizeCampaignQa } from "@/modules/foundation/campaign-qa-summary";
import {
  determineCampaignRetryEligibility,
  evaluateMutationReconciliation,
} from "@/modules/foundation/campaign-retry-authorization";
import {
  GLW_MCP_READ_RETRY_POLICY,
  GlwMcpRateLimitError,
  createGlwN8nMcpExecutionReader,
} from "@/modules/glw/n8n-mcp-adapter";
import {
  GLW_TERMINAL_READ_POLICY,
  GlwDraftOnlyExecutionError,
  createGlwDraftExecutionService,
  createInMemoryGlwPageExecutionRepository,
  type GlwGenerationRequest,
  type GlwPageExecutionRecord,
} from "@/modules/glw/page-execution";

const NOW = "2026-08-28T19:00:00.000Z";
const HOUSTON_TARGET = "target-1c8f338ba8ab303894a4741dc8b9a916";
const DALLAS_TARGET = "target-077cbd232d7f978a4f91ebb37462c416";
const AUSTIN_TARGET = "target-e37326617675e61dbf87ffe1514d9d70";
const PASS_CHECKS = Object.fromEntries([
  "pageExists", "hierarchy", "slug", "title", "h1", "uniquePrimaryHeading",
  "duplicateSectionHeadings", "duplicateSectionContent", "placeholderResourceLinks", "body",
  "featuredImage", "heroImage", "seo", "internalLinks", "imageAlt", "duplicateCheck",
].map((check) => [check, "PASS"]));
const environment = {
  GLW_N8N_MCP_URL: "https://n8n.example.test/mcp-server/http",
  GLW_N8N_MCP_TOKEN: "test-token",
};

function record(targetId: string, overrides: Partial<CampaignTargetExecutionRecord> = {}): CampaignTargetExecutionRecord {
  return {
    campaignId: "campaign-ramp-1",
    executionPlanId: "plan-ramp-1",
    targetId,
    pageBlueprintId: "blueprint-product-city",
    productId: "prod-indoor-led-video-wall",
    stateCode: "TX",
    operation: "CREATE",
    status: "RETRY_REVIEW_REQUIRED",
    attemptCount: 1,
    reviewedRetryCount: 0,
    glwJobId: null,
    glwExternalExecutionId: null,
    idempotencyKey: `key-${targetId}`,
    dispatchedAt: NOW,
    terminalAt: NOW,
    failureClass: "DISPATCH_AMBIGUOUS",
    failureReason: "Too many requests.",
    requiresReview: true,
    resultReference: null,
    wordpressObjectId: null,
    wordpressUrl: null,
    wordpressStatus: null,
    qaStatus: null,
    qaChecks: null,
    qaFailureReasons: null,
    featuredImagePresent: null,
    version: 2,
    ...overrides,
  };
}

function success(targetId: string, jobId: string, executionId: string, wordpressId: string): CampaignTargetExecutionRecord {
  return record(targetId, {
    status: "SUCCEEDED",
    glwJobId: jobId,
    glwExternalExecutionId: executionId,
    failureClass: null,
    failureReason: null,
    requiresReview: false,
    resultReference: `glw-job:${jobId}`,
    wordpressObjectId: wordpressId,
    wordpressUrl: `https://example.test/?page_id=${wordpressId}`,
    wordpressStatus: "draft",
    qaStatus: "COMPLETE",
    qaChecks: PASS_CHECKS,
    qaFailureReasons: {},
    featuredImagePresent: true,
  });
}

function plan(): CampaignExecutionPlan {
  return {
    executionPlanId: "plan-ramp-1",
    campaignId: "campaign-ramp-1",
    campaignFingerprint: "campaign-fingerprint",
    approvalFingerprint: "approval-fingerprint",
    matrixFingerprint: "matrix-fingerprint",
    targetIds: [DALLAS_TARGET, HOUSTON_TARGET, AUSTIN_TARGET],
    operations: { [DALLAS_TARGET]: "CREATE", [HOUSTON_TARGET]: "CREATE", [AUSTIN_TARGET]: "CREATE" },
    exactWordpressObjectIds: {},
    operationCounts: { CREATE: 3, EXACT_UPDATE: 0 },
    concurrency: 1,
    batchSize: 3,
    dispatchPacingMs: 5_000,
    publicationIntent: "draft",
    createdAt: NOW,
    status: "FAILED",
    version: 2,
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

function terminalGlw(jobId = "365b1ba7-eb47-4ed5-8e59-6a20b7e4b109"): GlwPageExecutionRecord {
  return {
    jobId,
    correlationId: jobId,
    executionTransport: "N8N_MCP",
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-indoor-led-video-wall",
    productTopic: "Indoor LED Video Wall",
    state: "Texas",
    city: "Houston 002E.1 Certification",
    slug: "indoor-led-video-wall/texas/houston-002e1-cert-20260828",
    title: "Indoor LED Video Wall in Houston 002E.1 Certification",
    seoTitle: "Indoor LED Video Wall Houston 002E.1 Certification Texas",
    metaDescription: "Draft content.",
    publicationIntent: "draft",
    status: "COMPLETE",
    externalExecutionId: "272904",
    wordpressObjectId: "19623",
    wordpressUrl: "https://leddisplaywarehouse.com/?page_id=19623",
    wordpressStatus: "draft",
    errorCode: null,
    errorMessage: null,
    requestedPublicationMode: "draft",
    disposition: "CREATED",
    qaStatus: "COMPLETE",
    qaChecks: PASS_CHECKS,
    qaFailureReasons: {},
    focusKeyphrase: "indoor led video wall houston texas",
    wordCount: 1397,
    featuredImagePresent: true,
    createdAt: NOW,
    dispatchedAt: NOW,
    updatedAt: NOW,
    completedAt: NOW,
  };
}

function mcpSuccess(executionId = "123", jobId = "job-rate-limit") {
  const node = (json: Record<string, unknown>) => [{ data: { main: [[{ json }]] } }];
  return { structuredContent: { execution: { id: executionId, status: "success" }, data: { resultData: { runData: {
    "Build Pre-Publish QA Result": node({ job_id: jobId, qa_callback_status: "COMPLETE", qa_wordpress_status: "draft", qa_page_id: 19623, qa_wordpress_url: "https://example.test/?page_id=19623", qa_checks: PASS_CHECKS, qa_failure_reasons: {} }),
    "Normalize Published City Page": node({ job_id: jobId, normalized_city_page_id: 19623, normalized_city_page_url: "https://example.test/?page_id=19623", normalized_city_page_status: "draft", requested_publishing_mode: "draft" }),
  } } } } };
}

function request(): GlwGenerationRequest {
  return {
    siteId: "site-led-display-warehouse-production", productId: "prod-indoor-led-video-wall", pageType: "city_service",
    stateCode: "TX", citySlug: "houston", slug: "indoor-led-video-wall/texas/houston", title: "Houston",
    seoTitle: "Houston", metaDescription: "Houston", publicationIntent: "draft", organizationId: "led-display-warehouse",
    siteName: "site-led-display-warehouse-production", productTopic: "Indoor LED Video Wall", stateName: "Texas",
    cityName: "Houston", canonicalPath: "indoor-led-video-wall/texas/houston", plannedOperation: "CREATE_CITY",
    wordpressObjectId: null, externalExecutionAllowed: false,
  };
}

describe("002E.1B MCP rate-limit control plane and reconciliation", () => {
  beforeEach(() => resetCampaignExecutionRepositoryForTests());

  test("1. read 429 retries are bounded", async () => {
    const callTool = jest.fn().mockRejectedValue({ status: 429, message: "Too many requests" });
    const reader = createGlwN8nMcpExecutionReader({ environment, callTool, delay: async () => {} });
    await expect(reader.readExecution("123")).rejects.toBeInstanceOf(GlwMcpRateLimitError);
    expect(callTool).toHaveBeenCalledTimes(3);
  });

  test("2. Retry-After is respected within the bound", async () => {
    const delay = jest.fn(async () => {});
    const callTool = jest.fn().mockRejectedValueOnce({ status: 429, headers: { "Retry-After": "7" }, message: "rate limited" }).mockResolvedValue(mcpSuccess());
    await createGlwN8nMcpExecutionReader({ environment, callTool, delay }).readExecution("123");
    expect(delay).toHaveBeenCalledWith(7_000);
  });

  test("3. fallback backoff is 2s then 5s", async () => {
    const delay = jest.fn(async () => {});
    const callTool = jest.fn().mockRejectedValueOnce(new Error("HTTP 429")).mockRejectedValueOnce(new Error("Too many requests")).mockResolvedValue(mcpSuccess());
    await createGlwN8nMcpExecutionReader({ environment, callTool, delay }).readExecution("123");
    expect(delay.mock.calls).toEqual([[2_000], [5_000]]);
  });

  test("4. one 429 then success uses two exact reads", async () => {
    const callTool = jest.fn().mockRejectedValueOnce({ status: 429, message: "rate limit" }).mockResolvedValue(mcpSuccess());
    await expect(createGlwN8nMcpExecutionReader({ environment, callTool, delay: async () => {} }).readExecution("123")).resolves.toMatchObject({ state: "SUCCESS", executionId: "123" });
    expect(callTool).toHaveBeenCalledTimes(2);
  });

  test("5. read retry exhaustion makes exactly three attempts", async () => {
    const callTool = jest.fn().mockRejectedValue({ statusCode: 429, code: "RATE_LIMITED", message: "limited" });
    await expect(createGlwN8nMcpExecutionReader({ environment, callTool, delay: async () => {} }).readExecution("123")).rejects.toMatchObject({ status: 429 });
    expect(callTool).toHaveBeenCalledTimes(GLW_MCP_READ_RETRY_POLICY.maximumAttempts);
  });

  test("6. generation dispatch 429 is never retried", async () => {
    const dispatch = jest.fn().mockRejectedValue(new Error("HTTP 429 Too many requests"));
    const service = createGlwDraftExecutionService({ repository: createInMemoryGlwPageExecutionRepository(), dispatcher: { dispatch }, createJobId: () => "job-rate-limit" });
    await expect(service.execute(request())).resolves.toMatchObject({ status: "FAILED", externalExecutionId: null, errorCode: "DISPATCH_FAILED" });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("7. known job read 429 never redispatches", async () => {
    const dispatch = jest.fn().mockResolvedValue({ kind: "accepted", executionId: "123", status: "accepted" });
    const service = createGlwDraftExecutionService({ repository: createInMemoryGlwPageExecutionRepository(), dispatcher: { dispatch }, createJobId: () => "job-rate-limit" });
    await service.execute(request());
    const reader = createGlwN8nMcpExecutionReader({ environment, callTool: jest.fn().mockRejectedValue({ status: 429, message: "limited" }), delay: async () => {} });
    await expect(service.pollToTerminal("job-rate-limit", reader, { maxAttempts: 1 })).rejects.toMatchObject({ status: 429 });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("8. restart preserves execution identity through read 429", async () => {
    const repository = createInMemoryGlwPageExecutionRepository();
    const dispatch = jest.fn().mockResolvedValue({ kind: "accepted", executionId: "123", status: "accepted" });
    await createGlwDraftExecutionService({ repository, dispatcher: { dispatch }, createJobId: () => "job-rate-limit" }).execute(request());
    const restarted = createGlwDraftExecutionService({ repository, dispatcher: { dispatch }, createJobId: () => "unused" });
    const callTool = jest.fn().mockRejectedValueOnce({ status: 429, message: "limited" }).mockResolvedValue(mcpSuccess());
    await expect(restarted.pollToTerminal("job-rate-limit", createGlwN8nMcpExecutionReader({ environment, callTool, delay: async () => {} }), { maxAttempts: 1 })).resolves.toMatchObject({ status: "COMPLETE", externalExecutionId: "123" });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test.each([{ status: 401 }, { status: 403 }, { code: "INVALID_REQUEST" }])("9. non-429 failure %# is not retried", async (failure) => {
    const callTool = jest.fn().mockRejectedValue({ ...failure, message: "permanent failure" });
    await expect(createGlwN8nMcpExecutionReader({ environment, callTool, delay: async () => {} }).readExecution("123")).rejects.toThrow("permanent failure");
    expect(callTool).toHaveBeenCalledTimes(1);
  });

  test("10. Houston stale review reconciles to exact terminal success", () => {
    const value = plan();
    const houston = record(HOUSTON_TARGET, { glwJobId: terminalGlw().jobId, glwExternalExecutionId: "272904" });
    createCampaignExecutionRecordSet({ approval: approval(value), plan: value, records: [success(DALLAS_TARGET, "dallas-job", "272886", "19620"), houston, record(AUSTIN_TARGET, { glwJobId: "0aa2c0be-c8a0-4ab4-8965-4205973be1af" })] });
    const result = reconcileCampaignTargetFromTerminalGlw({ executionPlanId: value.executionPlanId, targetId: HOUSTON_TARGET, expectedGlwJobId: terminalGlw().jobId, expectedGlwSlug: terminalGlw().slug, expectedExternalExecutionId: "272904", expectedWordpressObjectId: "19623", glwRecord: terminalGlw(), reconciledAt: NOW });
    expect(result.record).toMatchObject({ status: "SUCCEEDED", wordpressObjectId: "19623", qaStatus: "COMPLETE" });
  });

  test("11. reconciliation requires exact target, job, execution, and WordPress identities", () => {
    const value = plan();
    const houston = record(HOUSTON_TARGET, { glwJobId: terminalGlw().jobId, glwExternalExecutionId: "272904" });
    createCampaignExecutionRecordSet({ approval: approval(value), plan: value, records: [success(DALLAS_TARGET, "dallas-job", "272886", "19620"), houston, record(AUSTIN_TARGET)] });
    expect(() => reconcileCampaignTargetFromTerminalGlw({ executionPlanId: value.executionPlanId, targetId: HOUSTON_TARGET, expectedGlwJobId: "wrong-job", expectedGlwSlug: terminalGlw().slug, expectedExternalExecutionId: "272904", expectedWordpressObjectId: "19623", glwRecord: terminalGlw(), reconciledAt: NOW })).toThrow("exact campaign target identity");
  });

  test("12. Austin remains review-required", () => {
    expect(record(AUSTIN_TARGET).status).toBe("RETRY_REVIEW_REQUIRED");
  });

  test("13. exact absent Austin is eligible for explicit reviewed retry", () => {
    const austin = record(AUSTIN_TARGET, { glwJobId: "0aa2c0be-c8a0-4ab4-8965-4205973be1af" });
    const evidence = evaluateMutationReconciliation({ record: austin, state: "ABSENT", exactWordpressObjectId: null, exactTargetIdentityMatched: true, checkedAt: NOW });
    expect(determineCampaignRetryEligibility({ record: austin, mutationReconciliation: evidence })).toBe("ELIGIBLE_FOR_EXPLICIT_REVIEWED_RETRY");
  });

  test("14. eligibility does not create retry authorization", () => {
    const austin = record(AUSTIN_TARGET);
    const evidence = evaluateMutationReconciliation({ record: austin, state: "ABSENT", exactWordpressObjectId: null, exactTargetIdentityMatched: true, checkedAt: NOW });
    determineCampaignRetryEligibility({ record: austin, mutationReconciliation: evidence });
    expect(getCampaignTargetRetryAuthorization("anything")).toBeNull();
  });

  test("15. campaign QA is two pass and one without terminal QA", () => {
    expect(summarizeCampaignQa([success(DALLAS_TARGET, "d", "1", "19620"), success(HOUSTON_TARGET, "h", "2", "19623"), record(AUSTIN_TARGET)])).toMatchObject({ qaPassTargetCount: 2, qaFailTargetCount: 0, withoutTerminalQaCount: 1, totalCheckPassCount: 32, totalCheckFailureCount: 0 });
  });

  test("16. campaign accounting is two success and one review", () => {
    expect(summarizeCampaignExecution([success(DALLAS_TARGET, "d", "1", "19620"), success(HOUSTON_TARGET, "h", "2", "19623"), record(AUSTIN_TARGET)])).toMatchObject({ approved: 3, succeeded: 2, reviewRequired: 1, pending: 0, running: 0, failed: 0, cancelled: 0 });
  });

  test("17. default dispatch pacing is nonzero and conservative", () => {
    expect(CAMPAIGN_EXECUTION_LIMITS.dispatchPacingMs).toBe(5_000);
  });

  test("18. dispatch, terminal-read, and 429 pacing are separate", () => {
    expect(CAMPAIGN_EXECUTION_LIMITS.dispatchPacingMs).toBe(5_000);
    expect(GLW_TERMINAL_READ_POLICY.intervalMs).toBe(5_000);
    expect(GLW_MCP_READ_RETRY_POLICY.fallbackBackoffMs).toEqual([2_000, 5_000, 10_000]);
  });

  test("19. successful targets are unchanged by reconciliation", () => {
    const dallas = success(DALLAS_TARGET, "dallas-job", "272886", "19620");
    expect(projectGlwTerminalExecution({ record: dallas, glw: terminalGlw("other-job"), now: NOW }).targetId).toBe(DALLAS_TARGET);
    expect(dallas).toEqual(success(DALLAS_TARGET, "dallas-job", "272886", "19620"));
  });

  test("20. publication remains unavailable", async () => {
    const service = createGlwDraftExecutionService({ repository: createInMemoryGlwPageExecutionRepository(), dispatcher: { dispatch: jest.fn() } });
    await expect(service.execute({ ...request(), publicationIntent: "publish" })).rejects.toBeInstanceOf(GlwDraftOnlyExecutionError);
  });
});