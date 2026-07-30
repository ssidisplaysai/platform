import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import { getProductionJobById } from "./production-job-repository";
import { filterOperations, searchOperations } from "./operation-selectors";
import { FOUNDATION_OPERATIONS } from "./operation-fixtures";
import type {
  NewOperationFromProductionJobInput,
  NewOperationInput,
  OperationAuditEvent,
  OperationListFilters,
  OperationPublishedEvent,
  OperationRecord,
  OperationRevisionRecord,
  OperationSearchFilters,
  OperationSearchResult,
  OperationStatus,
  OperationTimelineEntry,
  OperationValidationResult,
  UpdateOperationDraftInput,
} from "./operation-types";
import {
  validateNewOperationInput,
  validateUpdateOperationDraftInput,
} from "./operation-validation";

const PERSISTENCE_NAMESPACE = "operation-repository";
const OPERATION_EVENT_CONTRACT_VERSION = "v1.0.0";

type OperationRepositoryState = {
  operations: OperationRecord[];
  auditEvents: OperationAuditEvent[];
  publishedEvents: OperationPublishedEvent[];
  sequenceByProductionJob: Record<string, number>;
  operationIdByProductionJobSequence: Record<string, string>;
};

const operationStore = new Map<string, OperationRecord>();
const auditStore = new Map<string, OperationAuditEvent>();
const eventStore = new Map<string, OperationPublishedEvent>();
let sequenceByProductionJob: Record<string, number> = {};
let operationIdByProductionJobSequence: Record<string, string> = {};
let stateRevision = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function createSeedState(): OperationRepositoryState {
  return {
    operations: FOUNDATION_OPERATIONS.map((entry) => deepClone(entry)),
    auditEvents: [],
    publishedEvents: [],
    sequenceByProductionJob: {},
    operationIdByProductionJobSequence: {},
  };
}

function applyState(state: OperationRepositoryState): void {
  operationStore.clear();
  state.operations.forEach((entry) => {
    operationStore.set(entry.documentId, deepClone(entry));
  });

  auditStore.clear();
  state.auditEvents.forEach((entry) => {
    auditStore.set(entry.eventId, deepClone(entry));
  });

  eventStore.clear();
  state.publishedEvents.forEach((entry) => {
    eventStore.set(entry.eventId, deepClone(entry));
  });

  sequenceByProductionJob = { ...state.sequenceByProductionJob };
  operationIdByProductionJobSequence = { ...state.operationIdByProductionJobSequence };
}

