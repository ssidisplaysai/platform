import {
  archiveExecution,
  completeExecution,
  createExecution,
  createExecutionRevision,
  getExecutionById,
  listExecutionActivities,
  listExecutionAuditEvents,
  listExecutionPublishedEvents,
  listExecutionTimeline,
  markExecutionReady,
  pauseExecution,
  recoverExecution,
  resetExecutionRepositoryForTests,
  resumeExecution,
  searchExecutionRegistry,
  startExecution,
  updateExecutionDraft,
} from "@/modules/foundation/execution-repository";

function createExecutionPayload() {
  return {
    organizationId: "led-display-warehouse",
    customerReference: "cust-ledw-stadium-group",
    ownerReference: "owner-ledw-commerce",
    salesRepresentativeReference: null,
    siteReference: "site-led-display-warehouse-production",
    executionNumber: null,
    executionName: "Stadium wall execution",
    scheduleId: "schedule-ledw-001",
    productionJobId: null,
    operationId: null,
    routingVersionId: null,
    workOrderId: "work-order-ledw-001",
    originSalesOrderId: "sales-order-ledw-001",
    originQuoteId: "quote-ledw-001",
    progress: 5,
    actualStart: null,
    actualFinish: null,
    elapsedDurationMinutes: null,
    estimatedDurationMinutes: 180,
    notes: "Initial execution tracking",
    attachments: [],
    operatorReferences: [],
    machineReferences: [],
    telemetryReferences: [],
    lineage: {
      scheduleId: "schedule-ledw-001",
      productionJobId: null,
      operationId: null,
      routingVersionId: null,
      workOrderId: "work-order-ledw-001",
      originSalesOrderId: "sales-order-ledw-001",
      originQuoteId: "quote-ledw-001",
      organizationId: "led-display-warehouse",
      siteReference: "site-led-display-warehouse-production",
      correlationId: "corr-execution-001",
      causationId: "cause-execution-001",
      createdBy: "planner",
      createdTimestamp: "2026-07-29T00:00:00.000Z",
    },
    metadata: { source: "test" },
  };
}

describe("GMP-0008A execution foundation", () => {
  beforeEach(() => {
    resetExecutionRepositoryForTests();
  });

  test("creates executions, tracks activities, and rejects duplicate planning lineage", () => {
    const created = createExecution({
      payload: createExecutionPayload(),
      actor: "planner",
    });

    expect(created.validation.valid).toBe(true);
    expect(created.execution).toBeTruthy();
    expect(created.execution?.status).toBe("created");
    expect(created.execution?.activities.length).toBe(1);

    const duplicate = createExecution({
      payload: createExecutionPayload(),
      actor: "planner",
    });

    expect(duplicate.validation.valid).toBe(false);
    expect(duplicate.validation.issues[0]?.field).toContain("lineage");
  });

  test("supports deterministic lifecycle transitions, revisions, audit, timeline, and search", () => {
    const created = createExecution({
      payload: createExecutionPayload(),
      actor: "planner",
    });

    const executionId = created.execution?.documentId as string;

    expect(updateExecutionDraft({
      executionId,
      patch: { executionName: "Stadium wall execution revised" },
      actor: "planner",
      expectedVersion: 1,
    }).validation.valid).toBe(true);

    expect(createExecutionRevision({
      executionId,
      author: "planner",
      actor: "planner",
      reason: "Clarified execution naming",
      changedFields: ["executionName"],
      expectedVersion: 2,
    }).validation.valid).toBe(true);

    expect(markExecutionReady({ executionId, actor: "planner" }).validation.valid).toBe(true);
    expect(startExecution({ executionId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(pauseExecution({ executionId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(resumeExecution({ executionId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(completeExecution({ executionId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(archiveExecution({ executionId, actor: "supervisor" }).validation.valid).toBe(true);

    const cancelledAfterArchive = recoverExecution({ executionId, actor: "supervisor" });
    expect(cancelledAfterArchive.validation.valid).toBe(false);

    const auditEvents = listExecutionAuditEvents(executionId);
    expect(auditEvents.length).toBeGreaterThan(0);
    expect(auditEvents.some((event) => event.action === "execution_revision_created")).toBe(true);
    expect(auditEvents.some((event) => event.action === "execution_started")).toBe(true);
    expect(auditEvents.some((event) => event.action === "execution_archived")).toBe(true);

    const publishedEvents = listExecutionPublishedEvents(executionId);
    expect(publishedEvents.some((event) => event.type === "ExecutionCreated")).toBe(true);
    expect(publishedEvents.some((event) => event.type === "ExecutionRevised")).toBe(true);
    expect(publishedEvents.some((event) => event.type === "ExecutionArchived")).toBe(true);

    const activities = listExecutionActivities(executionId);
    expect(activities.length).toBeGreaterThan(0);

    const timeline = listExecutionTimeline(executionId);
    expect(timeline.length).toBeGreaterThan(0);

    const search = searchExecutionRegistry({
      organizationId: "led-display-warehouse",
      query: "stadium wall",
    });
    expect(search.length).toBeGreaterThan(0);
    expect(search[0]?.executionId).toBe(executionId);

    expect(getExecutionById(executionId)?.status).toBe("archived");
  });
});
