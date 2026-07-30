import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import { filterProductionJobs, searchProductionJobs } from "./production-job-selectors";
import type {
  NewProductionJobFromWorkOrderInput,
  NewProductionJobInput,
  ProductionJobAuditEvent,
  ProductionJobListFilters,
  ProductionJobPublishedEvent,
  ProductionJobRecord,
  ProductionJobRevisionRecord,
  ProductionJobSearchFilters,
  ProductionJobSearchResult,
  ProductionJobStatus,
  ProductionJobTimelineEntry,
  ProductionJobValidationResult,
  UpdateProductionJobDraftInput,
} from "./production-job-types";
import {
  validateNewProductionJobInput,
  validateUpdateProductionJobDraftInput,
} from "./production-job-validation";
import { FOUNDATION_PRODUCTION_JOBS } from "./production-job-fixtures";
import { getWorkOrderById } from "./work-order-repository";

const PERSISTENCE_NAMESPACE = "production-job-repository";
const PRODUCTION_JOB_EVENT_CONTRACT_VERSION = "v1.0.0";

type ProductionJobRepositoryState = {
  jobs: ProductionJobRecord[];
  auditEvents: ProductionJobAuditEvent[];
  publishedEvents: ProductionJobPublishedEvent[];
  sequenceByOrganization: Record<string, number>;
  productionJobIdByWorkOrderId: Record<string, string>;
};

const jobStore = new Map<string, ProductionJobRecord>();
const auditStore = new Map<string, ProductionJobAuditEvent>();
const eventStore = new Map<string, ProductionJobPublishedEvent>();
let sequenceByOrganization: Record<string, number> = {};
let productionJobIdByWorkOrderId: Record<string, string> = {};
let stateRevision = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function createSeedState(): ProductionJobRepositoryState {
  return {
    jobs: FOUNDATION_PRODUCTION_JOBS.map((entry) => deepClone(entry)),
    auditEvents: [],
    publishedEvents: [],
    sequenceByOrganization: {},
    productionJobIdByWorkOrderId: {},
  };
}

function applyState(state: ProductionJobRepositoryState): void {
  jobStore.clear();
  state.jobs.forEach((entry) => {
    jobStore.set(entry.documentId, deepClone(entry));
  });

  auditStore.clear();
  state.auditEvents.forEach((event) => {
    auditStore.set(event.eventId, deepClone(event));
  });

  eventStore.clear();
  state.publishedEvents.forEach((event) => {
    eventStore.set(event.eventId, deepClone(event));
  });

  sequenceByOrganization = { ...state.sequenceByOrganization };
  productionJobIdByWorkOrderId = { ...state.productionJobIdByWorkOrderId };
}

function snapshotState(): ProductionJobRepositoryState {
  return {
    jobs: Array.from(jobStore.values()).map((entry) => deepClone(entry)),
    auditEvents: Array.from(auditStore.values()).map((event) => deepClone(event)),
    publishedEvents: Array.from(eventStore.values()).map((event) => deepClone(event)),
    sequenceByOrganization: { ...sequenceByOrganization },
    productionJobIdByWorkOrderId: { ...productionJobIdByWorkOrderId },
  };
}

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<ProductionJobRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(): void {
  const saved = savePersistedState<ProductionJobRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });

  stateRevision = saved.revision;
}

function mutateWithRollback<T>(mutator: () => T): T {
  const snapshot = snapshotState();

  try {
    const result = mutator();
    persistCurrentState();
    return result;
  } catch (error) {
    applyState(snapshot);
    throw error;
  }
}

function createProductionJobId(organizationId: string, sequence: number): string {
  return `production-job-${organizationId}-${sequence.toString().padStart(6, "0")}`;
}

function createProductionJobNumber(organizationId: string, sequence: number): string {
  return `PJ-${new Date().getUTCFullYear()}-${organizationId.slice(0, 4).toUpperCase()}-${sequence
    .toString()
    .padStart(6, "0")}`;
}

