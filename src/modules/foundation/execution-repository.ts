import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import { filterExecutions, searchExecutions } from "./execution-selectors";
import { FOUNDATION_EXECUTIONS } from "./execution-fixtures";
import {
  validateNewExecutionInput,
  validateUpdateExecutionDraftInput,
} from "./execution-validation";
import type {
  CreateExecutionRevisionInput,
  ExecutionActivityRecord,
  ExecutionAuditEvent,
  ExecutionListFilters,
  ExecutionPublishedEvent,
  ExecutionRecord,
  ExecutionRevisionRecord,
  ExecutionSearchFilters,
  ExecutionSearchResult,
  ExecutionStatus,
  ExecutionTimelineEntry,
  ExecutionValidationResult,
  NewExecutionInput,
  UpdateExecutionDraftInput,
} from "./execution-types";

const PERSISTENCE_NAMESPACE = "execution-repository";
const EXECUTION_EVENT_CONTRACT_VERSION = "v1.0.0";

type ExecutionRepositoryState = {
  executions: ExecutionRecord[];
  activities: ExecutionActivityRecord[];
  auditEvents: ExecutionAuditEvent[];
  publishedEvents: ExecutionPublishedEvent[];
  sequenceByOrganization: Record<string, number>;
  executionIdByScheduleId: Record<string, string>;
  executionIdByProductionJobId: Record<string, string>;
  executionIdByOperationId: Record<string, string>;
  executionIdByWorkOrderId: Record<string, string>;
};

const executionStore = new Map<string, ExecutionRecord>();
const activityStore = new Map<string, ExecutionActivityRecord>();
const auditStore = new Map<string, ExecutionAuditEvent>();
const eventStore = new Map<string, ExecutionPublishedEvent>();
let sequenceByOrganization: Record<string, number> = {};
let executionIdByScheduleId: Record<string, string> = {};
let executionIdByProductionJobId: Record<string, string> = {};
let executionIdByOperationId: Record<string, string> = {};
let executionIdByWorkOrderId: Record<string, string> = {};
let stateRevision = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function createSeedState(): ExecutionRepositoryState {
  return {
    executions: FOUNDATION_EXECUTIONS.map((entry) => deepClone(entry)),
    activities: [],
    auditEvents: [],
    publishedEvents: [],
    sequenceByOrganization: {},
    executionIdByScheduleId: {},
    executionIdByProductionJobId: {},
    executionIdByOperationId: {},
    executionIdByWorkOrderId: {},
  };
}

function applyState(state: ExecutionRepositoryState): void {
  executionStore.clear();
  state.executions.forEach((entry) => {
    executionStore.set(entry.documentId, deepClone(entry));
  });

  activityStore.clear();
  state.activities.forEach((entry) => {
    activityStore.set(entry.activityId, deepClone(entry));
  });

  auditStore.clear();
  state.auditEvents.forEach((entry) => {
    auditStore.set(entry.eventId, deepClone(entry));
  });

  eventStore.clear();
  state.publishedEvents.forEach((entry) => {
    eventStore.set(entry.eventId, deepClone(entry));
  });

  sequenceByOrganization = { ...state.sequenceByOrganization };
  executionIdByScheduleId = { ...state.executionIdByScheduleId };
  executionIdByProductionJobId = { ...state.executionIdByProductionJobId };
  executionIdByOperationId = { ...state.executionIdByOperationId };
  executionIdByWorkOrderId = { ...state.executionIdByWorkOrderId };
}