function snapshotState(): OperationRepositoryState {
  return {
    operations: Array.from(operationStore.values()).map((entry) => deepClone(entry)),
    auditEvents: Array.from(auditStore.values()).map((entry) => deepClone(entry)),
    publishedEvents: Array.from(eventStore.values()).map((entry) => deepClone(entry)),
    sequenceByProductionJob: { ...sequenceByProductionJob },
    operationIdByProductionJobSequence: { ...operationIdByProductionJobSequence },
  };
}

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<OperationRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(): void {
  const saved = savePersistedState<OperationRepositoryState>({
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

function createOperationId(productionJobId: string, sequenceNumber: number): string {
  return `operation-${productionJobId}-${sequenceNumber.toString().padStart(4, "0")}`;
}

function createOperationNumber(input: {
  organizationId: string;
  productionJobNumber: string;
  sequenceNumber: number;
}): string {
  const year = new Date().getUTCFullYear();
  const organizationPrefix = input.organizationId.slice(0, 4).toUpperCase();
  return `OP-${year}-${organizationPrefix}-${input.productionJobNumber.slice(-6)}-${input.sequenceNumber
    .toString()
    .padStart(3, "0")}`;
}

function createAuditId(operationId: string): string {
  return `operation-audit-${operationId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createEventId(operationId: string): string {
  return `operation-event-${operationId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function normalizeFailure(field: string, error: unknown): OperationValidationResult {
  return {
    valid: false,
    issues: [{ field, message: (error as Error).message }],
  };
}

function buildRevisionRecord(input: {
  operation: OperationRecord;
  author: string;
  reason: string;
  changedFields: readonly string[];
  resultingState: OperationStatus;
}): OperationRevisionRecord {
  return {
    revisionNumber: input.operation.revision + 1,
    parentRevision: input.operation.revision,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: input.changedFields.length > 0 ? [...input.changedFields] : ["unspecified_change"],
    previousState: input.operation.status,
    resultingState: input.resultingState,
    lineageContinuity: true,
  };
}

function appendAuditEvent(input: {
  operation: OperationRecord;
  actor: string;
  action: OperationAuditEvent["action"];
  previousState: OperationStatus;
  resultingState: OperationStatus;
  correlationId: string;
  causationId: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}): OperationAuditEvent {
  const event: OperationAuditEvent = {
    eventId: createAuditId(input.operation.documentId),
    operationId: input.operation.documentId,
    organizationId: input.operation.organizationId,
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

function publishOperationEvent(input: {
  operation: OperationRecord;
  actor: string;
  type: OperationPublishedEvent["type"];
  correlationId: string;
  causationId: string;
  payload?: Readonly<Record<string, string | number | boolean | null>>;
}): OperationPublishedEvent {
  const event: OperationPublishedEvent = {
    eventId: createEventId(input.operation.documentId),
    contractVersion: OPERATION_EVENT_CONTRACT_VERSION,
    aggregateType: "operation",
    aggregateId: input.operation.documentId,
    aggregateVersion: input.operation.version,
    correlationId: input.correlationId,
    causationId: input.causationId,
    timestamp: nowIso(),
    actor: input.actor,
    organizationId: input.operation.organizationId,
    type: input.type,
    payload: input.payload ?? {},
    metadata: {
      schemaRef: "gmp.operation.event.v1",
      producedBy: "gmp",
      status: input.operation.status,
    },
  };

  eventStore.set(event.eventId, event);
  return event;
}

function transitionViolationMessage(status: OperationStatus, allowedStatuses: readonly OperationStatus[]): string {
  return `Operation cannot transition from ${status}. Allowed states: ${allowedStatuses.join(", ")}.`;
}

function buildBaseOperation(input: NewOperationInput, productionJobNumber: string): OperationRecord {
  const operationId = createOperationId(input.lineage.productionJobId, input.sequenceNumber);
  const documentNumber = input.referenceNumber?.trim().length
    ? input.referenceNumber.trim()
    : createOperationNumber({
        organizationId: input.organizationId,
        productionJobNumber,
        sequenceNumber: input.sequenceNumber,
      });

  return {
    documentId: operationId,
    documentNumber,
    organizationId: input.organizationId,
    owningApplicationId: "gmp",
    createdAt: nowIso(),
    updatedAt: nowIso(),
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
      createdBy: input.lineage.createdBy,
      updatedBy: input.lineage.createdBy,
      correlationId: input.lineage.correlationId,
    },
    operationNumber: documentNumber,
    referenceNumber: input.referenceNumber ?? null,
    siteReference: input.siteReference,
    operationType: input.operationType,
    sequenceNumber: input.sequenceNumber,
    operationName: input.operationName,
    description: input.description,
    requiredCapability: input.requiredCapability,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    requiredWorkCenterReference: input.requiredWorkCenterReference,
    requiredMachineTypeReference: input.requiredMachineTypeReference,
    requiredSkill: input.requiredSkill,
    predecessorOperationIds: [...input.predecessorOperationIds],
    successorOperationIds: [...input.successorOperationIds],
    referenceDocuments: [...input.referenceDocuments],
    engineeringNotes: input.engineeringNotes,
    status: "draft",
    lineage: deepClone(input.lineage),
    revisionHistory: [],
  };
}

function buildInitialRevisionRecord(input: { operation: OperationRecord; author: string; reason: string }): OperationRevisionRecord {
  return {
    revisionNumber: input.operation.revision,
    parentRevision: null,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: ["initial_creation"],
    previousState: input.operation.status,
    resultingState: input.operation.status,
    lineageContinuity: true,
  };
}

function completeCreation(input: {
  operation: OperationRecord;
  actor: string;
  reason: string;
  correlationId: string;
  causationId: string;
}): OperationRecord {
  const revision = buildInitialRevisionRecord({ operation: input.operation, author: input.actor, reason: input.reason });
  const created = {
    ...input.operation,
    revisionHistory: [revision],
  };

  operationStore.set(created.documentId, created);
  appendAuditEvent({
    operation: created,
    actor: input.actor,
    action: "operation_created",
    previousState: "draft",
    resultingState: "draft",
    correlationId: input.correlationId,
    causationId: input.causationId,
    metadata: {
      productionJobId: created.lineage.productionJobId,
      workOrderId: created.lineage.workOrderId,
      operationNumber: created.operationNumber,
    },
  });
  publishOperationEvent({
    operation: created,
    actor: input.actor,
    type: "OperationCreated",
    correlationId: input.correlationId,
    causationId: input.causationId,
    payload: {
      operationNumber: created.operationNumber,
      productionJobId: created.lineage.productionJobId,
      workOrderId: created.lineage.workOrderId,
      status: created.status,
    },
  });
  return created;
}

function mutateOperation(input: {
  operationId: string;
  actor: string;
  action: OperationAuditEvent["action"];
  resultingState: OperationStatus;
  reason: string;
  changedFields: readonly string[];
  correlationId: string;
  causationId: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  mutator: (operation: OperationRecord) => OperationRecord;
  eventType?: OperationPublishedEvent["type"];
  eventPayload?: Readonly<Record<string, string | number | boolean | null>>;
}): { validation: OperationValidationResult; operation: OperationRecord | null } {
  const existing = operationStore.get(input.operationId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "operationId", message: "Operation not found." }] },
      operation: null,
    };
  }

  try {
    const updated = mutateWithRollback(() => {
      const next = input.mutator(existing);
      const revision = buildRevisionRecord({
        operation: next,
        author: input.actor,
        reason: input.reason,
        changedFields: input.changedFields,
        resultingState: input.resultingState,
      });

      const finalOperation: OperationRecord = {
        ...next,
        version: next.version + 1,
        revision: next.revision + 1,
        updatedAt: nowIso(),
        auditEnvelope: {
          ...next.auditEnvelope,
          updatedBy: input.actor,
          correlationId: input.correlationId,
        },
        revisionHistory: [...next.revisionHistory, revision],
        status: input.resultingState,
      };

      operationStore.set(finalOperation.documentId, finalOperation);
      appendAuditEvent({
        operation: finalOperation,
        actor: input.actor,
        action: input.action,
        previousState: existing.status,
        resultingState: input.resultingState,
        correlationId: input.correlationId,
        causationId: input.causationId,
        metadata: input.metadata,
      });
      if (input.eventType) {
        publishOperationEvent({
          operation: finalOperation,
          actor: input.actor,
          type: input.eventType,
          correlationId: input.correlationId,
          causationId: input.causationId,
          payload: input.eventPayload ?? {
            operationNumber: finalOperation.operationNumber,
            status: finalOperation.status,
          },
        });
      }

      return finalOperation;
    });

    return {
      validation: { valid: true, issues: [] },
      operation: updated,
    };
  } catch (error) {
    if (error instanceof FoundationPersistenceConflictError) {
      return normalizeFailure("persistence", error);
    }

    return normalizeFailure("operation", error);
  }
}

loadStateFromPersistence();

export function createOperation(input: {
  payload: NewOperationInput;
  actor: string;
  reason?: string;
  correlationId?: string | null;
  causationId?: string | null;
}): { validation: OperationValidationResult; operation: OperationRecord | null } {
  const validation = validateNewOperationInput(input.payload);
  if (!validation.valid) {
    return { validation, operation: null };
  }

  const parentJob = getProductionJobById(input.payload.lineage.productionJobId);
  if (!parentJob) {
    return {
      validation: { valid: false, issues: [{ field: "lineage.productionJobId", message: "Production job not found." }] },
      operation: null,
    };
  }

  const key = `${input.payload.lineage.productionJobId}:${input.payload.sequenceNumber}`;
  if (operationIdByProductionJobSequence[key]) {
    return {
      validation: { valid: false, issues: [{ field: "sequenceNumber", message: "Operation already exists for this production job sequence." }] },
      operation: null,
    };
  }

  const operation = buildBaseOperation(input.payload, parentJob.productionJobNumber);
  const created = mutateWithRollback(() => {
    operationIdByProductionJobSequence = {
      ...operationIdByProductionJobSequence,
      [key]: operation.documentId,
    };
    return completeCreation({
      operation,
      actor: input.actor,
      reason: input.reason ?? "Initial operation creation",
      correlationId: input.correlationId ?? input.payload.lineage.correlationId,
      causationId: input.causationId ?? input.payload.lineage.causationId,
    });
  });

  return {
    validation: { valid: true, issues: [] },
    operation: created,
  };
}

export function createOperationFromProductionJob(input: {
  payload: NewOperationFromProductionJobInput;
  actor: string;
}): { validation: OperationValidationResult; operation: OperationRecord | null } {
  const parentJob = getProductionJobById(input.payload.productionJobId);
  if (!parentJob) {
    return {
      validation: { valid: false, issues: [{ field: "productionJobId", message: "Production job not found." }] },
      operation: null,
    };
  }

  const lineage = {
    productionJobId: parentJob.documentId,
    productionJobRevision: parentJob.revision,
    workOrderId: parentJob.lineage.workOrderId,
    workOrderRevision: parentJob.lineage.workOrderRevision,
    originSalesOrderId: parentJob.lineage.originSalesOrderId,
    originSalesOrderRevision: parentJob.lineage.originSalesOrderRevision,
    originQuoteId: parentJob.lineage.originQuoteId,
    originQuoteRevision: parentJob.lineage.originQuoteRevision,
    organizationId: parentJob.organizationId,
    siteReference: parentJob.siteReference,
    correlationId: input.payload.correlationId ?? parentJob.lineage.correlationId,
    causationId: input.payload.causationId ?? parentJob.lineage.causationId,
    manufacturingVersion: parentJob.lineage.manufacturingVersion,
    createdBy: input.actor,
    createdTimestamp: nowIso(),
  };

  return createOperation({
    payload: {
      organizationId: parentJob.organizationId,
      customerReference: parentJob.customerReference,
      ownerReference: parentJob.ownerReference,
      salesRepresentativeReference: parentJob.salesRepresentativeReference,
      siteReference: parentJob.siteReference,
      referenceNumber: input.payload.referenceNumber,
      operationType: input.payload.operationType,
      sequenceNumber: input.payload.sequenceNumber,
      operationName: input.payload.operationName,
      description: input.payload.description,
      requiredCapability: input.payload.requiredCapability,
      estimatedDurationMinutes: input.payload.estimatedDurationMinutes,
      requiredWorkCenterReference: input.payload.requiredWorkCenterReference,
      requiredMachineTypeReference: input.payload.requiredMachineTypeReference,
      requiredSkill: input.payload.requiredSkill,
      predecessorOperationIds: input.payload.predecessorOperationIds,
      successorOperationIds: input.payload.successorOperationIds,
      referenceDocuments: input.payload.referenceDocuments,
      engineeringNotes: input.payload.engineeringNotes,
      lineage,
      metadata: {},
    },
    actor: input.actor,
  });
}

export function updateOperationDraft(input: {
  operationId: string;
  patch: UpdateOperationDraftInput;
  actor: string;
  expectedVersion?: number;
}): { validation: OperationValidationResult; operation: OperationRecord | null } {
  const existing = operationStore.get(input.operationId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "operationId", message: "Operation not found." }] },
      operation: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return {
      validation: { valid: false, issues: [{ field: "expectedVersion", message: "Version conflict detected." }] },
      operation: null,
    };
  }

  if (existing.status !== "draft") {
    return {
      validation: { valid: false, issues: [{ field: "status", message: "Operation draft updates are only allowed in draft state." }] },
      operation: null,
    };
  }

  const validation = validateUpdateOperationDraftInput(existing, input.patch);
  if (!validation.valid) {
    return { validation, operation: null };
  }

  try {
    const updated = mutateWithRollback(() => {
      const next: OperationRecord = {
        ...existing,
        ...input.patch,
        metadata: input.patch.metadata ?? existing.metadata,
        updatedAt: nowIso(),
        version: existing.version + 1,
        revision: existing.revision + 1,
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
          correlationId: existing.auditEnvelope.correlationId,
        },
        revisionHistory: [
          ...existing.revisionHistory,
          buildRevisionRecord({
            operation: existing,
            author: input.actor,
            reason: "Draft update",
            changedFields: Object.keys(input.patch),
            resultingState: existing.status,
          }),
        ],
      };

      operationStore.set(next.documentId, next);
      appendAuditEvent({
        operation: next,
        actor: input.actor,
        action: "operation_updated",
        previousState: existing.status,
        resultingState: next.status,
        correlationId: next.auditEnvelope.correlationId ?? input.actor,
        causationId: next.lineage.causationId,
        metadata: { changedFields: Object.keys(input.patch).join(",") },
      });
      publishOperationEvent({
        operation: next,
        actor: input.actor,
        type: "OperationRevised",
        correlationId: next.auditEnvelope.correlationId ?? input.actor,
        causationId: next.lineage.causationId,
        payload: { operationNumber: next.operationNumber, status: next.status, action: "updated" },
      });
      return next;
    });

    return { validation: { valid: true, issues: [] }, operation: updated };
  } catch (error) {
    if (error instanceof FoundationPersistenceConflictError) {
      return normalizeFailure("persistence", error);
    }

    return normalizeFailure("operation", error);
  }
}