function createAuditId(productionJobId: string): string {
  return `production-job-audit-${productionJobId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createEventId(productionJobId: string): string {
  return `production-job-event-${productionJobId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function nextSequenceForOrganization(organizationId: string): number {
  const current = sequenceByOrganization[organizationId] ?? 0;
  const next = current + 1;
  sequenceByOrganization = {
    ...sequenceByOrganization,
    [organizationId]: next,
  };
  return next;
}

function normalizeFailure(field: string, error: unknown): ProductionJobValidationResult {
  return {
    valid: false,
    issues: [{ field, message: (error as Error).message }],
  };
}

function buildInitialRevisionRecord(input: {
  job: ProductionJobRecord;
  author: string;
  reason: string;
}): ProductionJobRevisionRecord {
  return {
    revisionNumber: input.job.revision,
    parentRevision: null,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: ["initial_creation"],
    previousState: input.job.status,
    resultingState: input.job.status,
    lineageContinuity: true,
  };
}

function buildRevisionRecord(input: {
  job: ProductionJobRecord;
  author: string;
  reason: string;
  changedFields: readonly string[];
  resultingState: ProductionJobStatus;
}): ProductionJobRevisionRecord {
  return {
    revisionNumber: input.job.revision + 1,
    parentRevision: input.job.revision,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: input.changedFields.length > 0 ? [...input.changedFields] : ["unspecified_change"],
    previousState: input.job.status,
    resultingState: input.resultingState,
    lineageContinuity: true,
  };
}

function appendAuditEvent(input: {
  job: ProductionJobRecord;
  actor: string;
  action: ProductionJobAuditEvent["action"];
  previousState: ProductionJobStatus;
  resultingState: ProductionJobStatus;
  correlationId: string;
  causationId: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}): ProductionJobAuditEvent {
  const event: ProductionJobAuditEvent = {
    eventId: createAuditId(input.job.documentId),
    productionJobId: input.job.documentId,
    organizationId: input.job.organizationId,
    actor: input.actor,
    action: input.action,
    previousState: input.previousState,
    resultingState: input.resultingState,
    correlationId: input.correlationId,
    causationId: input.causationId,
    metadata: input.metadata ?? {},
    createdAt: nowIso(),
  };

  auditStore.set(event.eventId, event);
  return event;
}

function publishProductionJobEvent(input: {
  job: ProductionJobRecord;
  actor: string;
  type: ProductionJobPublishedEvent["type"];
  correlationId: string;
  causationId: string;
  payload?: Readonly<Record<string, string | number | boolean | null>>;
}): ProductionJobPublishedEvent {
  const event: ProductionJobPublishedEvent = {
    eventId: createEventId(input.job.documentId),
    contractVersion: PRODUCTION_JOB_EVENT_CONTRACT_VERSION,
    aggregateType: "production_job",
    aggregateId: input.job.documentId,
    aggregateVersion: input.job.version,
    correlationId: input.correlationId,
    causationId: input.causationId,
    timestamp: nowIso(),
    actor: input.actor,
    organizationId: input.job.organizationId,
    type: input.type,
    payload: input.payload ?? {},
    metadata: {
      schemaRef: "gmp.production-job.event.v1",
      producedBy: "gmp",
      status: input.job.status,
    },
  };

  eventStore.set(event.eventId, event);
  return event;
}

function transitionViolationMessage(input: {
  status: ProductionJobStatus;
  action: "queue" | "ready" | "release" | "start" | "pause" | "resume" | "complete" | "cancel" | "close";
}): string | null {
  if (input.action === "queue") {
    return input.status === "draft" ? null : "Only draft production jobs can be queued.";
  }
  if (input.action === "ready") {
    return input.status === "queued" ? null : "Only queued production jobs can be marked ready.";
  }
  if (input.action === "release") {
    return input.status === "ready" ? null : "Only ready production jobs can be released.";
  }
  if (input.action === "start") {
    return input.status === "released" ? null : "Only released production jobs can start.";
  }
  if (input.action === "pause") {
    return input.status === "running" ? null : "Only running production jobs can be paused.";
  }
  if (input.action === "resume") {
    return input.status === "paused" ? null : "Only paused production jobs can resume.";
  }
  if (input.action === "complete") {
    return input.status === "running" ? null : "Only running production jobs can be completed.";
  }
  if (input.action === "cancel") {
    return input.status === "completed" || input.status === "closed"
      ? "Completed or closed production jobs cannot be cancelled."
      : null;
  }
  if (input.action === "close") {
    return input.status === "completed" || input.status === "cancelled"
      ? null
      : "Only completed or cancelled production jobs can be closed.";
  }

  return null;
}

loadStateFromPersistence();

export function listProductionJobs(filters: ProductionJobListFilters = {}): readonly ProductionJobRecord[] {
  return filterProductionJobs(Array.from(jobStore.values()), filters);
}

export function getProductionJobById(productionJobId: string): ProductionJobRecord | null {
  return jobStore.get(productionJobId) ?? null;
}

export function getProductionJobByWorkOrderId(workOrderId: string): ProductionJobRecord | null {
  const productionJobId = productionJobIdByWorkOrderId[workOrderId];
  if (!productionJobId) {
    return null;
  }
  return getProductionJobById(productionJobId);
}

export function listProductionJobAuditEvents(productionJobId: string): readonly ProductionJobAuditEvent[] {
  return Array.from(auditStore.values())
    .filter((event) => event.productionJobId === productionJobId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function listProductionJobRevisions(productionJobId: string): readonly ProductionJobRevisionRecord[] {
  const job = jobStore.get(productionJobId);
  return job ? job.revisionHistory : [];
}

export function listProductionJobPublishedEvents(productionJobId: string): readonly ProductionJobPublishedEvent[] {
  return Array.from(eventStore.values())
    .filter((event) => event.aggregateId === productionJobId)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function listProductionJobTimeline(productionJobId: string): readonly ProductionJobTimelineEntry[] {
  const job = jobStore.get(productionJobId);
  if (!job) {
    return [];
  }

  const auditEntries: ProductionJobTimelineEntry[] = listProductionJobAuditEvents(productionJobId).map((entry) => ({
    timestamp: entry.createdAt,
    category: "audit",
    title: entry.action,
    detail: `${entry.previousState} -> ${entry.resultingState}`,
  }));

  const revisionEntries: ProductionJobTimelineEntry[] = job.revisionHistory.map((entry) => ({
    timestamp: entry.timestamp,
    category: "revision",
    title: `Revision ${entry.revisionNumber}`,
    detail: `${entry.author}: ${entry.reason}`,
  }));

  const eventEntries: ProductionJobTimelineEntry[] = listProductionJobPublishedEvents(productionJobId).map((entry) => ({
    timestamp: entry.timestamp,
    category: "event",
    title: entry.type,
    detail: `Published by ${entry.actor}`,
  }));

  return [...auditEntries, ...revisionEntries, ...eventEntries].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

export function searchProductionJobRegistry(
  filters: ProductionJobSearchFilters,
): readonly ProductionJobSearchResult[] {
  return searchProductionJobs(Array.from(jobStore.values()), filters);
}

export function createProductionJob(input: NewProductionJobInput & { actor: string }): {
  validation: ProductionJobValidationResult;
  productionJob: ProductionJobRecord | null;
} {
  const validation = validateNewProductionJobInput(input);
  if (!validation.valid) {
    return { validation, productionJob: null };
  }

  if (productionJobIdByWorkOrderId[input.lineage.workOrderId]) {
    return {
      validation: {
        valid: false,
        issues: [
          {
            field: "lineage.workOrderId",
            message: "Production job already exists for this work order.",
          },
        ],
      },
      productionJob: null,
    };
  }

  try {
    const created = mutateWithRollback(() => {
      const sequence = nextSequenceForOrganization(input.organizationId);
      const productionJobId = createProductionJobId(input.organizationId, sequence);
      const productionJobNumber = createProductionJobNumber(input.organizationId, sequence);
      const timestamp = nowIso();

      const productionJob: ProductionJobRecord = {
        documentId: productionJobId,
        documentNumber: productionJobNumber,
        productionJobNumber,
        organizationId: input.organizationId,
        owningApplicationId: "gmp",
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
        revision: 1,
        lifecycleState: "draft",
        customerReference: input.customerReference,
        customerContactReferences: [],
        ownerReference: input.ownerReference,
        salesRepresentativeReference: input.salesRepresentativeReference,
        billingAddress: null,
        shippingAddress: null,
        installationAddress: null,
        serviceAddress: null,
        attachments: [],
        notes: [],
        metadata: input.metadata,
        auditEnvelope: {
          createdBy: input.actor,
          updatedBy: input.actor,
          correlationId: input.lineage.correlationId,
        },
        status: "draft",
        referenceNumber: input.referenceNumber,
        executionContext: input.executionContext,
        requestedStartDate: input.requestedStartDate,
        requestedCompletionDate: input.requestedCompletionDate,
        lineage: input.lineage,
        lines: input.lines.map((line) => deepClone(line)),
        revisionHistory: [],
      };

      productionJob.revisionHistory = [
        buildInitialRevisionRecord({
          job: productionJob,
          author: input.actor,
          reason: "Production job created",
        }),
      ];

      jobStore.set(productionJob.documentId, productionJob);
      productionJobIdByWorkOrderId = {
        ...productionJobIdByWorkOrderId,
        [productionJob.lineage.workOrderId]: productionJob.documentId,
      };

      appendAuditEvent({
        job: productionJob,
        actor: input.actor,
        action: "production_job_created",
        previousState: "draft",
        resultingState: "draft",
        correlationId: productionJob.lineage.correlationId,
        causationId: productionJob.lineage.causationId,
        metadata: {
          workOrderId: productionJob.lineage.workOrderId,
          salesOrderId: productionJob.lineage.originSalesOrderId,
          quoteId: productionJob.lineage.originQuoteId,
        },
      });

      publishProductionJobEvent({
        job: productionJob,
        actor: input.actor,
        type: "ProductionJobCreated",
        correlationId: productionJob.lineage.correlationId,
        causationId: productionJob.lineage.causationId,
        payload: {
          workOrderId: productionJob.lineage.workOrderId,
          salesOrderId: productionJob.lineage.originSalesOrderId,
          quoteId: productionJob.lineage.originQuoteId,
        },
      });

      return productionJob;
    });

    return { validation, productionJob: created };
  } catch (error) {
    return { validation: normalizeFailure("productionJob", error), productionJob: null };
  }
}

export function createProductionJobFromWorkOrder(input: {
  payload: NewProductionJobFromWorkOrderInput;
  actor: string;
}): {
  validation: ProductionJobValidationResult;
  productionJob: ProductionJobRecord | null;
} {
  const workOrder = getWorkOrderById(input.payload.workOrderId);
  if (!workOrder) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "workOrderId", message: "Work order not found." }],
      },
      productionJob: null,
    };
  }

  if (!["released", "in_production", "completed"].includes(workOrder.status)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "workOrder", message: "Work order must be released before conversion." }],
      },
      productionJob: null,
    };
  }

  if (workOrder.lines.length === 0) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "workOrder", message: "Work order must include at least one line for conversion." }],
      },
      productionJob: null,
    };
  }

  const existing = getProductionJobByWorkOrderId(workOrder.documentId);
  if (existing) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "workOrderId", message: "Production job already exists for this work order." }],
      },
      productionJob: null,
    };
  }

  const conversionEventId = createEventId(`convert-${workOrder.documentId}`);

  return createProductionJob({
    organizationId: workOrder.organizationId,
    customerReference: workOrder.customerReference,
    ownerReference: workOrder.ownerReference,
    salesRepresentativeReference: workOrder.salesRepresentativeReference,
    siteReference: workOrder.siteReference,
    referenceNumber: input.payload.referenceNumber,
    executionContext: input.payload.executionContext,
    requestedStartDate: workOrder.requestedStartDate,
    requestedCompletionDate: workOrder.requestedCompletionDate,
    lineage: {
      workOrderId: workOrder.documentId,
      workOrderRevision: workOrder.revision,
      originSalesOrderId: workOrder.commercialLineage.originSalesOrderId,
      originSalesOrderRevision: workOrder.commercialLineage.originSalesOrderRevision,
      originQuoteId: workOrder.commercialLineage.originQuoteId,
      originQuoteRevision: workOrder.commercialLineage.originQuoteRevision,
      organizationId: workOrder.organizationId,
      correlationId: input.payload.correlationId ?? conversionEventId,
      causationId: input.payload.causationId ?? conversionEventId,
      manufacturingVersion: "v1.0.0",
      createdBy: input.actor,
      createdTimestamp: nowIso(),
    },
    lines: workOrder.lines.map((line) => ({
      lineId: `pj-line-${line.lineId}`,
      workOrderLineId: line.lineId,
      productId: line.productId,
      sku: line.sku,
      displayName: line.displayName,
      quantity: line.quantity,
      unitOfMeasure: line.unitOfMeasure,
      metadata: line.metadata,
    })),
    metadata: {
      source: "work_order_conversion",
      workOrderNumber: workOrder.workOrderNumber,
      salesOrderId: workOrder.commercialLineage.originSalesOrderId,
      quoteId: workOrder.commercialLineage.originQuoteId,
    },
    actor: input.actor,
  });
}

