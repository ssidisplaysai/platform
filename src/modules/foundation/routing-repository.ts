import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import { FOUNDATION_ROUTINGS } from "./routing-fixtures";
import { filterRoutings, searchRoutings } from "./routing-selectors";
import type {
  CreateRoutingVersionInput,
  NewRoutingInput,
  RoutingAuditEvent,
  RoutingListFilters,
  RoutingPublishedEvent,
  RoutingRecord,
  RoutingRevisionRecord,
  RoutingSearchFilters,
  RoutingSearchResult,
  RoutingStatus,
  RoutingTimelineEntry,
  RoutingValidationResult,
  RoutingVersionRecord,
  UpdateRoutingDraftInput,
} from "./routing-types";
import { validateNewRoutingInput, validateUpdateRoutingDraftInput } from "./routing-validation";

const PERSISTENCE_NAMESPACE = "routing-repository";
const ROUTING_EVENT_CONTRACT_VERSION = "v1.0.0";

type RoutingRepositoryState = {
  routings: RoutingRecord[];
  versions: RoutingVersionRecord[];
  auditEvents: RoutingAuditEvent[];
  publishedEvents: RoutingPublishedEvent[];
  sequenceByOrganization: Record<string, number>;
  versionSequenceByRouting: Record<string, number>;
};

const routingStore = new Map<string, RoutingRecord>();
const versionStore = new Map<string, RoutingVersionRecord>();
const auditStore = new Map<string, RoutingAuditEvent>();
const eventStore = new Map<string, RoutingPublishedEvent>();
let sequenceByOrganization: Record<string, number> = {};
let versionSequenceByRouting: Record<string, number> = {};
let stateRevision = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function createSeedState(): RoutingRepositoryState {
  return {
    routings: FOUNDATION_ROUTINGS.map((entry) => deepClone(entry)),
    versions: [],
    auditEvents: [],
    publishedEvents: [],
    sequenceByOrganization: {},
    versionSequenceByRouting: {},
  };
}

function applyState(state: RoutingRepositoryState): void {
  routingStore.clear();
  state.routings.forEach((entry) => routingStore.set(entry.documentId, deepClone(entry)));

  versionStore.clear();
  state.versions.forEach((entry) => versionStore.set(entry.routingVersionId, deepClone(entry)));

  auditStore.clear();
  state.auditEvents.forEach((entry) => auditStore.set(entry.eventId, deepClone(entry)));

  eventStore.clear();
  state.publishedEvents.forEach((entry) => eventStore.set(entry.eventId, deepClone(entry)));

  sequenceByOrganization = { ...state.sequenceByOrganization };
  versionSequenceByRouting = { ...state.versionSequenceByRouting };
}

