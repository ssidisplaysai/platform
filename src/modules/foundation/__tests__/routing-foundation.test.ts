import {
  acceptQuote,
  addQuoteLine,
  approveQuote,
  createQuote,
  presentQuote,
  resetQuoteRepositoryForTests,
  submitQuote,
} from "@/modules/foundation/quote-repository";
import {
  approveSalesOrder,
  createSalesOrderFromQuote,
  resetSalesOrderRepositoryForTests,
} from "@/modules/foundation/sales-order-repository";
import {
  createWorkOrderFromOrder,
  planWorkOrder,
  releaseWorkOrder,
  resetWorkOrderRepositoryForTests,
} from "@/modules/foundation/work-order-repository";
import {
  createProductionJobFromWorkOrder,
  resetProductionJobRepositoryForTests,
} from "@/modules/foundation/production-job-repository";
import {
  archiveRouting,
  closeRouting,
  createRouting,
  createRoutingVersion,
  defineRouting,
  getRoutingById,
  listRoutingAuditEvents,
  listRoutingPublishedEvents,
  listRoutingTimeline,
  listRoutingVersions,
  releaseRouting,
  resetRoutingRepositoryForTests,
  searchRoutingRegistry,
  updateRoutingDraft,
} from "@/modules/foundation/routing-repository";

function createInstantiatedLineage() {
  const created = createQuote({
    organizationId: "led-display-warehouse",
    customerReference: "cust-ledw-stadium-group",
    primaryContactReference: null,
    ownerReference: "owner-ledw-commerce",
    salesRepresentativeReference: "sales-ledw-001",
    siteReference: "site-led-display-warehouse-production",
    currency: "USD",
    effectiveDate: "2026-01-01T00:00:00.000Z",
    expirationDate: "2026-01-31T00:00:00.000Z",
    commercialTerms: {
      paymentTermsReference: "net-30",
      freightTermsReference: "fob",
      exchangeRate: 1,
    },
    internalNotes: null,
    customerNotes: null,
    metadata: { source: "test" },
    actor: "test",
  });

  const quoteId = created.quote?.documentId as string;

  addQuoteLine({
    quoteId,
    actor: "test",
    line: {
      productId: "prod-led-routing",
      sku: "LED-RTE-001",
      productRevision: "rev-1",
      catalogRevision: "cat-1",
      displayName: "Routing Product",
      description: null,
      quantity: 1,
      unitOfMeasure: "ea",
      unitPrice: 500,
      discount: 0,
      currency: "USD",
      taxClassification: null,
      siteReference: "site-led-display-warehouse-production",
      metadata: {},
    },
  });

  submitQuote({ quoteId, actor: "sales-manager", notes: null });
  approveQuote({ quoteId, actor: "sales-manager", notes: "approved" });
  presentQuote({ quoteId, actor: "sales-rep", notes: null });
  acceptQuote({ quoteId, actor: "customer", notes: "accepted" });

  const order = createSalesOrderFromQuote({
    payload: { quoteId, referenceNumber: "SO-RTE-001" },
    actor: "sales-rep",
  });

  const orderId = order.order?.documentId as string;
  approveSalesOrder({ orderId, actor: "sales-manager", notes: "approved for routing lineage" });

  const workOrder = createWorkOrderFromOrder({
    payload: {
      orderId,
      referenceNumber: "WO-RTE-001",
      correlationId: null,
      causationId: null,
    },
    actor: "planner",
  });

  const workOrderId = workOrder.workOrder?.documentId as string;
  planWorkOrder({ workOrderId, actor: "planner" });
  releaseWorkOrder({ workOrderId, actor: "planner" });

  const productionJob = createProductionJobFromWorkOrder({
    payload: {
      workOrderId,
      referenceNumber: "PJ-RTE-001",
      executionContext: "line-a",
      correlationId: null,
      causationId: null,
    },
    actor: "planner",
  });

  return {
    quoteId,
    orderId,
    workOrderId,
    productionJobId: productionJob.productionJob?.documentId as string,
  };
}

