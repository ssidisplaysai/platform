jest.mock("@/modules/foundation/foundation-persistence", () => {
  const actual = jest.requireActual("@/modules/foundation/foundation-persistence");
  return {
    ...actual,
    savePersistedState: jest.fn(() => {
      throw new Error("forced persistence failure");
    }),
  };
});

import {
  createExecution,
  listExecutionAuditEvents,
  listExecutionPublishedEvents,
  listExecutions,
  resetExecutionRepositoryForTests,
} from "@/modules/foundation/execution-repository";

function createExecutionPayload() {
  return {
    organizationId: "led-display-warehouse",
    customerReference: "cust-ledw-stadium-group",
    ownerReference: "owner-ledw-commerce",
    salesRepresentativeReference: null,
    siteReference: "site-led-display-warehouse-production",
    executionNumber: null,
    executionName: "Rollback execution",
    scheduleId: "schedule-ledw-rollback",
    productionJobId: null,
    operationId: null,
    routingVersionId: null,
    workOrderId: "work-order-ledw-rollback",
    originSalesOrderId: "sales-order-ledw-rollback",
    originQuoteId: "quote-ledw-rollback",
    progress: 1,
    actualStart: null,
    actualFinish: null,
    elapsedDurationMinutes: null,
    estimatedDurationMinutes: 30,
    notes: null,
    attachments: [],
    operatorReferences: [],
    machineReferences: [],
    telemetryReferences: [],
    lineage: {
      scheduleId: "schedule-ledw-rollback",
      productionJobId: null,
      operationId: null,
      routingVersionId: null,
      workOrderId: "work-order-ledw-rollback",
      originSalesOrderId: "sales-order-ledw-rollback",
      originQuoteId: "quote-ledw-rollback",
      organizationId: "led-display-warehouse",
      siteReference: "site-led-display-warehouse-production",
      correlationId: "corr-rollback-001",
      causationId: "cause-rollback-001",
      createdBy: "planner",
      createdTimestamp: "2026-07-29T00:00:00.000Z",
    },
    metadata: { source: "test" },
  };
}

describe("GMP-0008A execution rollback safety", () => {
  beforeEach(() => {
    resetExecutionRepositoryForTests();
  });

  test("failed persistence leaves no partial aggregate, audit, revision, or event state", () => {
    const result = createExecution({
      payload: createExecutionPayload(),
      actor: "planner",
    });

    expect(result.execution).toBeNull();
    expect(result.validation.valid).toBe(false);
    expect(listExecutions()).toHaveLength(0);
    expect(listExecutionAuditEvents("execution-led-display-warehouse-000001")).toHaveLength(0);
    expect(listExecutionPublishedEvents("execution-led-display-warehouse-000001")).toHaveLength(0);
  });
});