function transitionOperation(input: {
  operationId: string;
  actor: string;
  requiredState: OperationStatus;
  nextState: OperationStatus;
  action: OperationAuditEvent["action"];
  eventType: OperationPublishedEvent["type"];
  reason: string;
  changedFields: readonly string[];
}): { validation: OperationValidationResult; operation: OperationRecord | null } {
  return mutateOperation({
    operationId: input.operationId,
    actor: input.actor,
    action: input.action,
    resultingState: input.nextState,
    reason: input.reason,
    changedFields: input.changedFields,
    correlationId: `${input.operationId}-${input.nextState}`,
    causationId: `${input.operationId}-${input.nextState}`,
    mutator: (existing) => {
      if (existing.status !== input.requiredState) {
        throw new Error(transitionViolationMessage(existing.status, [input.requiredState]));
      }
      return existing;
    },
    eventType: input.eventType,
    eventPayload: { operationId: input.operationId, status: input.nextState },
  });
}

export function defineOperation(input: { operationId: string; actor: string }) {
  return transitionOperation({
    operationId: input.operationId,
    actor: input.actor,
    requiredState: "draft",
    nextState: "defined",
    action: "operation_defined",
    eventType: "OperationDefined",
    reason: "Operation defined",
    changedFields: ["status"],
  });
}

