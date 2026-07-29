import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import { FOUNDATION_MANUFACTURING_COMPONENTS } from "./manufacturing-fixtures";
import { validateManufacturingLifecycleTransition } from "./manufacturing-lifecycle";
import { filterManufacturingComponents, searchManufacturingComponents } from "./manufacturing-selectors";
import type {
  ManufacturingAuditEvent,
  ManufacturingFoundationRecord,
  ManufacturingFoundationStatus,
  ManufacturingListFilters,
  ManufacturingPublishedEvent,
  ManufacturingRevisionRecord,
  ManufacturingSearchFilters,
  ManufacturingSearchResult,
  ManufacturingValidationResult,
  NewManufacturingComponentInput,
  UpdateManufacturingComponentInput,
} from "./manufacturing-types";
import {
  validateNewManufacturingComponentInput,
  validateUpdateManufacturingComponentInput,
} from "./manufacturing-validation";

const PERSISTENCE_NAMESPACE = "manufacturing-foundation-repository";

type ManufacturingRepositoryState = {
  components: ManufacturingFoundationRecord[];
  auditEvents: ManufacturingAuditEvent[];
  publishedEvents: ManufacturingPublishedEvent[];
  sequenceByOrganization: Record<string, number>;
};

const componentStore = new Map<string, ManufacturingFoundationRecord>();
const auditStore = new Map<string, ManufacturingAuditEvent>();
const eventStore = new Map<string, ManufacturingPublishedEvent>();
let sequenceByOrganization: Record<string, number> = {};
let stateRevision = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function createSeedState(): ManufacturingRepositoryState {
  return {
    components: FOUNDATION_MANUFACTURING_COMPONENTS.map((component) => deepClone(component)),
    auditEvents: [],
    publishedEvents: [],
    sequenceByOrganization: {},
  };
}