export function updateProductionJobDraft(input: {
  productionJobId: string;
  patch: UpdateProductionJobDraftInput;
  actor: string;
  expectedVersion?: number;
}): {
  validation: ProductionJobValidationResult;
  productionJob: ProductionJobRecord | null;
} {
  const existing = jobStore.get(input.productionJobId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "productionJobId", message: "Production job not found." }] },
      productionJob: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return {
      validation: { valid: false, issues: [{ field: "expectedVersion", message: "Version conflict detected." }] },
      productionJob: null,
    };
  }

  const validation = validateUpdateProductionJobDraftInput(existing, input.patch);
  if (!validation.valid) {
    return { validation, productionJob: null };
  }

  try {
    const updated = mutateWithRollback(() => {
      const next: ProductionJobRecord = {
        ...existing,
        ...input.patch,
        metadata: input.patch.metadata ?? existing.metadata,
        updatedAt: nowIso(),
        version: existing.version + 1,
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      jobStore.set(next.documentId, next);

      appendAuditEvent({
        job: next,
        actor: input.actor,
        action: "production_job_updated",
        previousState: existing.status,
        resultingState: next.status,
        correlationId: next.lineage.correlationId,
        causationId: next.lineage.causationId,
      });

      return next;
    });

    return { validation, productionJob: updated };
  } catch (error) {
    return { validation: normalizeFailure("productionJob", error), productionJob: null };
  }
}