function snapshotState(): RoutingRepositoryState {
  return {
    routings: Array.from(routingStore.values()).map((entry) => deepClone(entry)),
    versions: Array.from(versionStore.values()).map((entry) => deepClone(entry)),
    auditEvents: Array.from(auditStore.values()).map((entry) => deepClone(entry)),
    publishedEvents: Array.from(eventStore.values()).map((entry) => deepClone(entry)),
    sequenceByOrganization: { ...sequenceByOrganization },
    versionSequenceByRouting: { ...versionSequenceByRouting },
  };
}

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<RoutingRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(): void {
  const saved = savePersistedState<RoutingRepositoryState>({
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

function createRoutingId(organizationId: string, sequence: number): string {
  return `routing-${organizationId}-${sequence.toString().padStart(6, "0")}`;
}

function createRoutingNumber(organizationId: string, sequence: number): string {
  return `RT-${new Date().getUTCFullYear()}-${organizationId.slice(0, 4).toUpperCase()}-${sequence
    .toString()
    .padStart(6, "0")}`;
}

function createRoutingVersionId(routingId: string, versionNumber: number): string {
  return `routing-version-${routingId}-${versionNumber.toString().padStart(4, "0")}`;
}

function createAuditId(routingId: string): string {
  return `routing-audit-${routingId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createEventId(routingId: string): string {
  return `routing-event-${routingId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function normalizeFailure(field: string, error: unknown): RoutingValidationResult {
  return { valid: false, issues: [{ field, message: (error as Error).message }] };
}

function buildRevisionRecord(input: {
  routing: RoutingRecord;
  author: string;
  reason: string;
  changedFields: readonly string[];
  resultingState: RoutingStatus;
}): RoutingRevisionRecord {
  return {
    revisionNumber: input.routing.revision + 1,
    parentRevision: input.routing.revision,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: input.changedFields.length > 0 ? [...input.changedFields] : ["unspecified_change"],
    previousState: input.routing.status,
    resultingState: input.resultingState,
    versionContinuity: true,
  };
}

function appendAuditEvent(input: {
  routing: RoutingRecord;
  actor: string;
  action: RoutingAuditEvent["action"];
  previousState: RoutingStatus;
  resultingState: RoutingStatus;
  correlationId: string;
  causationId: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}): RoutingAuditEvent {
  const event: RoutingAuditEvent = {
    eventId: createAuditId(input.routing.documentId),
    routingId: input.routing.documentId,
    organizationId: input.routing.organizationId,
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

function publishRoutingEvent(input: {
  routing: RoutingRecord;
  actor: string;
  type: RoutingPublishedEvent["type"];
  correlationId: string;
  causationId: string;
  payload?: Readonly<Record<string, string | number | boolean | null>>;
}): RoutingPublishedEvent {
  const event: RoutingPublishedEvent = {
    eventId: createEventId(input.routing.documentId),
    contractVersion: ROUTING_EVENT_CONTRACT_VERSION,
    aggregateType: "routing",
    aggregateId: input.routing.documentId,
    aggregateVersion: input.routing.version,
    correlationId: input.correlationId,
    causationId: input.causationId,
    timestamp: nowIso(),
    actor: input.actor,
    organizationId: input.routing.organizationId,
    type: input.type,
    payload: input.payload ?? {},
    metadata: {
      schemaRef: "gmp.routing.event.v1",
      producedBy: "gmp",
      status: input.routing.status,
    },
  };

  eventStore.set(event.eventId, event);
  return event;
}

function createVersionSnapshot(input: {
  routing: RoutingRecord;
  author: string;
  reason: string;
  changedFields: readonly string[];
  resultingState: RoutingStatus;
}): RoutingVersionRecord {
  const versionSequence = versionSequenceByRouting[input.routing.documentId] ?? input.routing.version;
  const nextVersion = versionSequence + 1;
  versionSequenceByRouting = {
    ...versionSequenceByRouting,
    [input.routing.documentId]: nextVersion,
  };

  return {
    routingVersionId: createRoutingVersionId(input.routing.documentId, nextVersion),
    routingId: input.routing.documentId,
    routingNumber: input.routing.routingNumber,
    versionNumber: nextVersion,
    parentVersion: nextVersion > 1 ? nextVersion - 1 : null,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: input.changedFields.length > 0 ? [...input.changedFields] : ["unspecified_change"],
    previousState: input.routing.status,
    resultingState: input.resultingState,
    versionContinuity: true,
    effectiveDate: input.routing.effectiveDate,
    routingName: input.routing.routingName,
    description: input.routing.description,
    productReference: input.routing.productReference,
    assemblyReference: input.routing.assemblyReference,
    operationSequence: deepClone(input.routing.operationSequence),
    parallelOperationGroups: deepClone(input.routing.parallelOperationGroups),
    conditionalBranchReferences: deepClone(input.routing.conditionalBranchReferences),
    estimatedCycleTimeMinutes: input.routing.estimatedCycleTimeMinutes,
    estimatedSetupTimeMinutes: input.routing.estimatedSetupTimeMinutes,
    estimatedRunTimeMinutes: input.routing.estimatedRunTimeMinutes,
    estimatedChangeoverTimeMinutes: input.routing.estimatedChangeoverTimeMinutes,
    referencedWorkCenters: deepClone(input.routing.referencedWorkCenters),
    referencedMachineTypes: deepClone(input.routing.referencedMachineTypes),
    referencedSkills: deepClone(input.routing.referencedSkills),
    engineeringNotes: input.routing.engineeringNotes,
    referenceDocuments: deepClone(input.routing.referenceDocuments),
    lineage: deepClone(input.routing.lineage),
  };
}

function transitionViolationMessage(status: RoutingStatus, allowedStatuses: readonly RoutingStatus[]): string {
  return `Routing cannot transition from ${status}. Allowed states: ${allowedStatuses.join(", ")}.`;
}

function buildBaseRouting(input: NewRoutingInput): RoutingRecord {
  const sequence = (sequenceByOrganization[input.organizationId] ?? 0) + 1;
  sequenceByOrganization = {
    ...sequenceByOrganization,
    [input.organizationId]: sequence,
  };

  const routingId = createRoutingId(input.organizationId, sequence);
  const routingNumber = input.routingNumber?.trim().length
    ? input.routingNumber.trim()
    : createRoutingNumber(input.organizationId, sequence);

  return {
    documentId: routingId,
    documentNumber: routingNumber,
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
    routingNumber,
    routingName: input.routingName,
    description: input.description,
    effectiveDate: input.effectiveDate,
    status: "draft",
    productReference: input.productReference,
    assemblyReference: input.assemblyReference,
    operationSequence: deepClone(input.operationSequence),
    parallelOperationGroups: deepClone(input.parallelOperationGroups),
    conditionalBranchReferences: deepClone(input.conditionalBranchReferences),
    estimatedCycleTimeMinutes: input.estimatedCycleTimeMinutes,
    estimatedSetupTimeMinutes: input.estimatedSetupTimeMinutes,
    estimatedRunTimeMinutes: input.estimatedRunTimeMinutes,
    estimatedChangeoverTimeMinutes: input.estimatedChangeoverTimeMinutes,
    referencedWorkCenters: deepClone(input.referencedWorkCenters),
    referencedMachineTypes: deepClone(input.referencedMachineTypes),
    referencedSkills: deepClone(input.referencedSkills),
    engineeringNotes: input.engineeringNotes,
    referenceDocuments: deepClone(input.referenceDocuments),
    lineage: input.lineage,
    revisionHistory: [],
  };
}

function mutateRouting(input: {
  routingId: string;
  actor: string;
  action: RoutingAuditEvent["action"];
  resultingState: RoutingStatus;
  reason: string;
  changedFields: readonly string[];
  correlationId: string;
  causationId: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  mutator: (routing: RoutingRecord) => RoutingRecord;
  eventType?: RoutingPublishedEvent["type"];
  eventPayload?: Readonly<Record<string, string | number | boolean | null>>;
}): { validation: RoutingValidationResult; routing: RoutingRecord | null } {
  const existing = routingStore.get(input.routingId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "routingId", message: "Routing not found." }] }, routing: null };
  }

  try {
    const updated = mutateWithRollback(() => {
      const next = input.mutator(existing);
      const revision = buildRevisionRecord({
        routing: next,
        author: input.actor,
        reason: input.reason,
        changedFields: input.changedFields,
        resultingState: input.resultingState,
      });

      const finalRouting: RoutingRecord = {
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

      routingStore.set(finalRouting.documentId, finalRouting);
      versionStore.set(
        createRoutingVersionId(finalRouting.documentId, finalRouting.version),
        createVersionSnapshot({
          routing: finalRouting,
          author: input.actor,
          reason: input.reason,
          changedFields: input.changedFields,
          resultingState: input.resultingState,
        }),
      );
      appendAuditEvent({
        routing: finalRouting,
        actor: input.actor,
        action: input.action,
        previousState: existing.status,
        resultingState: input.resultingState,
        correlationId: input.correlationId,
        causationId: input.causationId,
        metadata: input.metadata,
      });

      if (input.eventType) {
        publishRoutingEvent({
          routing: finalRouting,
          actor: input.actor,
          type: input.eventType,
          correlationId: input.correlationId,
          causationId: input.causationId,
          payload: input.eventPayload ?? { routingNumber: finalRouting.routingNumber, status: finalRouting.status },
        });
      }

      return finalRouting;
    });

    return { validation: { valid: true, issues: [] }, routing: updated };
  } catch (error) {
    if (error instanceof FoundationPersistenceConflictError) {
      return { validation: normalizeFailure("persistence", error), routing: null };
    }

    return { validation: normalizeFailure("routing", error), routing: null };
  }
}

loadStateFromPersistence();

export function resetRoutingRepositoryForTests(): void {
  resetPersistedState({ namespace: PERSISTENCE_NAMESPACE, seedFactory: createSeedState });
  loadStateFromPersistence();
}

export function getRoutingById(routingId: string): RoutingRecord | undefined {
  return routingStore.get(routingId);
}

export function listRoutings(filters: RoutingListFilters = {}): RoutingRecord[] {
  return filterRoutings(Array.from(routingStore.values()), filters);
}

export function searchRoutingRegistry(filters: RoutingSearchFilters): RoutingSearchResult[] {
  return searchRoutings(Array.from(routingStore.values()), filters);
}

export function listRoutingVersions(routingId: string): RoutingVersionRecord[] {
  return Array.from(versionStore.values())
    .filter((entry) => entry.routingId === routingId)
    .sort((left, right) => left.versionNumber - right.versionNumber);
}

export function listRoutingAuditEvents(routingId: string): RoutingAuditEvent[] {
  return Array.from(auditStore.values())
    .filter((entry) => entry.routingId === routingId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function listRoutingPublishedEvents(routingId: string): RoutingPublishedEvent[] {
  return Array.from(eventStore.values())
    .filter((entry) => entry.aggregateId === routingId)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function listRoutingTimeline(routingId: string): RoutingTimelineEntry[] {
  const routing = routingStore.get(routingId);
  if (!routing) {
    return [];
  }

  const entries: RoutingTimelineEntry[] = [];

  listRoutingAuditEvents(routingId).forEach((event) => {
    entries.push({
      timestamp: event.createdAt,
      category: "audit",
      title: event.action,
      detail: `${event.previousState} -> ${event.resultingState}`,
    });
  });

  listRoutingVersions(routingId).forEach((version) => {
    entries.push({
      timestamp: version.timestamp,
      category: "version",
      title: `Version ${version.versionNumber}`,
      detail: version.reason,
    });
  });

  listRoutingPublishedEvents(routingId).forEach((event) => {
    entries.push({
      timestamp: event.timestamp,
      category: "event",
      title: event.type,
      detail: `${event.aggregateVersion}`,
    });
  });

  return entries.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function createRouting(input: {
  payload: NewRoutingInput;
  actor: string;
  reason?: string;
  correlationId?: string | null;
  causationId?: string | null;
}): { validation: RoutingValidationResult; routing: RoutingRecord | null } {
  const validation = validateNewRoutingInput(input.payload);
  if (!validation.valid) {
    return { validation, routing: null };
  }

  const routing = mutateWithRollback(() => {
    const next = buildBaseRouting(input.payload);
    const revision = buildRevisionRecord({
      routing: next,
      author: input.actor,
      reason: input.reason ?? "Routing created",
      changedFields: ["initial_creation"],
      resultingState: next.status,
    });

    const created: RoutingRecord = {
      ...next,
      revisionHistory: [revision],
    };

    routingStore.set(created.documentId, created);
    versionStore.set(
      createRoutingVersionId(created.documentId, 1),
      createVersionSnapshot({
        routing: created,
        author: input.actor,
        reason: input.reason ?? "Routing created",
        changedFields: ["initial_creation"],
        resultingState: created.status,
      }),
    );
    appendAuditEvent({
      routing: created,
      actor: input.actor,
      action: "routing_created",
      previousState: created.status,
      resultingState: created.status,
      correlationId: input.correlationId ?? created.lineage.correlationId ?? created.documentId,
      causationId: input.causationId ?? created.lineage.causationId ?? created.documentId,
      metadata: input.payload.metadata,
    });
    publishRoutingEvent({
      routing: created,
      actor: input.actor,
      type: "RoutingCreated",
      correlationId: input.correlationId ?? created.lineage.correlationId ?? created.documentId,
      causationId: input.causationId ?? created.lineage.causationId ?? created.documentId,
      payload: { routingNumber: created.routingNumber, status: created.status },
    });

    return created;
  });

  return { validation: { valid: true, issues: [] }, routing };
}

export function updateRoutingDraft(input: {
  routingId: string;
  patch: UpdateRoutingDraftInput;
  actor: string;
  reason?: string;
  correlationId?: string | null;
  causationId?: string | null;
}): { validation: RoutingValidationResult; routing: RoutingRecord | null } {
  const existing = routingStore.get(input.routingId);
  if (!existing) {
    return { validation: { valid: false, issues: [{ field: "routingId", message: "Routing not found." }] }, routing: null };
  }

  const validation = validateUpdateRoutingDraftInput(existing, input.patch);
  if (!validation.valid) {
    return { validation, routing: null };
  }

  return mutateRouting({
    routingId: input.routingId,
    actor: input.actor,
    action: "routing_updated",
    resultingState: existing.status,
    reason: input.reason ?? "Routing updated",
    changedFields: Object.keys(input.patch),
    correlationId: input.correlationId ?? existing.lineage.correlationId ?? input.routingId,
    causationId: input.causationId ?? existing.lineage.causationId ?? input.routingId,
    mutator: (routing) => ({
      ...routing,
      ownerReference: input.patch.ownerReference ?? routing.ownerReference,
      salesRepresentativeReference: input.patch.salesRepresentativeReference ?? routing.salesRepresentativeReference,
      siteReference: input.patch.siteReference ?? routing.siteReference,
      routingNumber: input.patch.routingNumber?.trim().length ? input.patch.routingNumber.trim() : routing.routingNumber,
      routingName: input.patch.routingName ?? routing.routingName,
      description: input.patch.description ?? routing.description,
      effectiveDate: input.patch.effectiveDate ?? routing.effectiveDate,
      productReference: input.patch.productReference ?? routing.productReference,
      assemblyReference: input.patch.assemblyReference ?? routing.assemblyReference,
      operationSequence: input.patch.operationSequence ? deepClone(input.patch.operationSequence) : routing.operationSequence,
      parallelOperationGroups: input.patch.parallelOperationGroups ? deepClone(input.patch.parallelOperationGroups) : routing.parallelOperationGroups,
      conditionalBranchReferences: input.patch.conditionalBranchReferences ? deepClone(input.patch.conditionalBranchReferences) : routing.conditionalBranchReferences,
      estimatedCycleTimeMinutes: input.patch.estimatedCycleTimeMinutes ?? routing.estimatedCycleTimeMinutes,
      estimatedSetupTimeMinutes: input.patch.estimatedSetupTimeMinutes ?? routing.estimatedSetupTimeMinutes,
      estimatedRunTimeMinutes: input.patch.estimatedRunTimeMinutes ?? routing.estimatedRunTimeMinutes,
      estimatedChangeoverTimeMinutes: input.patch.estimatedChangeoverTimeMinutes ?? routing.estimatedChangeoverTimeMinutes,
      referencedWorkCenters: input.patch.referencedWorkCenters ? deepClone(input.patch.referencedWorkCenters) : routing.referencedWorkCenters,
      referencedMachineTypes: input.patch.referencedMachineTypes ? deepClone(input.patch.referencedMachineTypes) : routing.referencedMachineTypes,
      referencedSkills: input.patch.referencedSkills ? deepClone(input.patch.referencedSkills) : routing.referencedSkills,
      engineeringNotes: input.patch.engineeringNotes ?? routing.engineeringNotes,
      referenceDocuments: input.patch.referenceDocuments ? deepClone(input.patch.referenceDocuments) : routing.referenceDocuments,
      metadata: input.patch.metadata ?? routing.metadata,
    }),
  });
}

export function createRoutingVersion(input: CreateRoutingVersionInput): { validation: RoutingValidationResult; version: RoutingVersionRecord | null } {
  const routing = routingStore.get(input.routingId);
  if (!routing) {
    return { validation: { valid: false, issues: [{ field: "routingId", message: "Routing not found." }] }, version: null };
  }

  return mutateWithRollback(() => {
    const version = createVersionSnapshot({
      routing,
      author: input.actor,
      reason: input.reason,
      changedFields: input.changedFields,
      resultingState: routing.status,
    });

    versionStore.set(version.routingVersionId, version);
    const updatedRouting: RoutingRecord = {
      ...routing,
      version: version.versionNumber,
      updatedAt: nowIso(),
      revisionHistory: [
        ...routing.revisionHistory,
        {
          revisionNumber: routing.revision + 1,
          parentRevision: routing.revision,
          author: input.actor,
          timestamp: version.timestamp,
          reason: input.reason,
          changedFields: input.changedFields.length > 0 ? [...input.changedFields] : ["version_created"],
          previousState: routing.status,
          resultingState: routing.status,
          versionContinuity: true,
        },
      ],
    };

    routingStore.set(updatedRouting.documentId, updatedRouting);
    appendAuditEvent({
      routing: updatedRouting,
      actor: input.actor,
      action: "routing_version_created",
      previousState: routing.status,
      resultingState: routing.status,
      correlationId: routing.lineage.correlationId ?? routing.documentId,
      causationId: routing.lineage.causationId ?? routing.documentId,
      metadata: { versionNumber: version.versionNumber },
    });
    publishRoutingEvent({
      routing: updatedRouting,
      actor: input.actor,
      type: "RoutingVersionCreated",
      correlationId: routing.lineage.correlationId ?? routing.documentId,
      causationId: routing.lineage.causationId ?? routing.documentId,
      payload: { versionNumber: version.versionNumber, routingNumber: routing.routingNumber },
    });

    return { validation: { valid: true, issues: [] }, version };
  });
}

export function defineRouting(input: { routingId: string; actor: string }) {
  return mutateRouting({
    routingId: input.routingId,
    actor: input.actor,
    action: "routing_updated",
    resultingState: "defined",
    reason: "Routing defined",
    changedFields: ["status"],
    correlationId: input.routingId,
    causationId: input.routingId,
    mutator: (routing) => {
      if (routing.status !== "draft") {
        throw new Error(transitionViolationMessage(routing.status, ["draft"]));
      }
      return routing;
    },
  });
}

export function releaseRouting(input: { routingId: string; actor: string }) {
  return mutateRouting({
    routingId: input.routingId,
    actor: input.actor,
    action: "routing_released",
    resultingState: "released",
    reason: "Routing released",
    changedFields: ["status"],
    correlationId: input.routingId,
    causationId: input.routingId,
    eventType: "RoutingReleased",
    mutator: (routing) => {
      if (routing.status !== "defined") {
        throw new Error(transitionViolationMessage(routing.status, ["defined"]));
      }
      return routing;
    },
  });
}

export function supersedeRouting(input: { routingId: string; actor: string }) {
  return mutateRouting({
    routingId: input.routingId,
    actor: input.actor,
    action: "routing_updated",
    resultingState: "superseded",
    reason: "Routing superseded",
    changedFields: ["status"],
    correlationId: input.routingId,
    causationId: input.routingId,
    mutator: (routing) => {
      if (routing.status !== "released") {
        throw new Error(transitionViolationMessage(routing.status, ["released"]));
      }
      return routing;
    },
  });
}

export function archiveRouting(input: { routingId: string; actor: string }) {
  return mutateRouting({
    routingId: input.routingId,
    actor: input.actor,
    action: "routing_archived",
    resultingState: "archived",
    reason: "Routing archived",
    changedFields: ["status"],
    correlationId: input.routingId,
    causationId: input.routingId,
    eventType: "RoutingArchived",
    mutator: (routing) => {
      if (!["released", "superseded"].includes(routing.status)) {
        throw new Error(transitionViolationMessage(routing.status, ["released", "superseded"]));
      }
      return routing;
    },
  });
}

export function closeRouting(input: { routingId: string; actor: string }) {
  return mutateRouting({
    routingId: input.routingId,
    actor: input.actor,
    action: "routing_closed",
    resultingState: "closed",
    reason: "Routing closed",
    changedFields: ["status"],
    correlationId: input.routingId,
    causationId: input.routingId,
    eventType: "RoutingClosed",
    mutator: (routing) => {
      if (!["archived", "superseded"].includes(routing.status)) {
        throw new Error(transitionViolationMessage(routing.status, ["archived", "superseded"]));
      }
      return routing;
    },
  });
}

loadStateFromPersistence();