function applyState(state: ManufacturingRepositoryState): void {
  componentStore.clear();
  state.components.forEach((component) => {
    componentStore.set(component.componentId, deepClone(component));
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
}

function snapshotState(): ManufacturingRepositoryState {
  return {
    components: Array.from(componentStore.values()).map((component) => deepClone(component)),
    auditEvents: Array.from(auditStore.values()).map((event) => deepClone(event)),
    publishedEvents: Array.from(eventStore.values()).map((event) => deepClone(event)),
    sequenceByOrganization: { ...sequenceByOrganization },
  };
}

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<ManufacturingRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(): void {
  const saved = savePersistedState<ManufacturingRepositoryState>({
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

function createComponentId(organizationId: string, sequence: number): string {
  return `mfg-foundation-${organizationId}-${sequence.toString().padStart(6, "0")}`;
}

function createComponentNumber(organizationId: string, sequence: number): string {
  return `MFG-FND-${new Date().getUTCFullYear()}-${organizationId.slice(0, 4).toUpperCase()}-${sequence
    .toString()
    .padStart(6, "0")}`;
}

function createAuditId(componentId: string): string {
  return `mfg-audit-${componentId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createEventId(componentId: string): string {
  return `mfg-event-${componentId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
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

function normalizeFailure(field: string, error: unknown): ManufacturingValidationResult {
  return {
    valid: false,
    issues: [{ field, message: (error as Error).message }],
  };
}

function buildInitialRevisionRecord(input: {
  component: ManufacturingFoundationRecord;
  author: string;
  reason: string;
}): ManufacturingRevisionRecord {
  return {
    revisionNumber: input.component.revision,
    parentRevision: null,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: ["initial_creation"],
    previousStatus: input.component.status,
    nextStatus: input.component.status,
  };
}

function buildRevisionRecord(input: {
  component: ManufacturingFoundationRecord;
  author: string;
  reason: string;
  changedFields: readonly string[];
  nextStatus: ManufacturingFoundationStatus;
}): ManufacturingRevisionRecord {
  return {
    revisionNumber: input.component.revision + 1,
    parentRevision: input.component.revision,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: input.changedFields.length > 0 ? [...input.changedFields] : ["unspecified_change"],
    previousStatus: input.component.status,
    nextStatus: input.nextStatus,
  };
}

function appendAuditEvent(input: {
  component: ManufacturingFoundationRecord;
  type: ManufacturingAuditEvent["type"];
  actor: string;
  summary: string;
  correlationId?: string | null;
}): ManufacturingAuditEvent {
  const event: ManufacturingAuditEvent = {
    eventId: createAuditId(input.component.componentId),
    componentId: input.component.componentId,
    organizationId: input.component.organizationId,
    type: input.type,
    actor: input.actor,
    createdAt: nowIso(),
    summary: input.summary,
    correlationId: input.correlationId ?? null,
  };

  auditStore.set(event.eventId, event);
  return event;
}

function publishEvent(input: {
  component: ManufacturingFoundationRecord;
  type: ManufacturingPublishedEvent["type"];
  actor: string;
  payload?: Readonly<Record<string, string | number | boolean | null>>;
}): ManufacturingPublishedEvent {
  const event: ManufacturingPublishedEvent = {
    eventId: createEventId(input.component.componentId),
    componentId: input.component.componentId,
    organizationId: input.component.organizationId,
    type: input.type,
    actor: input.actor,
    createdAt: nowIso(),
    payload: input.payload ?? {},
  };

  eventStore.set(event.eventId, event);
  return event;
}

loadStateFromPersistence();

export function listManufacturingComponents(
  filters: ManufacturingListFilters = {},
): readonly ManufacturingFoundationRecord[] {
  return filterManufacturingComponents(Array.from(componentStore.values()), filters);
}

export function getManufacturingComponentById(
  componentId: string,
): ManufacturingFoundationRecord | null {
  return componentStore.get(componentId) ?? null;
}

export function listManufacturingAuditEvents(componentId: string): readonly ManufacturingAuditEvent[] {
  return Array.from(auditStore.values())
    .filter((event) => event.componentId === componentId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function listManufacturingRevisions(componentId: string): readonly ManufacturingRevisionRecord[] {
  const component = componentStore.get(componentId);
  return component ? component.revisionHistory : [];
}

export function listManufacturingPublishedEvents(
  componentId: string,
): readonly ManufacturingPublishedEvent[] {
  return Array.from(eventStore.values())
    .filter((event) => event.componentId === componentId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function searchManufacturingFoundation(
  filters: ManufacturingSearchFilters,
): readonly ManufacturingSearchResult[] {
  return searchManufacturingComponents(Array.from(componentStore.values()), filters);
}

export function registerManufacturingComponent(input: NewManufacturingComponentInput & { actor: string }): {
  validation: ManufacturingValidationResult;
  component: ManufacturingFoundationRecord | null;
} {
  const validation = validateNewManufacturingComponentInput(input);
  if (!validation.valid) {
    return { validation, component: null };
  }

  const duplicate = Array.from(componentStore.values()).find(
    (component) =>
      component.organizationId === input.organizationId && component.componentKey === input.componentKey,
  );

  if (duplicate) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "componentKey", message: "Component key already exists in organization scope." }],
      },
      component: null,
    };
  }

  try {
    const created = mutateWithRollback(() => {
      const sequence = nextSequenceForOrganization(input.organizationId);
      const componentId = createComponentId(input.organizationId, sequence);
      const componentNumber = createComponentNumber(input.organizationId, sequence);
      const timestamp = nowIso();

      const component: ManufacturingFoundationRecord = {
        componentId,
        componentNumber,
        componentKey: input.componentKey,
        organizationId: input.organizationId,
        siteReference: input.siteReference,
        owningApplicationId: "gmp",
        componentType: input.componentType,
        displayName: input.displayName,
        description: input.description,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
        revision: 1,
        status: "draft",
        enabled: true,
        identityModelVersion: "v1.0.0",
        repositoryContractVersion: "v1.0.0",
        validationContractVersion: "v1.0.0",
        selectorContractVersion: "v1.0.0",
        lifecycleContractVersion: "v1.0.0",
        auditContractVersion: "v1.0.0",
        revisionContractVersion: "v1.0.0",
        searchContractVersion: "v1.0.0",
        authorizationContractVersion: "v1.0.0",
        eventContractVersion: "v1.0.0",
        persistenceContractVersion: "v1.0.0",
        metadata: input.metadata,
        auditEnvelope: {
          createdBy: input.actor,
          updatedBy: input.actor,
          correlationId: null,
        },
        revisionHistory: [],
      };

      component.revisionHistory = [
        buildInitialRevisionRecord({
          component,
          author: input.actor,
          reason: "Manufacturing foundation component registered",
        }),
      ];

      componentStore.set(component.componentId, component);

      appendAuditEvent({
        component,
        type: "component_registered",
        actor: input.actor,
        summary: `Manufacturing foundation component ${component.componentKey} registered.`,
      });

      publishEvent({
        component,
        type: "ManufacturingComponentRegistered",
        actor: input.actor,
        payload: {
          componentType: component.componentType,
          status: component.status,
        },
      });

      return component;
    });

    return { validation, component: created };
  } catch (error) {
    return { validation: normalizeFailure("component", error), component: null };
  }
}

export function updateManufacturingComponent(input: {
  componentId: string;
  patch: UpdateManufacturingComponentInput;
  actor: string;
  expectedVersion?: number;
}): {
  validation: ManufacturingValidationResult;
  component: ManufacturingFoundationRecord | null;
} {
  const existing = componentStore.get(input.componentId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "componentId", message: "Component not found." }] },
      component: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      component: null,
    };
  }

  const validation = validateUpdateManufacturingComponentInput(existing, input.patch);
  if (!validation.valid) {
    return { validation, component: null };
  }

  try {
    const updated = mutateWithRollback(() => {
      const next: ManufacturingFoundationRecord = {
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

      componentStore.set(next.componentId, next);

      appendAuditEvent({
        component: next,
        type: "component_updated",
        actor: input.actor,
        summary: `Manufacturing foundation component ${next.componentKey} updated.`,
      });

      publishEvent({
        component: next,
        type: "ManufacturingComponentUpdated",
        actor: input.actor,
        payload: {
          status: next.status,
          enabled: next.enabled,
        },
      });

      return next;
    });

    return { validation, component: updated };
  } catch (error) {
    return { validation: normalizeFailure("component", error), component: null };
  }
}

export function reviseManufacturingComponent(input: {
  componentId: string;
  actor: string;
  reason: string;
  changedFields: readonly string[];
  expectedVersion?: number;
}): {
  validation: ManufacturingValidationResult;
  component: ManufacturingFoundationRecord | null;
  revision: ManufacturingRevisionRecord | null;
} {
  const existing = componentStore.get(input.componentId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "componentId", message: "Component not found." }] },
      component: null,
      revision: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      component: null,
      revision: null,
    };
  }

  if (!input.reason || input.reason.trim().length < 3) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "reason", message: "Revision reason is required." }],
      },
      component: null,
      revision: null,
    };
  }

  try {
    const result = mutateWithRollback(() => {
      const revision = buildRevisionRecord({
        component: existing,
        author: input.actor,
        reason: input.reason,
        changedFields: input.changedFields,
        nextStatus: existing.status,
      });

      const next: ManufacturingFoundationRecord = {
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

      componentStore.set(next.componentId, next);

      appendAuditEvent({
        component: next,
        type: "component_revised",
        actor: input.actor,
        summary: `Revision ${revision.revisionNumber} created: ${input.reason}`,
      });

      publishEvent({
        component: next,
        type: "ManufacturingComponentRevised",
        actor: input.actor,
        payload: {
          revisionNumber: revision.revisionNumber,
          reason: input.reason,
        },
      });

      return { component: next, revision };
    });

    return {
      validation: { valid: true, issues: [] },
      component: result.component,
      revision: result.revision,
    };
  } catch (error) {
    return {
      validation: normalizeFailure("revision", error),
      component: null,
      revision: null,
    };
  }
}