export function createProductionJobRevision(input: {
  productionJobId: string;
  actor: string;
  reason: string;
  changedFields: readonly string[];
  expectedVersion?: number;
}): {
  validation: ProductionJobValidationResult;
  productionJob: ProductionJobRecord | null;
  revision: ProductionJobRevisionRecord | null;
} {
  const existing = jobStore.get(input.productionJobId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "productionJobId", message: "Production job not found." }] },
      productionJob: null,
      revision: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return {
      validation: { valid: false, issues: [{ field: "expectedVersion", message: "Version conflict detected." }] },
      productionJob: null,
      revision: null,
    };
  }

  if (!input.reason || input.reason.trim().length < 3) {
    return {
      validation: { valid: false, issues: [{ field: "reason", message: "Revision reason is required." }] },
      productionJob: null,
      revision: null,
    };
  }

  try {
    const result = mutateWithRollback(() => {
      const revision = buildRevisionRecord({
        job: existing,
        author: input.actor,
        reason: input.reason,
        changedFields: input.changedFields,
        resultingState: existing.status,
      });

      const next: ProductionJobRecord = {
        ...existing,
        revision: revision.revisionNumber,
        revisionHistory: [...existing.revisionHistory, revision],
        updatedAt: nowIso(),
        version: existing.version + 1,
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      jobStore.set(next.documentId, next);

      appendAuditEvent({
        job: next,
        actor: input.actor,
        action: "production_job_revision_created",
        previousState: existing.status,
        resultingState: next.status,
        correlationId: next.lineage.correlationId,
        causationId: next.lineage.causationId,
        metadata: {
          revisionNumber: revision.revisionNumber,
          reason: input.reason,
        },
      });

      publishProductionJobEvent({
        job: next,
        actor: input.actor,
        type: "ProductionJobRevised",
        correlationId: next.lineage.correlationId,
        causationId: next.lineage.causationId,
        payload: {
          revisionNumber: revision.revisionNumber,
          reason: input.reason,
        },
      });

      return { productionJob: next, revision };
    });

    return {
      validation: { valid: true, issues: [] },
      productionJob: result.productionJob,
      revision: result.revision,
    };
  } catch (error) {
    return {
      validation: normalizeFailure("revision", error),
      productionJob: null,
      revision: null,
    };
  }
}

