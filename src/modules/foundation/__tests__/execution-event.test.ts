import {
  archiveExecution,
  completeExecution,
  createExecution,
  createExecutionRevision,
  blockExecution,
  getExecutionById,
  listExecutionPublishedEvents,
  markExecutionReady,
  pauseExecution,
  resetExecutionRepositoryForTests,
  resumeExecution,
  startExecution,
  updateExecutionDraft,
  waitExecution,
} from "@/modules/foundation/execution-repository";

function createExecutionPayload(input: {
  executionName: string;
  scheduleId: string;
  workOrderId: string;
  correlationId: string;
  causationId: string;
}) {
  return {
    organizationId: "led-display-warehouse",
    customerReference: "cust-ledw-stadium-group",
    ownerReference: "owner-ledw-commerce",
    salesRepresentativeReference: null,
    siteReference: "site-led-display-warehouse-production",
    executionNumber: null,
    executionName: input.executionName,
    scheduleId: input.scheduleId,
    productionJobId: null,
    operationId: null,
    routingVersionId: null,
    workOrderId: input.workOrderId,
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
      scheduleId: input.scheduleId,
      productionJobId: null,
      operationId: null,
      routingVersionId: null,
      workOrderId: input.workOrderId,
      originSalesOrderId: "sales-order-ledw-001",
      originQuoteId: "quote-ledw-001",
      organizationId: "led-display-warehouse",
      siteReference: "site-led-display-warehouse-production",
      correlationId: input.correlationId,
      causationId: input.causationId,
      createdBy: "planner",
      createdTimestamp: "2026-07-29T00:00:00.000Z",
    },
    metadata: { source: "test" },
  };
}