export function readyOperation(input: { operationId: string; actor: string }) {
  return transitionOperation({
    operationId: input.operationId,
    actor: input.actor,
    requiredState: "defined",
    nextState: "ready",
    action: "operation_ready",
    eventType: "OperationReady",
    reason: "Operation marked ready",
    changedFields: ["status"],
  });
}

export function releaseOperation(input: { operationId: string; actor: string }) {
  return transitionOperation({
    operationId: input.operationId,
    actor: input.actor,
    requiredState: "ready",
    nextState: "released",
    action: "operation_released",
    eventType: "OperationReleased",
    reason: "Operation released",
    changedFields: ["status"],
  });
}

export function waitOperation(input: { operationId: string; actor: string }) {
  return transitionOperation({
    operationId: input.operationId,
    actor: input.actor,
    requiredState: "released",
    nextState: "waiting",
    action: "operation_waiting",
    eventType: "OperationWaiting",
    reason: "Operation waiting",
    changedFields: ["status"],
  });
}

export function completeOperation(input: { operationId: string; actor: string }) {
  return transitionOperation({
    operationId: input.operationId,
    actor: input.actor,
    requiredState: "waiting",
    nextState: "completed",
    action: "operation_completed",
    eventType: "OperationCompleted",
    reason: "Operation completed",
    changedFields: ["status"],
  });
}

