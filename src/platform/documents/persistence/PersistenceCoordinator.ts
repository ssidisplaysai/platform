import {
  DocumentError,
  createDefaultDocumentMetrics,
  createDefaultDocumentPersistedState,
  type DocumentAssetReference,
  type DocumentAuditRecord,
  type DocumentMetrics,
  type DocumentPersistedState,
  type DocumentRecord,
  type DocumentRelationship,
  type DocumentTemplate,
  type TenantId,
} from "../contracts";
import type { DocumentStore } from "./types";

function computeMetrics(state: DocumentPersistedState): DocumentMetrics {
  const metrics = structuredClone(state.metrics ?? createDefaultDocumentMetrics());
  metrics.documentsTotal = state.documents.length;
  metrics.draftDocuments = state.documents.filter((item) => item.lifecycleStatus === "DRAFT").length;
  metrics.reviewDocuments = state.documents.filter((item) => item.lifecycleStatus === "IN_REVIEW").length;
  metrics.approvedDocuments = state.documents.filter((item) => item.lifecycleStatus === "APPROVED").length;
  metrics.activeDocuments = state.documents.filter((item) => item.lifecycleStatus === "ACTIVE").length;
  metrics.archivedDocuments = state.documents.filter((item) => item.lifecycleStatus === "ARCHIVED").length;
  metrics.retiredDocuments = state.documents.filter((item) => item.lifecycleStatus === "RETIRED").length;
  metrics.revisionsTotal = state.documents.reduce((count, item) => count + item.revisions.length, 0);
  metrics.templatesTotal = state.templates.length;
  metrics.approvalsTotal = state.documents.reduce((count, item) => count + item.approvalHistory.length, 0);
  metrics.signaturesTotal = state.documents.reduce((count, item) => count + item.signatures.length, 0);
  metrics.activeSignatures = state.documents.reduce(
    (count, item) => count + item.signatures.filter((signature) => !signature.revokedAt).length,
    0,
  );
  metrics.relationshipsTotal = state.relationships.length;
  metrics.assetReferencesTotal = state.assetReferences.length;
  metrics.generatedOutputsTotal = state.assetReferences.filter((item) => item.role === "PRIMARY_OUTPUT").length;
  metrics.auditEvents = state.audits.length;
  return metrics;
}

function validateTemplates(templates: DocumentTemplate[]): void {
  const ids = new Set<string>();
  for (const template of templates) {
    if (!template.templateId || !template.tenantId || !template.name || !template.templateBody) {
      throw new DocumentError("STATE_CORRUPT", `invalid template: ${template.templateId}`, false, true, "CRITICAL");
    }
    if (ids.has(template.templateId)) {
      throw new DocumentError("STATE_CORRUPT", `duplicate template id: ${template.templateId}`, false, true, "CRITICAL");
    }
    ids.add(template.templateId);
  }
}

function validateDocuments(documents: DocumentRecord[]): void {
  const ids = new Set<string>();
  for (const document of documents) {
    if (!document.documentId || !document.tenantId || !document.title || document.revisions.length === 0) {
      throw new DocumentError("STATE_CORRUPT", `invalid document: ${document.documentId}`, false, true, "CRITICAL");
    }
    if (ids.has(document.documentId)) {
      throw new DocumentError("STATE_CORRUPT", `duplicate document id: ${document.documentId}`, false, true, "CRITICAL");
    }
    ids.add(document.documentId);

    const revisionIds = new Set<string>();
    for (const revision of document.revisions) {
      if (!revision.revisionId || revision.revisionNumber <= 0 || revision.documentId !== document.documentId) {
        throw new DocumentError("STATE_CORRUPT", `invalid revision in ${document.documentId}`, false, true, "CRITICAL");
      }
      if (revisionIds.has(revision.revisionId)) {
        throw new DocumentError("STATE_CORRUPT", `duplicate revision id in ${document.documentId}`, false, true, "CRITICAL");
      }
      revisionIds.add(revision.revisionId);
    }

    if (!revisionIds.has(document.currentRevisionId)) {
      throw new DocumentError("STATE_CORRUPT", `current revision missing in ${document.documentId}`, false, true, "CRITICAL");
    }
  }
}