function buildRoutingInput(lineage: { quoteId: string; orderId: string; workOrderId: string; productionJobId: string }) {
  return {
    organizationId: "led-display-warehouse",
    customerReference: "cust-ledw-stadium-group",
    ownerReference: "owner-ledw-engineering",
    salesRepresentativeReference: "sales-ledw-001",
    siteReference: "site-led-display-warehouse-production",
    routingNumber: "RT-2026-LEDW-0001",
    routingName: "Cabinet Routing",
    description: "Defines the cabinet manufacturing path",
    effectiveDate: "2026-02-01T00:00:00.000Z",
    productReference: "prod-led-cabinet",
    assemblyReference: "asm-led-cabinet",
    operationSequence: [
      {
        stepId: "step-cut",
        operationReference: "op-cut",
        sequenceNumber: 1,
        predecessorOperationIds: [],
        successorOperationIds: ["step-assemble"],
        parallelGroupReference: null,
        conditionalBranchReference: null,
        estimatedCycleTimeMinutes: 20,
        estimatedSetupTimeMinutes: 5,
        estimatedRunTimeMinutes: 15,
        estimatedChangeoverTimeMinutes: 2,
        referencedWorkCenter: "wc-cutting-01",
        referencedMachineType: "mt-cutter-01",
        referencedSkill: "operator",
        engineeringNotes: null,
        referenceDocuments: ["doc-cut-001"],
      },
      {
        stepId: "step-assemble",
        operationReference: "op-assemble",
        sequenceNumber: 2,
        predecessorOperationIds: ["step-cut"],
        successorOperationIds: [],
        parallelGroupReference: null,
        conditionalBranchReference: null,
        estimatedCycleTimeMinutes: 45,
        estimatedSetupTimeMinutes: 10,
        estimatedRunTimeMinutes: 35,
        estimatedChangeoverTimeMinutes: 5,
        referencedWorkCenter: "wc-assembly-01",
        referencedMachineType: "mt-assembly-01",
        referencedSkill: "assembler",
        engineeringNotes: "Reference only",
        referenceDocuments: ["doc-asm-001"],
      },
    ],
    parallelOperationGroups: [{ groupId: "group-1", operationReferences: ["op-cut", "op-assemble"], branchReference: null }],
    conditionalBranchReferences: ["branch-main"],
    estimatedCycleTimeMinutes: 65,
    estimatedSetupTimeMinutes: 15,
    estimatedRunTimeMinutes: 50,
    estimatedChangeoverTimeMinutes: 7,
    referencedWorkCenters: ["wc-cutting-01", "wc-assembly-01"],
    referencedMachineTypes: ["mt-cutter-01", "mt-assembly-01"],
    referencedSkills: ["operator", "assembler"],
    engineeringNotes: "Declarative routing only",
    referenceDocuments: ["eng-doc-001"],
    lineage: {
      productionJobId: lineage.productionJobId,
      productionJobRevision: 1,
      workOrderId: lineage.workOrderId,
      workOrderRevision: 1,
      originSalesOrderId: lineage.orderId,
      originSalesOrderRevision: 1,
      originQuoteId: lineage.quoteId,
      originQuoteRevision: 1,
      organizationId: "led-display-warehouse",
      siteReference: "site-led-display-warehouse-production",
      correlationId: "corr-routing-001",
      causationId: "cause-routing-001",
      createdBy: "planner",
      createdTimestamp: "2026-02-01T00:00:00.000Z",
      manufacturingVersion: "gmp-routing-v1",
    },
    metadata: { source: "test" },
  };
}

