import {
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import { createCanonicalContentHash, type CanonicalJsonValue } from "./canonical-content-hash";
import {
  CATALOG_IMPORT_TRANSITIONS,
  createCatalogRevisionContentHash,
  createSourceProvenanceIdentity,
  normalizeCatalogRevisionSnapshot,
  type CatalogDiagnostic,
  type CatalogImport,
  type CatalogImportRecord,
  type CatalogImportStatus,
  type CatalogRevision,
  type CatalogSource,
  type NewCatalogImportInput,
  type NewCatalogImportRecordInput,
  type NewCatalogRevisionInput,
  type NewCatalogSourceInput,
  type NewSourceProvenanceInput,
  type SourceProvenance,
  type UpdateCatalogSourceInput,
} from "./catalog-lineage";

const PERSISTENCE_NAMESPACE = "catalog-lineage-repository";

type CatalogLineageRepositoryState = {
  sources: CatalogSource[];
  imports: CatalogImport[];
  importRecords: CatalogImportRecord[];
  provenance: SourceProvenance[];
  revisions: CatalogRevision[];
  revisionSequenceByOrganization: Record<string, number>;
};

export class CatalogLineageRepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CatalogLineageRepositoryError";
    this.code = code;
  }
}

const sourceStore = new Map<string, CatalogSource>();
const importStore = new Map<string, CatalogImport>();
const importRecordStore = new Map<string, CatalogImportRecord>();
const provenanceStore = new Map<string, SourceProvenance>();
const revisionStore = new Map<string, CatalogRevision>();
let revisionSequenceByOrganization: Record<string, number> = {};
let stateRevision = 0;

function emptyState(): CatalogLineageRepositoryState {
  return {
    sources: [],
    imports: [],
    importRecords: [],
    provenance: [],
    revisions: [],
    revisionSequenceByOrganization: {},
  };
}

function applyState(state: CatalogLineageRepositoryState): void {
  sourceStore.clear();
  state.sources.forEach((record) => sourceStore.set(record.sourceId, deepClone(record)));
  importStore.clear();
  state.imports.forEach((record) => importStore.set(record.importId, deepClone(record)));
  importRecordStore.clear();
  state.importRecords.forEach((record) => importRecordStore.set(record.recordId, deepClone(record)));
  provenanceStore.clear();
  state.provenance.forEach((record) => provenanceStore.set(record.provenanceId, deepClone(record)));
  revisionStore.clear();
  state.revisions.forEach((record) => revisionStore.set(record.catalogRevisionId, deepClone(record)));
  revisionSequenceByOrganization = { ...state.revisionSequenceByOrganization };
}

function snapshotState(): CatalogLineageRepositoryState {
  return {
    sources: Array.from(sourceStore.values(), (record) => deepClone(record)),
    imports: Array.from(importStore.values(), (record) => deepClone(record)),
    importRecords: Array.from(importRecordStore.values(), (record) => deepClone(record)),
    provenance: Array.from(provenanceStore.values(), (record) => deepClone(record)),
    revisions: Array.from(revisionStore.values(), (record) => deepClone(record)),
    revisionSequenceByOrganization: { ...revisionSequenceByOrganization },
  };
}