export function transitionManufacturingComponentStatus(input: {
  componentId: string;
  actor: string;
  status: ManufacturingFoundationStatus;
  expectedVersion?: number;
}): {
  validation: ManufacturingValidationResult;
  component: ManufacturingFoundationRecord | null;
} {
  const existing = componentStore.get(input.componentId);
  if (!existing) {
    return {
      validation: { valid: false, issues: [{ field: "componentId", message: "Component not found." }] },
      component: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      component: null,
    };
  }

  const transition = validateManufacturingLifecycleTransition({
    from: existing.status,
    to: input.status,
  });

  if (!transition.valid) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "status", message: transition.message ?? "Invalid transition." }],
      },
      component: null,
    };
  }

  try {
    const updated = mutateWithRollback(() => {
      const next: ManufacturingFoundationRecord = {
        ...existing,
        status: input.status,
        updatedAt: nowIso(),
        version: existing.version + 1,
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      componentStore.set(next.componentId, next);

      appendAuditEvent({
        component: next,
        type: "component_status_changed",
        actor: input.actor,
        summary: `Component status transition: ${existing.status} -> ${next.status}`,
      });

      publishEvent({
        component: next,
        type: "ManufacturingComponentStatusChanged",
        actor: input.actor,
        payload: {
          previousStatus: existing.status,
          nextStatus: next.status,
        },
      });

      return next;
    });

    return {
      validation: { valid: true, issues: [] },
      component: updated,
    };
  } catch (error) {
    return {
      validation: normalizeFailure("status", error),
      component: null,
    };
  }
}