export function cancelOperation(input: { operationId: string; actor: string }) {
  return mutateOperation({
    operationId: input.operationId,
    actor: input.actor,
    action: "operation_cancelled",
    resultingState: "cancelled",
    reason: "Operation cancelled",
    changedFields: ["status"],
    correlationId: `${input.operationId}-cancelled`,
    causationId: `${input.operationId}-cancelled`,
    mutator: (existing) => {
      if (["completed", "closed", "cancelled"].includes(existing.status)) {
        throw new Error(transitionViolationMessage(existing.status, ["draft", "defined", "ready", "released", "waiting"]));
      }
      return existing;
    },
    eventType: "OperationCancelled",
    eventPayload: { operationId: input.operationId, status: "cancelled" },
  });
}

export function closeOperation(input: { operationId: string; actor: string }) {
  return transitionOperation({
    operationId: input.operationId,
    actor: input.actor,
    requiredState: "completed",
    nextState: "closed",
    action: "operation_closed",
    eventType: "OperationClosed",
    reason: "Operation closed",
    changedFields: ["status"],
  });
}

export function createOperationRevision(input: {
  operationId: string;
  actor: string;
  reason: string;
  changedFields: readonly string[];
}): { validation: OperationValidationResult; operation: OperationRecord | null } {
  const existing = operationStore.get(input.operationId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "operationId", message: "Operation not found." }] },
      operation: null,
    };
  }

  try {
    const updated = mutateWithRollback(() => {
      const revision = buildRevisionRecord({
        operation: existing,
        author: input.actor,
        reason: input.reason,
        changedFields: input.changedFields,
        resultingState: existing.status,
      });

      const next: OperationRecord = {
        ...existing,
        version: existing.version + 1,
        revision: existing.revision + 1,
        updatedAt: nowIso(),
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
          correlationId: existing.auditEnvelope.correlationId,
        },
        revisionHistory: [...existing.revisionHistory, revision],
      };

      operationStore.set(next.documentId, next);
      appendAuditEvent({
        operation: next,
        actor: input.actor,
        action: "operation_revision_created",
        previousState: existing.status,
        resultingState: existing.status,
        correlationId: next.auditEnvelope.correlationId ?? input.actor,
        causationId: next.lineage.causationId,
        metadata: { reason: input.reason },
      });
      publishOperationEvent({
        operation: next,
        actor: input.actor,
        type: "OperationRevised",
        correlationId: next.auditEnvelope.correlationId ?? input.actor,
        causationId: next.lineage.causationId,
        payload: { operationNumber: next.operationNumber, status: next.status, revision: next.revision },
      });
      return next;
    });

    return { validation: { valid: true, issues: [] }, operation: updated };
  } catch (error) {
    if (error instanceof FoundationPersistenceConflictError) {
      return normalizeFailure("persistence", error);
    }

    return normalizeFailure("operation", error);
  }
}