function transitionProductionJob(input: {
  productionJobId: string;
  actor: string;
  action: "queue" | "ready" | "release" | "start" | "pause" | "resume" | "complete" | "cancel" | "close";
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}): {
  validation: ProductionJobValidationResult;
  productionJob: ProductionJobRecord | null;
} {
  const existing = jobStore.get(input.productionJobId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "productionJobId", message: "Production job not found." }] },
      productionJob: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return {
      validation: { valid: false, issues: [{ field: "expectedVersion", message: "Version conflict detected." }] },
      productionJob: null,
    };
  }

  const violation = transitionViolationMessage({
    status: existing.status,
    action: input.action,
  });
  if (violation) {
    return {
      validation: { valid: false, issues: [{ field: "status", message: violation }] },
      productionJob: null,
    };
  }

  try {
    const updated = mutateWithRollback(() => {
      let status = existing.status;
      let lifecycleState = existing.lifecycleState;
      let action: ProductionJobAuditEvent["action"] = "production_job_updated";
      let eventType: ProductionJobPublishedEvent["type"] | null = null;

      if (input.action === "queue") {
        status = "queued";
        lifecycleState = "pending_review";
        action = "production_job_queued";
      } else if (input.action === "ready") {
        status = "ready";
        lifecycleState = "approved";
        action = "production_job_readied";
      } else if (input.action === "release") {
        status = "released";
        lifecycleState = "approved";
        action = "production_job_released";
        eventType = "ProductionJobReleased";
      } else if (input.action === "start") {
        status = "running";
        lifecycleState = "active";
        action = "production_job_started";
        eventType = "ProductionJobStarted";
      } else if (input.action === "pause") {
        status = "paused";
        lifecycleState = "active";
        action = "production_job_paused";
        eventType = "ProductionJobPaused";
      } else if (input.action === "resume") {
        status = "running";
        lifecycleState = "active";
        action = "production_job_resumed";
        eventType = "ProductionJobResumed";
      } else if (input.action === "complete") {
        status = "completed";
        lifecycleState = "closed";
        action = "production_job_completed";
        eventType = "ProductionJobCompleted";
      } else if (input.action === "cancel") {
        status = "cancelled";
        lifecycleState = "cancelled";
        action = "production_job_cancelled";
        eventType = "ProductionJobCancelled";
      } else if (input.action === "close") {
        status = "closed";
        lifecycleState = "closed";
        action = "production_job_closed";
        eventType = "ProductionJobClosed";
      }

      const next: ProductionJobRecord = {
        ...existing,
        status,
        lifecycleState,
        updatedAt: nowIso(),
        version: existing.version + 1,
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
          correlationId: input.correlationId ?? existing.lineage.correlationId,
        },
      };

      jobStore.set(next.documentId, next);

      const correlationId = input.correlationId ?? existing.lineage.correlationId;
      const causationId = input.causationId ?? existing.lineage.causationId;

      appendAuditEvent({
        job: next,
        actor: input.actor,
        action,
        previousState: existing.status,
        resultingState: next.status,
        correlationId,
        causationId,
      });

      if (eventType) {
        publishProductionJobEvent({
          job: next,
          actor: input.actor,
          type: eventType,
          correlationId,
          causationId,
          payload: {
            previousState: existing.status,
            resultingState: next.status,
          },
        });
      }

      return next;
    });

    return {
      validation: { valid: true, issues: [] },
      productionJob: updated,
    };
  } catch (error) {
    return {
      validation: normalizeFailure("status", error),
      productionJob: null,
    };
  }
}