function snapshotState(): ExecutionRepositoryState {
  return {
    executions: Array.from(executionStore.values()).map((entry) => deepClone(entry)),
    activities: Array.from(activityStore.values()).map((entry) => deepClone(entry)),
    auditEvents: Array.from(auditStore.values()).map((entry) => deepClone(entry)),
    publishedEvents: Array.from(eventStore.values()).map((entry) => deepClone(entry)),
    sequenceByOrganization: { ...sequenceByOrganization },
    executionIdByScheduleId: { ...executionIdByScheduleId },
    executionIdByProductionJobId: { ...executionIdByProductionJobId },
    executionIdByOperationId: { ...executionIdByOperationId },
    executionIdByWorkOrderId: { ...executionIdByWorkOrderId },
  };
}

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<ExecutionRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(): void {
  const saved = savePersistedState<ExecutionRepositoryState>({
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

function createExecutionId(organizationId: string, sequence: number): string {
  return `execution-${organizationId}-${sequence.toString().padStart(6, "0")}`;
}

function createExecutionNumber(organizationId: string, sequence: number): string {
  return `EX-${new Date().getUTCFullYear()}-${organizationId.slice(0, 4).toUpperCase()}-${sequence
    .toString()
    .padStart(6, "0")}`;
}

function createActivityId(executionId: string): string {
  return `execution-activity-${executionId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createAuditId(executionId: string): string {
  return `execution-audit-${executionId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createEventId(executionId: string): string {
  return `execution-event-${executionId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function freezeRecord<T extends Readonly<Record<string, string | number | boolean | null>>>(record: T): T {
  return Object.freeze({ ...record }) as T;
}

function freezePublishedEvent(event: ExecutionPublishedEvent): ExecutionPublishedEvent {
  return Object.freeze({
    ...event,
    payload: freezeRecord(event.payload),
    metadata: freezeRecord(event.metadata),
  });
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

function normalizeFailure(field: string, error: unknown): ExecutionValidationResult {
  return {
    valid: false,
    issues: [{ field, message: (error as Error).message }],
  };
}

function buildInitialRevisionRecord(input: {
  execution: ExecutionRecord;
  author: string;
  reason: string;
}): ExecutionRevisionRecord {
  return {
    revisionNumber: input.execution.revision,
    parentRevision: null,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: ["initial_creation"],
    previousState: input.execution.status,
    resultingState: input.execution.status,
    lineageContinuity: true,
  };
}

function buildRevisionRecord(input: {
  execution: ExecutionRecord;
  author: string;
  reason: string;
  changedFields: readonly string[];
  resultingState: ExecutionStatus;
}): ExecutionRevisionRecord {
  return {
    revisionNumber: input.execution.revision + 1,
    parentRevision: input.execution.revision,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: input.changedFields.length > 0 ? [...input.changedFields] : ["unspecified_change"],
    previousState: input.execution.status,
    resultingState: input.resultingState,
    lineageContinuity: true,
  };
}

function appendAuditEvent(input: {
  execution: ExecutionRecord;
  actor: string;
  action: ExecutionAuditEvent["action"];
  previousState: ExecutionStatus;
  resultingState: ExecutionStatus;
  correlationId: string;
  causationId: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}): ExecutionAuditEvent {
  const event: ExecutionAuditEvent = {
    eventId: createAuditId(input.execution.documentId),
    executionId: input.execution.documentId,
    organizationId: input.execution.organizationId,
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

function publishExecutionEvent(input: {
  execution: ExecutionRecord;
  actor: string;
  type: ExecutionPublishedEvent["type"];
  correlationId: string;
  causationId: string;
  payload?: Readonly<Record<string, string | number | boolean | null>>;
}): ExecutionPublishedEvent {
  const payload = freezeRecord(
    input.payload ?? {
      executionId: input.execution.documentId,
      executionNumber: input.execution.executionNumber,
      executionName: input.execution.executionName,
      executionStatus: input.execution.status,
      scheduleId: input.execution.lineage.scheduleId,
      productionJobId: input.execution.lineage.productionJobId,
      operationId: input.execution.lineage.operationId,
      routingVersionId: input.execution.lineage.routingVersionId,
      workOrderId: input.execution.lineage.workOrderId,
      originSalesOrderId: input.execution.lineage.originSalesOrderId,
      originQuoteId: input.execution.lineage.originQuoteId,
      organizationId: input.execution.lineage.organizationId,
      siteId: input.execution.lineage.siteReference,
    },
  );

  const event: ExecutionPublishedEvent = {
    eventId: createEventId(input.execution.documentId),
    contractVersion: EXECUTION_EVENT_CONTRACT_VERSION,
    eventType: input.type,
    aggregateType: "execution",
    aggregateId: input.execution.documentId,
    aggregateVersion: input.execution.version,
    organizationId: input.execution.organizationId,
    siteId: input.execution.lineage.siteReference,
    actorId: input.actor,
    correlationId: input.correlationId,
    causationId: input.causationId,
    timestamp: nowIso(),
    actor: input.actor,
    type: input.type,
    payload,
    metadata: {
      schemaRef: "gmp.execution.event.v1",
      producedBy: "gmp",
      status: input.execution.status,
    },
  };

  const frozenEvent = freezePublishedEvent(event);
  eventStore.set(frozenEvent.eventId, frozenEvent);
  return frozenEvent;
}

function recordActivity(input: {
  execution: ExecutionRecord;
  actor: string;
  status: ExecutionStatus;
  referenceType: string;
  referenceId: string;
  summary: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}): ExecutionActivityRecord {
  const nextSequence = input.execution.activities.length + 1;
  const activity: ExecutionActivityRecord = {
    activityId: createActivityId(input.execution.documentId),
    executionId: input.execution.documentId,
    sequence: nextSequence,
    status: input.status,
    timestamp: nowIso(),
    actor: input.actor,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    summary: input.summary,
    metadata: input.metadata ?? {},
  };

  activityStore.set(activity.activityId, activity);
  return activity;
}

function executionReferenceKey(input: Pick<NewExecutionInput, "scheduleId" | "productionJobId" | "operationId" | "workOrderId">): string | null {
  return input.scheduleId ?? input.productionJobId ?? input.operationId ?? input.workOrderId ?? null;
}

function buildBaseExecutionRecord(input: NewExecutionInput): ExecutionRecord {
  const sequence = nextSequenceForOrganization(input.organizationId);
  const executionId = createExecutionId(input.organizationId, sequence);
  const executionNumber = input.executionNumber?.trim().length
    ? input.executionNumber.trim()
    : createExecutionNumber(input.organizationId, sequence);
  const timestamp = nowIso();

  return {
    documentId: executionId,
    documentNumber: executionNumber,
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
    metadata: input.metadata,
    auditEnvelope: {
      createdBy: input.lineage.createdBy,
      updatedBy: input.lineage.createdBy,
      correlationId: input.lineage.correlationId,
    },
    executionNumber,
    executionName: input.executionName,
    status: "created",
    progress: input.progress,
    siteReference: input.siteReference,
    actualStart: input.actualStart,
    actualFinish: input.actualFinish,
    elapsedDurationMinutes: input.elapsedDurationMinutes,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    notes: input.notes,
    attachments: input.attachments,
    operatorReferences: input.operatorReferences,
    machineReferences: input.machineReferences,
    telemetryReferences: input.telemetryReferences,
    lineage: deepClone(input.lineage),
    activities: [],
    revisionHistory: [],
  };
}

function setExecutionReferences(execution: ExecutionRecord): void {
  if (execution.lineage.scheduleId) {
    executionIdByScheduleId = {
      ...executionIdByScheduleId,
      [execution.lineage.scheduleId]: execution.documentId,
    };
  }
  if (execution.lineage.productionJobId) {
    executionIdByProductionJobId = {
      ...executionIdByProductionJobId,
      [execution.lineage.productionJobId]: execution.documentId,
    };
  }
  if (execution.lineage.operationId) {
    executionIdByOperationId = {
      ...executionIdByOperationId,
      [execution.lineage.operationId]: execution.documentId,
    };
  }
  if (execution.lineage.workOrderId) {
    executionIdByWorkOrderId = {
      ...executionIdByWorkOrderId,
      [execution.lineage.workOrderId]: execution.documentId,
    };
  }
}

function transitionExecution(input: {
  executionId: string;
  actor: string;
  action: ExecutionAuditEvent["action"];
  resultingState: ExecutionStatus;
  reason: string;
  changedFields: readonly string[];
  correlationId?: string | null;
  causationId?: string | null;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  eventType: ExecutionPublishedEvent["type"];
  eventPayload?: Readonly<Record<string, string | number | boolean | null>>;
}): { validation: ExecutionValidationResult; execution: ExecutionRecord | null } {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] },
      execution: null,
    };
  }

  try {
    const updated = mutateWithRollback(() => {
      const revision = buildRevisionRecord({
        execution: existing,
        author: input.actor,
        reason: input.reason,
        changedFields: input.changedFields,
        resultingState: input.resultingState,
      });

      const activity = recordActivity({
        execution: existing,
        actor: input.actor,
        status: input.resultingState,
        referenceType: "execution",
        referenceId: existing.documentId,
        summary: input.reason,
        metadata: input.metadata,
      });

      const next: ExecutionRecord = {
        ...existing,
        status: input.resultingState,
        lifecycleState: input.resultingState === "archived" ? "archived" : input.resultingState === "cancelled" || input.resultingState === "completed" || input.resultingState === "failed" ? "closed" : "active",
        revision: existing.revision + 1,
        version: existing.version + 1,
        updatedAt: nowIso(),
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
          correlationId: input.correlationId ?? existing.auditEnvelope.correlationId,
        },
        revisionHistory: [...existing.revisionHistory, revision],
        activities: [...existing.activities, activity],
      };

      executionStore.set(next.documentId, next);

      appendAuditEvent({
        execution: next,
        actor: input.actor,
        action: input.action,
        previousState: existing.status,
        resultingState: input.resultingState,
        correlationId: input.correlationId ?? existing.lineage.correlationId ?? next.documentId,
        causationId: input.causationId ?? existing.lineage.causationId ?? next.documentId,
        metadata: input.metadata,
      });

      publishExecutionEvent({
        execution: next,
        actor: input.actor,
        type: input.eventType,
        correlationId: input.correlationId ?? existing.lineage.correlationId ?? next.documentId,
        causationId: input.causationId ?? existing.lineage.causationId ?? next.documentId,
        payload: buildExecutionEventPayload({
          execution: next,
          activity,
          extra: input.eventPayload ?? {
            eventReason: input.reason,
          },
        }),
      });

      return next;
    });

    return { validation: { valid: true, issues: [] }, execution: updated };
  } catch (error) {
    if (error instanceof FoundationPersistenceConflictError) {
      return { validation: normalizeFailure("persistence", error), execution: null };
    }

    return { validation: normalizeFailure("execution", error), execution: null };
  }
}

function assertTransition(existing: ExecutionRecord, nextState: ExecutionStatus): string | null {
  if (existing.status === nextState) {
    return `Execution is already ${nextState}.`;
  }

  if (nextState === "ready") {
    return existing.status === "created" ? null : "Only created executions can be marked ready.";
  }

  if (nextState === "waiting") {
    return existing.status === "ready" || existing.status === "running" ? null : "Only ready or running executions can enter waiting.";
  }

  if (nextState === "running") {
    return existing.status === "ready" || existing.status === "waiting" || existing.status === "recovered" || existing.status === "paused" ? null : "Only ready, waiting, paused, or recovered executions can start.";
  }

  if (nextState === "paused") {
    return existing.status === "running" ? null : "Only running executions can be paused.";
  }

  if (nextState === "blocked") {
    return existing.status === "running" || existing.status === "paused" ? null : "Only running or paused executions can be blocked.";
  }

  if (nextState === "completed") {
    return existing.status === "running" || existing.status === "blocked" ? null : "Only running or blocked executions can be completed.";
  }

  if (nextState === "cancelled") {
    return existing.status === "completed" || existing.status === "archived" ? "Completed or archived executions cannot be cancelled." : null;
  }

  if (nextState === "failed") {
    return existing.status === "running" || existing.status === "paused" || existing.status === "blocked" ? null : "Only active executions can fail.";
  }

  if (nextState === "recovered") {
    return existing.status === "failed" ? null : "Only failed executions can be recovered.";
  }

  if (nextState === "archived") {
    return existing.status === "completed" || existing.status === "cancelled" || existing.status === "failed" || existing.status === "recovered" ? null : "Only completed, cancelled, failed, or recovered executions can be archived.";
  }

  return null;
}

function mapReferenceType(execution: ExecutionRecord): { referenceType: string; referenceId: string } {
  if (execution.lineage.scheduleId) {
    return { referenceType: "schedule", referenceId: execution.lineage.scheduleId };
  }
  if (execution.lineage.productionJobId) {
    return { referenceType: "production_job", referenceId: execution.lineage.productionJobId };
  }
  if (execution.lineage.operationId) {
    return { referenceType: "operation", referenceId: execution.lineage.operationId };
  }
  if (execution.lineage.workOrderId) {
    return { referenceType: "work_order", referenceId: execution.lineage.workOrderId };
  }
  return { referenceType: "execution", referenceId: execution.documentId };
}

function buildExecutionEventPayload(input: {
  execution: ExecutionRecord;
  activity?: ExecutionActivityRecord;
  extra?: Readonly<Record<string, string | number | boolean | null>>;
}): Readonly<Record<string, string | number | boolean | null>> {
  return freezeRecord({
    executionId: input.execution.documentId,
    executionNumber: input.execution.executionNumber,
    executionName: input.execution.executionName,
    executionStatus: input.execution.status,
    executionActivityId: input.activity?.activityId ?? null,
    scheduleId: input.execution.lineage.scheduleId,
    productionJobId: input.execution.lineage.productionJobId,
    operationId: input.execution.lineage.operationId,
    routingVersionId: input.execution.lineage.routingVersionId,
    workOrderId: input.execution.lineage.workOrderId,
    originSalesOrderId: input.execution.lineage.originSalesOrderId,
    originQuoteId: input.execution.lineage.originQuoteId,
    organizationId: input.execution.lineage.organizationId,
    siteId: input.execution.lineage.siteReference,
    ...input.extra,
  });
}

loadStateFromPersistence();

export function listExecutions(filters: ExecutionListFilters = {}): readonly ExecutionRecord[] {
  return filterExecutions(Array.from(executionStore.values()), filters);
}

export function getExecutionById(executionId: string): ExecutionRecord | null {
  return executionStore.get(executionId) ?? null;
}

export function getExecutionByScheduleId(scheduleId: string): ExecutionRecord | null {
  const executionId = executionIdByScheduleId[scheduleId];
  return executionId ? getExecutionById(executionId) : null;
}

export function getExecutionByProductionJobId(productionJobId: string): ExecutionRecord | null {
  const executionId = executionIdByProductionJobId[productionJobId];
  return executionId ? getExecutionById(executionId) : null;
}

export function listExecutionAuditEvents(executionId: string): readonly ExecutionAuditEvent[] {
  return Array.from(auditStore.values())
    .filter((event) => event.executionId === executionId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function listExecutionActivities(executionId: string): readonly ExecutionActivityRecord[] {
  return Array.from(activityStore.values())
    .filter((activity) => activity.executionId === executionId)
    .sort((left, right) => left.sequence - right.sequence);
}

export function listExecutionRevisions(executionId: string): readonly ExecutionRevisionRecord[] {
  const execution = executionStore.get(executionId);
  return execution ? execution.revisionHistory : [];
}

export function listExecutionPublishedEvents(executionId: string): readonly ExecutionPublishedEvent[] {
  return Array.from(eventStore.values())
    .filter((event) => event.aggregateId === executionId)
    .sort((left, right) =>
      left.aggregateVersion - right.aggregateVersion ||
      left.timestamp.localeCompare(right.timestamp) ||
      left.eventId.localeCompare(right.eventId),
    );
}

export function listExecutionTimeline(executionId: string): readonly ExecutionTimelineEntry[] {
  const execution = executionStore.get(executionId);
  if (!execution) {
    return [];
  }

  const activities: ExecutionTimelineEntry[] = listExecutionActivities(executionId).map((activity) => ({
    timestamp: activity.timestamp,
    category: "activity",
    title: activity.status,
    detail: `${activity.actor}: ${activity.summary}`,
  }));

  const auditEntries: ExecutionTimelineEntry[] = listExecutionAuditEvents(executionId).map((event) => ({
    timestamp: event.createdAt,
    category: "audit",
    title: event.action,
    detail: `${event.previousState} -> ${event.resultingState}`,
  }));

  const revisionEntries: ExecutionTimelineEntry[] = execution.revisionHistory.map((entry) => ({
    timestamp: entry.timestamp,
    category: "revision",
    title: `Revision ${entry.revisionNumber}`,
    detail: `${entry.author}: ${entry.reason}`,
  }));

  const eventEntries: ExecutionTimelineEntry[] = listExecutionPublishedEvents(executionId).map((event) => ({
    timestamp: event.timestamp,
    category: "event",
    title: event.type,
    detail: `Published by ${event.actor}`,
  }));

  return [...activities, ...auditEntries, ...revisionEntries, ...eventEntries].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

export function searchExecutionRegistry(filters: ExecutionSearchFilters): readonly ExecutionSearchResult[] {
  return searchExecutions(Array.from(executionStore.values()), filters);
}

export function createExecution(input: { payload: NewExecutionInput; actor: string }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const validation = validateNewExecutionInput(input.payload);
  if (!validation.valid) {
    return { validation, execution: null };
  }

  const referenceKey = executionReferenceKey(input.payload);
  if (referenceKey) {
    if (input.payload.scheduleId && executionIdByScheduleId[input.payload.scheduleId]) {
      return { validation: { valid: false, issues: [{ field: "lineage.scheduleId", message: "Execution already exists for this schedule." }] }, execution: null };
    }
    if (input.payload.productionJobId && executionIdByProductionJobId[input.payload.productionJobId]) {
      return { validation: { valid: false, issues: [{ field: "lineage.productionJobId", message: "Execution already exists for this production job." }] }, execution: null };
    }
    if (input.payload.operationId && executionIdByOperationId[input.payload.operationId]) {
      return { validation: { valid: false, issues: [{ field: "lineage.operationId", message: "Execution already exists for this operation." }] }, execution: null };
    }
    if (input.payload.workOrderId && executionIdByWorkOrderId[input.payload.workOrderId]) {
      return { validation: { valid: false, issues: [{ field: "lineage.workOrderId", message: "Execution already exists for this work order." }] }, execution: null };
    }
  }

  try {
    const created = mutateWithRollback(() => {
      const execution = buildBaseExecutionRecord(input.payload);
      const initialRevision = buildInitialRevisionRecord({
        execution,
        author: input.actor,
        reason: "Execution created",
      });
      const withRevision: ExecutionRecord = {
        ...execution,
        activities: [],
        revisionHistory: [initialRevision],
      };

      const reference = mapReferenceType(withRevision);
      const activity = recordActivity({
        execution: withRevision,
        actor: input.actor,
        status: "created",
        referenceType: reference.referenceType,
        referenceId: reference.referenceId,
        summary: "Execution session created",
        metadata: {
          executionNumber: withRevision.executionNumber,
          progress: withRevision.progress,
        },
      });

      const next: ExecutionRecord = {
        ...withRevision,
        activities: [activity],
      };

      executionStore.set(next.documentId, next);
      setExecutionReferences(next);

      appendAuditEvent({
        execution: next,
        actor: input.actor,
        action: "execution_created",
        previousState: "created",
        resultingState: "created",
        correlationId: next.lineage.correlationId ?? next.documentId,
        causationId: next.lineage.causationId ?? next.documentId,
        metadata: {
          executionNumber: next.executionNumber,
          referenceType: reference.referenceType,
          referenceId: reference.referenceId,
        },
      });

      publishExecutionEvent({
        execution: next,
        actor: input.actor,
        type: "ExecutionCreated",
        correlationId: next.lineage.correlationId ?? next.documentId,
        causationId: next.lineage.causationId ?? next.documentId,
        payload: buildExecutionEventPayload({
          execution: next,
          activity,
          extra: {
            eventReason: "Execution created",
            referenceType: reference.referenceType,
            referenceId: reference.referenceId,
          },
        }),
      });

      return next;
    });

    return { validation, execution: created };
  } catch (error) {
    return { validation: normalizeFailure("execution", error), execution: null };
  }
}

export function updateExecutionDraft(input: {
  executionId: string;
  patch: UpdateExecutionDraftInput;
  actor: string;
  expectedVersion?: number;
}): { validation: ExecutionValidationResult; execution: ExecutionRecord | null } {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  if (!["created", "ready", "waiting", "paused", "recovered"].includes(existing.status)) {
    return { validation: { valid: false, issues: [{ field: "status", message: "Only editable execution sessions can be updated." }] }, execution: null };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return { validation: { valid: false, issues: [{ field: "expectedVersion", message: "Version conflict detected." }] }, execution: null };
  }

  const validation = validateUpdateExecutionDraftInput(input.patch);
  if (!validation.valid) {
    return { validation, execution: null };
  }

  try {
    const updated = mutateWithRollback(() => {
      const next: ExecutionRecord = {
        ...existing,
        ...input.patch,
        metadata: input.patch.metadata ?? existing.metadata,
        updatedAt: nowIso(),
        version: existing.version + 1,
        revision: existing.revision + 1,
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      const revision = buildRevisionRecord({
        execution: existing,
        author: input.actor,
        reason: "Execution draft updated",
        changedFields: Object.keys(input.patch),
        resultingState: next.status,
      });

      next.revisionHistory = [...existing.revisionHistory, revision];
      const activity = recordActivity({
        execution: next,
        actor: input.actor,
        status: next.status,
        referenceType: "execution",
        referenceId: next.documentId,
        summary: "Execution draft updated",
        metadata: { fields: Object.keys(input.patch).join(",") },
      });
      next.activities = [...existing.activities, activity];

      executionStore.set(next.documentId, next);

      appendAuditEvent({
        execution: next,
        actor: input.actor,
        action: "execution_updated",
        previousState: existing.status,
        resultingState: next.status,
        correlationId: next.lineage.correlationId ?? next.documentId,
        causationId: next.lineage.causationId ?? next.documentId,
      });

      publishExecutionEvent({
        execution: next,
        actor: input.actor,
        type: "ExecutionUpdated",
        correlationId: next.lineage.correlationId ?? next.documentId,
        causationId: next.lineage.causationId ?? next.documentId,
        payload: buildExecutionEventPayload({
          execution: next,
          activity,
          extra: {
            eventReason: "Execution draft updated",
            changedFields: Object.keys(input.patch).join(","),
          },
        }),
      });

      return next;
    });

    return { validation, execution: updated };
  } catch (error) {
    return { validation: normalizeFailure("execution", error), execution: null };
  }
}

export function createExecutionRevision(input: CreateExecutionRevisionInput & { actor: string; expectedVersion?: number }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
  revision: ExecutionRevisionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null, revision: null };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return { validation: { valid: false, issues: [{ field: "expectedVersion", message: "Version conflict detected." }] }, execution: null, revision: null };
  }

  if (!input.reason || input.reason.trim().length < 3) {
    return { validation: { valid: false, issues: [{ field: "reason", message: "Revision reason is required." }] }, execution: null, revision: null };
  }

  try {
    const result = mutateWithRollback(() => {
      const revision = buildRevisionRecord({
        execution: existing,
        author: input.actor,
        reason: input.reason,
        changedFields: input.changedFields,
        resultingState: existing.status,
      });

      const next: ExecutionRecord = {
        ...existing,
        version: existing.version + 1,
        revision: revision.revisionNumber,
        updatedAt: nowIso(),
        revisionHistory: [...existing.revisionHistory, revision],
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      const activity = recordActivity({
        execution: next,
        actor: input.actor,
        status: next.status,
        referenceType: "execution",
        referenceId: next.documentId,
        summary: input.reason,
        metadata: { revisionNumber: revision.revisionNumber },
      });

      next.activities = [...existing.activities, activity];
      executionStore.set(next.documentId, next);

      appendAuditEvent({
        execution: next,
        actor: input.actor,
        action: "execution_revision_created",
        previousState: existing.status,
        resultingState: next.status,
        correlationId: next.lineage.correlationId ?? next.documentId,
        causationId: next.lineage.causationId ?? next.documentId,
        metadata: {
          revisionNumber: revision.revisionNumber,
          reason: input.reason,
        },
      });

      publishExecutionEvent({
        execution: next,
        actor: input.actor,
        type: "ExecutionRevised",
        correlationId: next.lineage.correlationId ?? next.documentId,
        causationId: next.lineage.causationId ?? next.documentId,
        payload: buildExecutionEventPayload({
          execution: next,
          activity,
          extra: {
            revisionNumber: revision.revisionNumber,
            reason: input.reason,
          },
        }),
      });

      return { execution: next, revision };
    });

    return { validation: { valid: true, issues: [] }, execution: result.execution, revision: result.revision };
  } catch (error) {
    return { validation: normalizeFailure("revision", error), execution: null, revision: null };
  }
}

export function markExecutionReady(input: { executionId: string; actor: string; reason?: string; expectedVersion?: number }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  const violation = assertTransition(existing, "ready");
  if (violation) {
    return { validation: { valid: false, issues: [{ field: "status", message: violation }] }, execution: null };
  }

  return transitionExecution({
    executionId: input.executionId,
    actor: input.actor,
    action: "execution_ready",
    resultingState: "ready",
    reason: input.reason ?? "Execution marked ready",
    changedFields: ["status"],
    correlationId: existing.lineage.correlationId,
    causationId: existing.lineage.causationId,
    eventType: "ExecutionUpdated",
    eventPayload: { status: "ready", eventReason: input.reason ?? "Execution marked ready" },
  });
}

export function waitExecution(input: { executionId: string; actor: string; reason?: string }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  const violation = assertTransition(existing, "waiting");
  if (violation) {
    return { validation: { valid: false, issues: [{ field: "status", message: violation }] }, execution: null };
  }

  return transitionExecution({
    executionId: input.executionId,
    actor: input.actor,
    action: "execution_updated",
    resultingState: "waiting",
    reason: input.reason ?? "Execution waiting",
    changedFields: ["status"],
    correlationId: existing.lineage.correlationId,
    causationId: existing.lineage.causationId,
    eventType: "ExecutionWaiting",
    eventPayload: { status: "waiting", eventReason: input.reason ?? "Execution waiting" },
  });
}

export function startExecution(input: { executionId: string; actor: string; reason?: string }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  const violation = assertTransition(existing, "running");
  if (violation) {
    return { validation: { valid: false, issues: [{ field: "status", message: violation }] }, execution: null };
  }

  return transitionExecution({
    executionId: input.executionId,
    actor: input.actor,
    action: "execution_started",
    resultingState: "running",
    reason: input.reason ?? "Execution started",
    changedFields: ["status"],
    correlationId: existing.lineage.correlationId,
    causationId: existing.lineage.causationId,
    eventType: "ExecutionStarted",
    eventPayload: { status: "running", eventReason: input.reason ?? "Execution started" },
  });
}

export function pauseExecution(input: { executionId: string; actor: string; reason?: string }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  const violation = assertTransition(existing, "paused");
  if (violation) {
    return { validation: { valid: false, issues: [{ field: "status", message: violation }] }, execution: null };
  }

  return transitionExecution({
    executionId: input.executionId,
    actor: input.actor,
    action: "execution_paused",
    resultingState: "paused",
    reason: input.reason ?? "Execution paused",
    changedFields: ["status"],
    correlationId: existing.lineage.correlationId,
    causationId: existing.lineage.causationId,
    eventType: "ExecutionPaused",
    eventPayload: { status: "paused", eventReason: input.reason ?? "Execution paused" },
  });
}

export function resumeExecution(input: { executionId: string; actor: string; reason?: string }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  const violation = assertTransition(existing, "running");
  if (violation) {
    return { validation: { valid: false, issues: [{ field: "status", message: violation }] }, execution: null };
  }

  return transitionExecution({
    executionId: input.executionId,
    actor: input.actor,
    action: "execution_resumed",
    resultingState: "running",
    reason: input.reason ?? "Execution resumed",
    changedFields: ["status"],
    correlationId: existing.lineage.correlationId,
    causationId: existing.lineage.causationId,
    eventType: "ExecutionResumed",
    eventPayload: { status: "running", eventReason: input.reason ?? "Execution resumed" },
  });
}

export function blockExecution(input: { executionId: string; actor: string; reason?: string }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  const violation = assertTransition(existing, "blocked");
  if (violation) {
    return { validation: { valid: false, issues: [{ field: "status", message: violation }] }, execution: null };
  }

  return transitionExecution({
    executionId: input.executionId,
    actor: input.actor,
    action: "execution_blocked",
    resultingState: "blocked",
    reason: input.reason ?? "Execution blocked",
    changedFields: ["status"],
    correlationId: existing.lineage.correlationId,
    causationId: existing.lineage.causationId,
    eventType: "ExecutionBlocked",
    eventPayload: { status: "blocked", eventReason: input.reason ?? "Execution blocked" },
  });
}

export function completeExecution(input: { executionId: string; actor: string; reason?: string }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  const violation = assertTransition(existing, "completed");
  if (violation) {
    return { validation: { valid: false, issues: [{ field: "status", message: violation }] }, execution: null };
  }

  return transitionExecution({
    executionId: input.executionId,
    actor: input.actor,
    action: "execution_completed",
    resultingState: "completed",
    reason: input.reason ?? "Execution completed",
    changedFields: ["status"],
    correlationId: existing.lineage.correlationId,
    causationId: existing.lineage.causationId,
    eventType: "ExecutionCompleted",
    eventPayload: { status: "completed", eventReason: input.reason ?? "Execution completed" },
  });
}

export function cancelExecution(input: { executionId: string; actor: string; reason?: string }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  const violation = assertTransition(existing, "cancelled");
  if (violation) {
    return { validation: { valid: false, issues: [{ field: "status", message: violation }] }, execution: null };
  }

  return transitionExecution({
    executionId: input.executionId,
    actor: input.actor,
    action: "execution_cancelled",
    resultingState: "cancelled",
    reason: input.reason ?? "Execution cancelled",
    changedFields: ["status"],
    correlationId: existing.lineage.correlationId,
    causationId: existing.lineage.causationId,
    eventType: "ExecutionCancelled",
    eventPayload: { status: "cancelled", eventReason: input.reason ?? "Execution cancelled" },
  });
}

export function failExecution(input: { executionId: string; actor: string; reason?: string }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  const violation = assertTransition(existing, "failed");
  if (violation) {
    return { validation: { valid: false, issues: [{ field: "status", message: violation }] }, execution: null };
  }

  return transitionExecution({
    executionId: input.executionId,
    actor: input.actor,
    action: "execution_failed",
    resultingState: "failed",
    reason: input.reason ?? "Execution failed",
    changedFields: ["status"],
    correlationId: existing.lineage.correlationId,
    causationId: existing.lineage.causationId,
    eventType: "ExecutionFailed",
    eventPayload: { status: "failed", eventReason: input.reason ?? "Execution failed" },
  });
}

export function recoverExecution(input: { executionId: string; actor: string; reason?: string }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  const violation = assertTransition(existing, "recovered");
  if (violation) {
    return { validation: { valid: false, issues: [{ field: "status", message: violation }] }, execution: null };
  }

  return transitionExecution({
    executionId: input.executionId,
    actor: input.actor,
    action: "execution_recovered",
    resultingState: "recovered",
    reason: input.reason ?? "Execution recovered",
    changedFields: ["status"],
    correlationId: existing.lineage.correlationId,
    causationId: existing.lineage.causationId,
    eventType: "ExecutionRecovered",
    eventPayload: { status: "recovered", eventReason: input.reason ?? "Execution recovered" },
  });
}

export function archiveExecution(input: { executionId: string; actor: string; reason?: string }): {
  validation: ExecutionValidationResult;
  execution: ExecutionRecord | null;
} {
  const existing = executionStore.get(input.executionId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "executionId", message: "Execution not found." }] }, execution: null };
  }

  const violation = assertTransition(existing, "archived");
  if (violation) {
    return { validation: { valid: false, issues: [{ field: "status", message: violation }] }, execution: null };
  }

  return transitionExecution({
    executionId: input.executionId,
    actor: input.actor,
    action: "execution_archived",
    resultingState: "archived",
    reason: input.reason ?? "Execution archived",
    changedFields: ["status"],
    correlationId: existing.lineage.correlationId,
    causationId: existing.lineage.causationId,
    eventType: "ExecutionArchived",
    eventPayload: { status: "archived", eventReason: input.reason ?? "Execution archived" },
  });
}

export function resetExecutionRepositoryForTests(): void {
  const reset = resetPersistedState<ExecutionRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(reset.state);
  stateRevision = reset.revision;
}