const loaded = loadPersistedState<CatalogLineageRepositoryState>({
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

function mutateWithRollback<T>(mutator: () => T): T {
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

function nowIso(): string {
  return new Date().toISOString();
}

function redactDiagnostic(diagnostic: CatalogDiagnostic): CatalogDiagnostic {
  return {
    ...diagnostic,
    message: diagnostic.message.replace(
      /\b(password|secret|api[_-]?key|token|authorization|connection[_-]?string)\b\s*[:=]\s*\S+/gi,
      "$1=[REDACTED]",
    ),
  };
}

function containsSensitiveKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => containsSensitiveKey(entry));
  return Object.entries(value as Record<string, unknown>).some(([key, entry]) =>
    /^(password|secret|api[_-]?key|token|authorization|connection[_-]?string)$/i.test(key)
    || containsSensitiveKey(entry));
}

function validateReference(reference: string | null): void {
  if (!reference) return;
  if (/\s|=|:\/\//.test(reference) || /^(bearer|basic)\b/i.test(reference)) {
    throw new CatalogLineageRepositoryError(
      "INVALID_CONFIGURATION_REFERENCE",
      "Configuration references must be opaque identifiers, not credential values or URLs.",
    );
  }
}

function requireSource(sourceId: string): CatalogSource {
  const source = sourceStore.get(sourceId);
  if (!source) throw new CatalogLineageRepositoryError("SOURCE_NOT_FOUND", `Catalog source not found: ${sourceId}`);
  return source;
}

function requireImport(importId: string): CatalogImport {
  const catalogImport = importStore.get(importId);
  if (!catalogImport) throw new CatalogLineageRepositoryError("IMPORT_NOT_FOUND", `Catalog import not found: ${importId}`);
  return catalogImport;
}

export function createCatalogSource(input: NewCatalogSourceInput): CatalogSource {
  return mutateWithRollback(() => {
    if (sourceStore.has(input.sourceId)) {
      throw new CatalogLineageRepositoryError("SOURCE_ALREADY_EXISTS", `Catalog source already exists: ${input.sourceId}`);
    }
    validateReference(input.configurationReference);
    const timestamp = nowIso();
    const source: CatalogSource = {
      sourceId: input.sourceId,
      organizationId: input.organizationId,
      type: input.type,
      name: input.name,
      externalSystem: input.externalSystem,
      configurationReference: input.configurationReference,
      enabled: input.enabled,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    };
    sourceStore.set(source.sourceId, source);
    return source;
  });
}

export function getCatalogSource(sourceId: string): CatalogSource | null {
  const source = sourceStore.get(sourceId);
  return source ? deepClone(source) : null;
}

export function listCatalogSources(organizationId?: string): readonly CatalogSource[] {
  return Array.from(sourceStore.values())
    .filter((source) => !organizationId || source.organizationId === organizationId)
    .map((source) => deepClone(source));
}

export function updateCatalogSource(sourceId: string, patch: UpdateCatalogSourceInput): CatalogSource {
  return mutateWithRollback(() => {
    const existing = requireSource(sourceId);
    if (Object.prototype.hasOwnProperty.call(patch, "sourceId")
      || Object.prototype.hasOwnProperty.call(patch, "organizationId")) {
      throw new CatalogLineageRepositoryError(
        "SOURCE_IDENTITY_IMMUTABLE",
        "Catalog source identity and organization are immutable.",
      );
    }
    if (patch.configurationReference !== undefined) validateReference(patch.configurationReference);
    const updated: CatalogSource = {
      ...existing,
      type: patch.type ?? existing.type,
      name: patch.name ?? existing.name,
      externalSystem: patch.externalSystem !== undefined
        ? patch.externalSystem
        : existing.externalSystem,
      configurationReference: patch.configurationReference !== undefined
        ? patch.configurationReference
        : existing.configurationReference,
      updatedAt: nowIso(),
      version: existing.version + 1,
    };
    sourceStore.set(sourceId, updated);
    return updated;
  });
}

export function setCatalogSourceEnabled(sourceId: string, enabled: boolean): CatalogSource {
  return mutateWithRollback(() => {
    const existing = requireSource(sourceId);
    const updated = { ...existing, enabled, updatedAt: nowIso(), version: existing.version + 1 };
    sourceStore.set(sourceId, updated);
    return updated;
  });
}

export function createCatalogImport(input: NewCatalogImportInput): CatalogImport {
  return mutateWithRollback(() => {
    requireSource(input.sourceId);
    if (importStore.has(input.importId)) {
      throw new CatalogLineageRepositoryError("IMPORT_ALREADY_EXISTS", `Catalog import already exists: ${input.importId}`);
    }
    const duplicate = Array.from(importStore.values()).find(
      (record) => record.sourceId === input.sourceId && record.contentHash === input.contentHash,
    );
    if (duplicate) {
      throw new CatalogLineageRepositoryError(
        "DUPLICATE_IMPORT_DETECTED",
        `Import content already exists for source ${input.sourceId} as ${duplicate.importId}.`,
      );
    }
    const catalogImport: CatalogImport = {
      importId: input.importId,
      sourceId: input.sourceId,
      status: "RECEIVED",
      sourceVersion: input.sourceVersion,
      contentHash: input.contentHash,
      schemaVersion: input.schemaVersion,
      startedAt: input.startedAt,
      completedAt: null,
      createdBy: input.createdBy,
      recordCounts: deepClone(input.recordCounts),
      diagnostics: input.diagnostics.map(redactDiagnostic),
      statusHistory: [{
        from: null,
        to: "RECEIVED",
        transitionedAt: input.startedAt,
        actor: input.createdBy,
      }],
      version: 1,
    };
    importStore.set(catalogImport.importId, catalogImport);
    return catalogImport;
  });
}

export function getCatalogImport(importId: string): CatalogImport | null {
  const catalogImport = importStore.get(importId);
  return catalogImport ? deepClone(catalogImport) : null;
}

export function listCatalogImports(sourceId?: string): readonly CatalogImport[] {
  return Array.from(importStore.values())
    .filter((catalogImport) => !sourceId || catalogImport.sourceId === sourceId)
    .map((catalogImport) => deepClone(catalogImport));
}

export function transitionCatalogImportStatus(input: {
  importId: string;
  status: CatalogImportStatus;
  diagnostics?: readonly CatalogDiagnostic[];
  completedAt?: string;
  actor?: string;
}): CatalogImport {
  return mutateWithRollback(() => {
    const existing = requireImport(input.importId);
    if (!CATALOG_IMPORT_TRANSITIONS[existing.status].includes(input.status)) {
      throw new CatalogLineageRepositoryError(
        "ILLEGAL_IMPORT_TRANSITION",
        `Catalog import cannot transition from ${existing.status} to ${input.status}.`,
      );
    }
    const transitionedAt = terminalTimestamp(input);
    const terminal = input.status === "APPLIED" || input.status === "REJECTED" || input.status === "FAILED";
    const updated: CatalogImport = {
      ...existing,
      status: input.status,
      completedAt: terminal ? transitionedAt : null,
      diagnostics: [
        ...existing.diagnostics,
        ...(input.diagnostics ?? []).map(redactDiagnostic),
      ],
      statusHistory: [
        ...existing.statusHistory,
        {
          from: existing.status,
          to: input.status,
          transitionedAt,
          actor: input.actor ?? "system",
        },
      ],
      version: existing.version + 1,
    };
    importStore.set(existing.importId, updated);
    return updated;
  });
}

export function appendCatalogImportRecord(input: NewCatalogImportRecordInput): CatalogImportRecord {
  return mutateWithRollback(() => {
    requireImport(input.importId);
    if (importRecordStore.has(input.recordId)) {
      throw new CatalogLineageRepositoryError("IMPORT_RECORD_ALREADY_EXISTS", `Import record already exists: ${input.recordId}`);
    }
    if (containsSensitiveKey(input.rawPayload)) {
      throw new CatalogLineageRepositoryError(
        "SENSITIVE_PAYLOAD_REJECTED",
        "Raw payload contains a direct credential-like field and was not persisted.",
      );
    }
    const record: CatalogImportRecord = {
      recordId: input.recordId,
      importId: input.importId,
      sourceLocator: deepClone(input.sourceLocator),
      rawPayloadHash: createCanonicalContentHash(input.rawPayload),
      rawPayload: deepClone(input.rawPayload),
      normalizedCandidate: deepClone(input.normalizedCandidate),
      status: input.status,
      diagnostics: input.diagnostics.map(redactDiagnostic),
      reconciliationDecision: input.reconciliationDecision,
      createdAt: nowIso(),
    };
    importRecordStore.set(record.recordId, record);
    return record;
  });
}

export function getCatalogImportRecord(recordId: string): CatalogImportRecord | null {
  const record = importRecordStore.get(recordId);
  return record ? deepClone(record) : null;
}

export function listCatalogImportRecords(importId: string): readonly CatalogImportRecord[] {
  return Array.from(importRecordStore.values())
    .filter((record) => record.importId === importId)
    .map((record) => deepClone(record));
}

export function appendSourceProvenance(input: NewSourceProvenanceInput): SourceProvenance {
  return mutateWithRollback(() => {
    const catalogImport = requireImport(input.importId);
    const importRecord = importRecordStore.get(input.importRecordId);
    if (!importRecord || importRecord.importId !== input.importId || catalogImport.sourceId !== input.sourceId) {
      throw new CatalogLineageRepositoryError(
        "PROVENANCE_LINEAGE_MISMATCH",
        "Provenance source, import, and import record must describe the same source observation.",
      );
    }
    const provenanceId = createSourceProvenanceIdentity(input);
    if (provenanceStore.has(provenanceId)) {
      throw new CatalogLineageRepositoryError(
        "PROVENANCE_ALREADY_EXISTS",
        `Source provenance already exists: ${provenanceId}`,
      );
    }
    const provenance: SourceProvenance = {
      ...deepClone(input),
      provenanceId,
      contentHash: createCanonicalContentHash({
        rawValue: input.rawValue,
        normalizedValue: input.normalizedValue,
        transformationChain: input.transformationChain,
      }),
    };
    provenanceStore.set(provenanceId, provenance);
    return provenance;
  });
}

export function getSourceProvenance(provenanceId: string): SourceProvenance | null {
  const provenance = provenanceStore.get(provenanceId);
  return provenance ? deepClone(provenance) : null;
}

export function listSourceProvenanceByImportRecord(importRecordId: string): readonly SourceProvenance[] {
  return Array.from(provenanceStore.values())
    .filter((record) => record.importRecordId === importRecordId)
    .map((record) => deepClone(record));
}

export function listSourceProvenanceByImport(importId: string): readonly SourceProvenance[] {
  return Array.from(provenanceStore.values())
    .filter((record) => record.importId === importId)
    .map((record) => deepClone(record));
}

function ids(records: readonly { id: string }[]): readonly string[] {
  return records.map((record) => record.id);
}

export function createCatalogRevision(input: NewCatalogRevisionInput): CatalogRevision {
  return mutateWithRollback(() => {
    input.snapshot.sourceImportIds.forEach((importId) => {
      const catalogImport = requireImport(importId);
      const source = requireSource(catalogImport.sourceId);
      if (source.organizationId !== input.organizationId) {
        throw new CatalogLineageRepositoryError(
          "REVISION_ORGANIZATION_MISMATCH",
          `Catalog import ${importId} belongs to another organization.`,
        );
      }
      if (catalogImport.status !== "APPROVED" && catalogImport.status !== "APPLIED") {
        throw new CatalogLineageRepositoryError(
          "IMPORT_NOT_APPROVED_FOR_REVISION",
          `Catalog import ${importId} must be APPROVED or APPLIED before revision creation.`,
        );
      }
    });
    const revisionNumber = (revisionSequenceByOrganization[input.organizationId] ?? 0) + 1;
    const previous = getLatestCatalogRevision(input.organizationId);
    const snapshot = normalizeCatalogRevisionSnapshot(input.snapshot);
    const catalogRevisionId = `catalog-revision-${input.organizationId}-${revisionNumber.toString().padStart(6, "0")}`;
    const revision: CatalogRevision = {
      catalogRevisionId,
      organizationId: input.organizationId,
      revisionNumber,
      contentHash: createCatalogRevisionContentHash(snapshot),
      createdAt: nowIso(),
      createdBy: input.createdBy,
      sourceImportIds: [...snapshot.sourceImportIds],
      productIds: ids(snapshot.products),
      productFamilyIds: ids(snapshot.productFamilies),
      variantIds: ids(snapshot.variants),
      attributeDefinitionIds: ids(snapshot.attributeDefinitions),
      mediaAssetIds: ids(snapshot.mediaAssets),
      documentAssetIds: ids(snapshot.documentAssets),
      previousRevisionId: previous?.catalogRevisionId ?? null,
      snapshot,
      metadata: deepClone(input.metadata),
    };
    revisionStore.set(revision.catalogRevisionId, revision);
    revisionSequenceByOrganization = {
      ...revisionSequenceByOrganization,
      [input.organizationId]: revisionNumber,
    };
    return revision;
  });
}

export function getCatalogRevision(catalogRevisionId: string): CatalogRevision | null {
  const revision = revisionStore.get(catalogRevisionId);
  return revision ? deepClone(revision) : null;
}

export function listCatalogRevisions(organizationId?: string): readonly CatalogRevision[] {
  return Array.from(revisionStore.values())
    .filter((revision) => !organizationId || revision.organizationId === organizationId)
    .sort((left, right) => left.revisionNumber - right.revisionNumber)
    .map((revision) => deepClone(revision));
}

export function getLatestCatalogRevision(organizationId: string): CatalogRevision | null {
  const revisions = listCatalogRevisions(organizationId);
  return revisions.at(-1) ?? null;
}

export function resetCatalogLineageRepositoryForTests(): void {
  const reset = resetPersistedState<CatalogLineageRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: emptyState,
  });
  applyState(reset.state);
  stateRevision = reset.revision;
}

export function createImportContentHash(payload: CanonicalJsonValue): string {
  return createCanonicalContentHash(payload);
}

function terminalTimestamp(input: { completedAt?: string }): string {
  return input.completedAt ?? nowIso();
}