export function markManufacturingComponentViewed(input: {
  componentId: string;
  actor: string;
  correlationId?: string | null;
}): void {
  const component = componentStore.get(input.componentId);
  if (!component) {
    return;
  }

  try {
    mutateWithRollback(() => {
      appendAuditEvent({
        component,
        type: "component_viewed",
        actor: input.actor,
        summary: `Manufacturing foundation component ${component.componentKey} viewed.`,
        correlationId: input.correlationId,
      });
      return true;
    });
  } catch {
    // Viewing should not fail caller operations.
  }
}

export function initializeManufacturingFoundation(input: {
  organizationId: string;
  actor: string;
}): {
  validation: ManufacturingValidationResult;
  initialized: boolean;
} {
  const existing = Array.from(componentStore.values()).filter(
    (component) => component.organizationId === input.organizationId,
  );

  if (existing.length > 0) {
    return { validation: { valid: true, issues: [] }, initialized: true };
  }

  const result = registerManufacturingComponent({
    organizationId: input.organizationId,
    siteReference: null,
    componentType: "aggregate_base",
    componentKey: "manufacturing-aggregate-base",
    displayName: "Manufacturing Aggregate Base",
    description: "Canonical aggregate base contract for manufacturing foundation.",
    metadata: {
      scope: "foundation_only",
      package: "GMP-0001A",
    },
    actor: input.actor,
  });

  if (!result.validation.valid || !result.component) {
    return { validation: result.validation, initialized: false };
  }

  try {
    mutateWithRollback(() => {
      publishEvent({
        component: result.component as ManufacturingFoundationRecord,
        type: "ManufacturingFoundationInitialized",
        actor: input.actor,
        payload: {
          organizationId: input.organizationId,
          componentId: result.component?.componentId ?? null,
        },
      });
      appendAuditEvent({
        component: result.component as ManufacturingFoundationRecord,
        type: "foundation_initialized",
        actor: input.actor,
        summary: "Manufacturing foundation initialized.",
      });
      return true;
    });
  } catch (error) {
    return { validation: normalizeFailure("foundation", error), initialized: false };
  }

  return { validation: { valid: true, issues: [] }, initialized: true };
}

export function resetManufacturingRepositoryForTests(): void {
  const reset = resetPersistedState<ManufacturingRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(reset.state);
  stateRevision = reset.revision;
}

export function isManufacturingVersionConflict(error: unknown): boolean {
  return error instanceof FoundationPersistenceConflictError;
}