export function getOperationById(operationId: string): OperationRecord | null {
  return operationStore.get(operationId) ?? null;
}

export function getOperationsByProductionJobId(productionJobId: string): OperationRecord[] {
  return Array.from(operationStore.values()).filter((operation) => operation.lineage.productionJobId === productionJobId);
}

export function listOperations(filters: OperationListFilters = {}): OperationRecord[] {
  return filterOperations(Array.from(operationStore.values()), filters);
}

export function searchOperationRegistry(filters: OperationSearchFilters): OperationSearchResult[] {
  return searchOperations(Array.from(operationStore.values()), filters);
}

export function listOperationAuditEvents(operationId: string): OperationAuditEvent[] {
  return Array.from(auditStore.values()).filter((event) => event.operationId === operationId);
}

export function listOperationPublishedEvents(operationId: string): OperationPublishedEvent[] {
  return Array.from(eventStore.values()).filter((event) => event.aggregateId === operationId);
}

export function listOperationTimeline(operationId: string): OperationTimelineEntry[] {
  const operation = operationStore.get(operationId);
  if (!operation) {
    return [];
  }

  const timeline: OperationTimelineEntry[] = [];

  operation.revisionHistory.forEach((revision) => {
    timeline.push({
      timestamp: revision.timestamp,
      category: "revision",
      title: `Revision ${revision.revisionNumber}`,
      detail: `${revision.previousState} -> ${revision.resultingState}: ${revision.reason}`,
    });
  });

  listOperationAuditEvents(operationId).forEach((event) => {
    timeline.push({
      timestamp: event.createdAt,
      category: "audit",
      title: event.action,
      detail: `${event.previousState} -> ${event.resultingState}`,
    });
  });

  listOperationPublishedEvents(operationId).forEach((event) => {
    timeline.push({
      timestamp: event.timestamp,
      category: "event",
      title: event.type,
      detail: `v${event.contractVersion} version ${event.aggregateVersion}`,
    });
  });

  return timeline.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function resetOperationRepositoryForTests(): void {
  resetPersistedState<OperationRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });
  loadStateFromPersistence();
}