describe("GMP-0005 routing foundation", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
    resetSalesOrderRepositoryForTests();
    resetWorkOrderRepositoryForTests();
    resetProductionJobRepositoryForTests();
    resetRoutingRepositoryForTests();
  });

  test("creates routings with lineage and deterministic operation sequencing", () => {
    const lineage = createInstantiatedLineage();
    const created = createRouting({ payload: buildRoutingInput(lineage), actor: "planner" });

    expect(created.validation.valid).toBe(true);
    expect(created.routing).toBeTruthy();
    expect(created.routing?.lineage.productionJobId).toBe(lineage.productionJobId);
    expect(created.routing?.operationSequence).toHaveLength(2);

    const duplicate = createRouting({ payload: buildRoutingInput(lineage), actor: "planner" });
    expect(duplicate.validation.valid).toBe(true);
    expect(duplicate.routing?.documentId).not.toBe(created.routing?.documentId);
  });

  test("lifecycle transitions publish events and enforce terminal guards", () => {
    const lineage = createInstantiatedLineage();
    const created = createRouting({ payload: buildRoutingInput(lineage), actor: "planner" });
    const routingId = created.routing?.documentId as string;

    expect(defineRouting({ routingId, actor: "planner" }).validation.valid).toBe(true);
    expect(releaseRouting({ routingId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(archiveRouting({ routingId, actor: "supervisor" }).validation.valid).toBe(true);
    expect(closeRouting({ routingId, actor: "supervisor" }).validation.valid).toBe(true);

    const invalidRelease = releaseRouting({ routingId, actor: "supervisor" });
    expect(invalidRelease.validation.valid).toBe(false);

    const events = listRoutingPublishedEvents(routingId);
    expect(events.some((event) => event.type === "RoutingCreated")).toBe(true);
    expect(events.some((event) => event.type === "RoutingReleased")).toBe(true);
    expect(events.some((event) => event.type === "RoutingArchived")).toBe(true);
    expect(events.some((event) => event.type === "RoutingClosed")).toBe(true);
  });

  test("version history, audit, timeline, and search remain immutable and traceable", () => {
    const lineage = createInstantiatedLineage();
    const created = createRouting({ payload: buildRoutingInput(lineage), actor: "planner" });
    const routingId = created.routing?.documentId as string;

    const updated = updateRoutingDraft({
      routingId,
      patch: { routingName: "Cabinet Routing Updated", referenceDocuments: ["eng-doc-001", "eng-doc-002"] },
      actor: "engineer",
    });

    expect(updated.validation.valid).toBe(true);

    const version = createRoutingVersion({
      routingId,
      actor: "engineer",
      reason: "Publish routing revision",
      changedFields: ["routingName", "referenceDocuments"],
    });

    expect(version.validation.valid).toBe(true);
    expect(listRoutingVersions(routingId).length).toBeGreaterThan(1);
    expect(listRoutingVersions(routingId)[0]?.routingName).toBe("Cabinet Routing");

    const audit = listRoutingAuditEvents(routingId);
    expect(audit.length).toBeGreaterThan(0);

    const timeline = listRoutingTimeline(routingId);
    expect(timeline.length).toBeGreaterThan(0);

    const search = searchRoutingRegistry({ organizationId: "led-display-warehouse", query: "RT-2026-LEDW-0001" });
    expect(search.length).toBeGreaterThan(0);
    expect(search[0]?.routingId).toBe(routingId);

    const stored = getRoutingById(routingId);
    expect(stored?.revisionHistory.length).toBeGreaterThan(1);
  });

  test("rejects cyclic operation sequencing without partial persistence", () => {
    const lineage = createInstantiatedLineage();
    const result = createRouting({
      payload: {
        ...buildRoutingInput(lineage),
        operationSequence: [
          {
            stepId: "a",
            operationReference: "op-a",
            sequenceNumber: 1,
            predecessorOperationIds: ["b"],
            successorOperationIds: [],
            parallelGroupReference: null,
            conditionalBranchReference: null,
            estimatedCycleTimeMinutes: 10,
            estimatedSetupTimeMinutes: 1,
            estimatedRunTimeMinutes: 9,
            estimatedChangeoverTimeMinutes: 1,
            referencedWorkCenter: null,
            referencedMachineType: null,
            referencedSkill: null,
            engineeringNotes: null,
            referenceDocuments: [],
          },
          {
            stepId: "b",
            operationReference: "op-b",
            sequenceNumber: 2,
            predecessorOperationIds: ["a"],
            successorOperationIds: [],
            parallelGroupReference: null,
            conditionalBranchReference: null,
            estimatedCycleTimeMinutes: 10,
            estimatedSetupTimeMinutes: 1,
            estimatedRunTimeMinutes: 9,
            estimatedChangeoverTimeMinutes: 1,
            referencedWorkCenter: null,
            referencedMachineType: null,
            referencedSkill: null,
            engineeringNotes: null,
            referenceDocuments: [],
          },
        ],
      },
      actor: "planner",
    });

    expect(result.validation.valid).toBe(false);
    expect(result.routing).toBeNull();
  });
});