describe("GMP-0008A execution events", () => {
  beforeEach(() => {
    resetExecutionRepositoryForTests();
  });

  test("ExecutionCreated is recorded with the full immutable envelope", () => {
    const created = createExecution({
      payload: createExecutionPayload({
        executionName: "Envelope execution",
        scheduleId: "schedule-ledw-001",
        workOrderId: "work-order-ledw-001",
        correlationId: "corr-envelope-001",
        causationId: "cause-envelope-001",
      }),
      actor: "planner",
    });

    expect(created.execution).toBeTruthy();
    const executionId = created.execution?.documentId as string;
    const events = listExecutionPublishedEvents(executionId);
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.eventType).toBe("ExecutionCreated");
    expect(event.type).toBe("ExecutionCreated");
    expect(event.contractVersion).toBe("v1.0.0");
    expect(event.aggregateType).toBe("execution");
    expect(event.aggregateId).toBe(executionId);
    expect(event.aggregateVersion).toBe(1);
    expect(event.organizationId).toBe("led-display-warehouse");
    expect(event.siteId).toBe("site-led-display-warehouse-production");
    expect(event.actorId).toBe("planner");
    expect(event.correlationId).toBe("corr-envelope-001");
    expect(event.causationId).toBe("cause-envelope-001");
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(Object.isFrozen(event.metadata)).toBe(true);
    expect(event.payload.scheduleId).toBe("schedule-ledw-001");
    expect(event.payload.workOrderId).toBe("work-order-ledw-001");
    expect(event.payload.originSalesOrderId).toBe("sales-order-ledw-001");
    expect(event.payload.originQuoteId).toBe("quote-ledw-001");
    expect(event.payload.executionActivityId).toBeTruthy();

    const originalExecutionName = event.payload.executionName;
    try {
      (event.payload as Record<string, string | number | boolean | null>).executionName = "mutated";
    } catch {
      // frozen objects can throw in strict mode
    }
    expect(event.payload.executionName).toBe(originalExecutionName);
  });

  test("execution lifecycle events preserve version order and lineage", () => {
    const created = createExecution({
      payload: createExecutionPayload({
        executionName: "Lifecycle execution",
        scheduleId: "schedule-ledw-002",
        workOrderId: "work-order-ledw-002",
        correlationId: "corr-lifecycle-001",
        causationId: "cause-lifecycle-001",
      }),
      actor: "planner",
    });
    const executionId = created.execution?.documentId as string;

    expect(updateExecutionDraft({
      executionId,
      patch: { executionName: "Lifecycle execution updated" },
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
    expect(waitExecution({ executionId, actor: "planner", reason: "Awaiting upstream signal" }).validation.valid).toBe(true);
    expect(startExecution({ executionId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(pauseExecution({ executionId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(resumeExecution({ executionId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(completeExecution({ executionId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(archiveExecution({ executionId, actor: "supervisor" }).validation.valid).toBe(true);

    const events = listExecutionPublishedEvents(executionId);
    expect(events.map((event) => event.eventType)).toEqual([
      "ExecutionCreated",
      "ExecutionUpdated",
      "ExecutionRevised",
      "ExecutionReady",
      "ExecutionWaiting",
      "ExecutionStarted",
      "ExecutionPaused",
      "ExecutionResumed",
      "ExecutionCompleted",
      "ExecutionArchived",
    ]);
    expect(events.map((event) => event.aggregateVersion)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const completedEvent = events.find((event) => event.eventType === "ExecutionCompleted");
    expect(completedEvent?.payload.scheduleId).toBe("schedule-ledw-002");
    expect(completedEvent?.payload.workOrderId).toBe("work-order-ledw-002");
    expect(completedEvent?.payload.executionId).toBe(executionId);
    expect(completedEvent?.payload.executionActivityId).toBeTruthy();
    expect(completedEvent?.organizationId).toBe("led-display-warehouse");
    expect(completedEvent?.siteId).toBe("site-led-display-warehouse-production");

    const blockedSource = createExecution({
      payload: createExecutionPayload({
        executionName: "Blocked execution",
        scheduleId: "schedule-ledw-003",
        workOrderId: "work-order-ledw-003",
        correlationId: "corr-blocked-001",
        causationId: "cause-blocked-001",
      }),
      actor: "planner",
    });
    const blockedId = blockedSource.execution?.documentId as string;
    expect(markExecutionReady({ executionId: blockedId, actor: "planner" }).validation.valid).toBe(true);
    expect(startExecution({ executionId: blockedId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(blockExecution({ executionId: blockedId, actor: "supervisor", reason: "Temporary upstream hold" }).validation.valid).toBe(true);
    expect(completeExecution({ executionId: blockedId, actor: "supervisor", reason: "Completed after hold" }).validation.valid).toBe(true);

    const cancelledSource = createExecution({
      payload: createExecutionPayload({
        executionName: "Cancelled execution",
        scheduleId: "schedule-ledw-004",
        workOrderId: "work-order-ledw-004",
        correlationId: "corr-cancel-001",
        causationId: "cause-cancel-001",
      }),
      actor: "planner",
    });
    const cancelledId = cancelledSource.execution?.documentId as string;
    expect(markExecutionReady({ executionId: cancelledId, actor: "planner" }).validation.valid).toBe(true);
    expect(waitExecution({ executionId: cancelledId, actor: "planner", reason: "Waiting before release" }).validation.valid).toBe(true);
    expect(startExecution({ executionId: cancelledId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(completeExecution({ executionId: cancelledId, actor: "supervisor", reason: "Completed before archive" }).validation.valid).toBe(true);
    expect(archiveExecution({ executionId: cancelledId, actor: "supervisor" }).validation.valid).toBe(true);

    const blockedEvents = listExecutionPublishedEvents(blockedId).map((event) => event.eventType);
    expect(blockedEvents).toContain("ExecutionBlocked");
    expect(blockedEvents).toContain("ExecutionCompleted");

    const cancelledEvents = listExecutionPublishedEvents(cancelledId).map((event) => event.eventType);
    expect(cancelledEvents).toContain("ExecutionArchived");
  });

  test("invalid transitions do not emit success events", () => {
    const created = createExecution({
      payload: createExecutionPayload({
        executionName: "Invalid transition execution",
        scheduleId: "schedule-ledw-005",
        workOrderId: "work-order-ledw-005",
        correlationId: "corr-invalid-001",
        causationId: "cause-invalid-001",
      }),
      actor: "planner",
    });
    const executionId = created.execution?.documentId as string;
    const beforeEvents = listExecutionPublishedEvents(executionId);

    const invalid = completeExecution({ executionId, actor: "supervisor" });
    expect(invalid.validation.valid).toBe(false);
    expect(listExecutionPublishedEvents(executionId)).toHaveLength(beforeEvents.length);
    expect(getExecutionById(executionId)?.status).toBe("created");
  });
});