export function queueProductionJob(input: {
  productionJobId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionProductionJob({ ...input, action: "queue" });
}

export function readyProductionJob(input: {
  productionJobId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionProductionJob({ ...input, action: "ready" });
}

export function releaseProductionJob(input: {
  productionJobId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionProductionJob({ ...input, action: "release" });
}

export function startProductionJob(input: {
  productionJobId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionProductionJob({ ...input, action: "start" });
}

export function pauseProductionJob(input: {
  productionJobId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionProductionJob({ ...input, action: "pause" });
}

export function resumeProductionJob(input: {
  productionJobId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionProductionJob({ ...input, action: "resume" });
}

export function completeProductionJob(input: {
  productionJobId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionProductionJob({ ...input, action: "complete" });
}

export function cancelProductionJob(input: {
  productionJobId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionProductionJob({ ...input, action: "cancel" });
}

export function closeProductionJob(input: {
  productionJobId: string;
  actor: string;
  expectedVersion?: number;
  correlationId?: string | null;
  causationId?: string | null;
}) {
  return transitionProductionJob({ ...input, action: "close" });
}

export function markProductionJobViewed(input: {
  productionJobId: string;
  actor: string;
  correlationId?: string | null;
  causationId?: string | null;
}): void {
  const job = jobStore.get(input.productionJobId);
  if (!job) {
    return;
  }

  try {
    mutateWithRollback(() => {
      appendAuditEvent({
        job,
        actor: input.actor,
        action: "production_job_viewed",
        previousState: job.status,
        resultingState: job.status,
        correlationId: input.correlationId ?? job.lineage.correlationId,
        causationId: input.causationId ?? job.lineage.causationId,
      });
      return true;
    });
  } catch {
    // View side effects are intentionally non-blocking.
  }
}

export function resetProductionJobRepositoryForTests(): void {
  const reset = resetPersistedState<ProductionJobRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(reset.state);
  stateRevision = reset.revision;
}

export function isProductionJobVersionConflict(error: unknown): boolean {
  return error instanceof FoundationPersistenceConflictError;
}
