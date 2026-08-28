import { createCanonicalContentHash } from "./canonical-content-hash";
import {
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import type {
  TargetEligibility,
  TargetInventoryRecord,
  TargetParentReferences,
  TargetState,
} from "./target-inventory";

const PERSISTENCE_NAMESPACE = "target-inventory-repository";

type TargetInventoryRepositoryState = {
  targets: TargetInventoryRecord[];
};

export type TargetInventoryFilters = {
  organizationId?: string;
  siteId?: string;
  pageBlueprintId?: string;
  productFamilyId?: string;
  productId?: string;
  stateCode?: string;
  cityKey?: string;
  targetState?: TargetState;
  eligibility?: TargetEligibility;
};

export type UpdateTargetInventoryMetadataInput = {
  targetState?: TargetState;
  eligibility?: TargetEligibility;
  wordpressObjectId?: string | null;
  wordpressStatus?: string | null;
  wordpressUrl?: string | null;
  parentReferences?: TargetParentReferences;
  updatedAt?: string;
};

export class TargetInventoryRepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TargetInventoryRepositoryError";
    this.code = code;
  }
}

const targetStore = new Map<string, TargetInventoryRecord>();
let stateRevision = 0;

function emptyState(): TargetInventoryRepositoryState {
  return { targets: [] };
}

function applyState(state: TargetInventoryRepositoryState): void {
  targetStore.clear();
  state.targets.forEach((target) => targetStore.set(target.targetId, deepClone(target)));
}

function snapshotState(): TargetInventoryRepositoryState {
  return { targets: [...targetStore.values()].map((target) => deepClone(target)) };
}

const loaded = loadPersistedState<TargetInventoryRepositoryState>({
  namespace: PERSISTENCE_NAMESPACE,
  seedFactory: emptyState,
});
applyState(loaded.state);
stateRevision = loaded.revision;

function persistCurrentState(): void {
  const saved = savePersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });
  stateRevision = saved.revision;
}

function assertRepositoryRevision(expectedRepositoryRevision?: number): void {
  if (expectedRepositoryRevision !== undefined && expectedRepositoryRevision !== stateRevision) {
    throw new TargetInventoryRepositoryError(
      "REPOSITORY_REVISION_CONFLICT",
      `Expected repository revision ${expectedRepositoryRevision}, found ${stateRevision}.`,
    );
  }
}

function mutateWithRollback<T>(mutator: () => T, expectedRepositoryRevision?: number): T {
  assertRepositoryRevision(expectedRepositoryRevision);
  const before = snapshotState();
  try {
    const result = mutator();
    persistCurrentState();
    return deepClone(result);
  } catch (error) {
    applyState(before);
    throw error;
  }
}

function immutableIdentity(target: TargetInventoryRecord): unknown {
  return {
    targetId: target.targetId,
    pageIdentityId: target.pageIdentityId,
    organizationId: target.organizationId,
    siteId: target.siteId,
    pageBlueprintId: target.pageBlueprintId,
    identity: target.identity,
    subject: target.subject,
    geography: target.geography,
    canonicalDimensions: target.canonicalDimensions,
    applicationPath: target.applicationPath,
    canonicalPath: target.canonicalPath,
    canonicalSlug: target.canonicalSlug,
    sourceCatalogAuthority: target.sourceProvenance.catalogAuthority,
  };
}

function assertSameIdentity(existing: TargetInventoryRecord, candidate: TargetInventoryRecord): void {
  if (createCanonicalContentHash(immutableIdentity(existing)) !== createCanonicalContentHash(immutableIdentity(candidate))) {
    throw new TargetInventoryRepositoryError(
      "TARGET_IDENTITY_CONFLICT",
      `Target ${candidate.targetId} conflicts with its immutable persisted identity.`,
    );
  }
}

export function getTargetInventoryRepositoryRevision(): number {
  return stateRevision;
}

export function createTargetInventoryRecord(
  target: TargetInventoryRecord,
  expectedRepositoryRevision?: number,
): TargetInventoryRecord {
  assertRepositoryRevision(expectedRepositoryRevision);
  const existing = targetStore.get(target.targetId);
  if (existing) {
    assertSameIdentity(existing, target);
    return deepClone(existing);
  }
  return mutateWithRollback(() => {
    targetStore.set(target.targetId, deepClone(target));
    return target;
  }, expectedRepositoryRevision);
}

export function getTargetInventoryRecord(targetId: string): TargetInventoryRecord | null {
  const target = targetStore.get(targetId);
  return target ? deepClone(target) : null;
}

export function listTargetInventoryRecords(
  filters: TargetInventoryFilters = {},
): readonly TargetInventoryRecord[] {
  return [...targetStore.values()]
    .filter((target) => !filters.organizationId || target.organizationId === filters.organizationId)
    .filter((target) => !filters.siteId || target.siteId === filters.siteId)
    .filter((target) => !filters.pageBlueprintId || target.pageBlueprintId === filters.pageBlueprintId)
    .filter((target) => !filters.productFamilyId || target.subject.productFamilyId === filters.productFamilyId)
    .filter((target) => !filters.productId || target.subject.productId === filters.productId)
    .filter((target) => !filters.stateCode || target.geography.stateCode === filters.stateCode)
    .filter((target) => !filters.cityKey || target.geography.cityKey === filters.cityKey)
    .filter((target) => !filters.targetState || target.targetState === filters.targetState)
    .filter((target) => !filters.eligibility || target.eligibility === filters.eligibility)
    .sort((left, right) => left.targetId.localeCompare(right.targetId))
    .map((target) => deepClone(target));
}

export function updateTargetInventoryMetadata(input: {
  targetId: string;
  expectedTargetVersion: number;
  patch: UpdateTargetInventoryMetadataInput;
  expectedRepositoryRevision?: number;
}): TargetInventoryRecord {
  const allowedPatchKeys = new Set([
    "targetState",
    "eligibility",
    "wordpressObjectId",
    "wordpressStatus",
    "wordpressUrl",
    "parentReferences",
    "updatedAt",
  ]);
  const forbiddenPatchKey = Object.keys(input.patch).find((key) => !allowedPatchKeys.has(key));
  if (forbiddenPatchKey) {
    throw new TargetInventoryRepositoryError(
      "TARGET_IDENTITY_IMMUTABLE",
      `Target identity field cannot be updated: ${forbiddenPatchKey}.`,
    );
  }
  return mutateWithRollback(() => {
    const existing = targetStore.get(input.targetId);
    if (!existing) {
      throw new TargetInventoryRepositoryError("TARGET_NOT_FOUND", `Target not found: ${input.targetId}`);
    }
    if (existing.version !== input.expectedTargetVersion) {
      throw new TargetInventoryRepositoryError(
        "TARGET_VERSION_CONFLICT",
        `Expected target version ${input.expectedTargetVersion}, found ${existing.version}.`,
      );
    }
    const updated: TargetInventoryRecord = {
      ...existing,
      ...input.patch,
      parentReferences: input.patch.parentReferences ?? existing.parentReferences,
      updatedAt: input.patch.updatedAt ?? new Date().toISOString(),
      version: existing.version + 1,
    };
    targetStore.set(updated.targetId, updated);
    return updated;
  }, input.expectedRepositoryRevision);
}

export function resetTargetInventoryRepositoryForTests(): void {
  const reset = resetPersistedState<TargetInventoryRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: emptyState,
  });
  applyState(reset.state);
  stateRevision = reset.revision;
}