function validateRelationships(relationships: DocumentRelationship[], documents: DocumentRecord[]): void {
  const documentIds = new Set(documents.map((item) => item.documentId));
  for (const relationship of relationships) {
    if (!relationship.relationshipId || !relationship.tenantId) {
      throw new DocumentError("STATE_CORRUPT", `invalid relationship: ${relationship.relationshipId}`, false, true, "CRITICAL");
    }
    if (!documentIds.has(relationship.fromDocumentId) || !documentIds.has(relationship.toDocumentId)) {
      throw new DocumentError("STATE_CORRUPT", `relationship references unknown document: ${relationship.relationshipId}`, false, true, "CRITICAL");
    }
  }
}

function validateAssetReferences(assetReferences: DocumentAssetReference[], documents: DocumentRecord[]): void {
  const documentIds = new Set(documents.map((item) => item.documentId));
  for (const reference of assetReferences) {
    if (!reference.referenceId || !reference.tenantId || !reference.assetId || !reference.documentId) {
      throw new DocumentError("STATE_CORRUPT", `invalid asset reference: ${reference.referenceId}`, false, true, "CRITICAL");
    }
    if (!documentIds.has(reference.documentId)) {
      throw new DocumentError("STATE_CORRUPT", `asset reference points to missing document: ${reference.referenceId}`, false, true, "CRITICAL");
    }
  }
}

function validateStateOrThrow(state: DocumentPersistedState): void {
  if (state.schemaVersion !== "1.0.0") {
    throw new DocumentError("STATE_CORRUPT", "unsupported document state schema", false, true, "CRITICAL");
  }

  validateTemplates(state.templates);
  validateDocuments(state.documents);
  validateRelationships(state.relationships, state.documents);
  validateAssetReferences(state.assetReferences, state.documents);
}

export class PersistenceCoordinator {
  private state: DocumentPersistedState = createDefaultDocumentPersistedState();

  constructor(private readonly store: DocumentStore) {}

  async load(): Promise<void> {
    try {
      this.state = await this.store.load();
      validateStateOrThrow(this.state);
      this.state.metrics = computeMetrics(this.state);
      this.state.metrics.recoveryCount += 1;
      await this.store.save(this.state);
    } catch (error) {
      if (error instanceof DocumentError) {
        if (this.state?.metrics) {
          this.state.metrics.corruptStateCount += 1;
        }
        throw error;
      }
      throw new DocumentError("RECOVERY_FAILURE", "document recovery failed", false, true, "CRITICAL");
    }
  }

  snapshot(): DocumentPersistedState {
    return structuredClone(this.state);
  }

  listDocuments(tenantId?: TenantId): DocumentRecord[] {
    return this.state.documents.filter((item) => (tenantId ? item.tenantId === tenantId : true)).map((item) => structuredClone(item));
  }

  getDocument(documentId: string): DocumentRecord | undefined {
    const found = this.state.documents.find((item) => item.documentId === documentId);
    return found ? structuredClone(found) : undefined;
  }

  listTemplates(tenantId?: TenantId): DocumentTemplate[] {
    return this.state.templates.filter((item) => (tenantId ? item.tenantId === tenantId : true)).map((item) => structuredClone(item));
  }

  listRelationships(tenantId?: TenantId): DocumentRelationship[] {
    return this.state.relationships.filter((item) => (tenantId ? item.tenantId === tenantId : true)).map((item) => structuredClone(item));
  }

  listAssetReferences(tenantId?: TenantId): DocumentAssetReference[] {
    return this.state.assetReferences.filter((item) => (tenantId ? item.tenantId === tenantId : true)).map((item) => structuredClone(item));
  }

  async mutate(mutator: (state: DocumentPersistedState) => void): Promise<void> {
    const next = this.snapshot();
    mutator(next);
    validateStateOrThrow(next);
    next.metrics = computeMetrics(next);

    try {
      await this.store.save(next);
    } catch {
      throw new DocumentError("PERSISTENCE_FAILURE", "document persistence save failed", true, true, "HIGH");
    }

    this.state = next;
  }

  async appendAudit(record: DocumentAuditRecord): Promise<void> {
    await this.mutate((state) => {
      state.audits.push(record);
    });
  }
}
