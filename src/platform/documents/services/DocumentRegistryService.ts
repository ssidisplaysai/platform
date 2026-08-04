import { randomUUID } from "node:crypto";
import {
  DocumentError,
  type DocumentActorContext,
  type DocumentLifecycleStatus,
  type DocumentMetadata,
  type DocumentRecord,
  type DocumentStructuredContent,
  type DocumentType,
  type TenantId,
} from "../contracts";
import type { DocumentPlatformDependencies } from "../integration";
import type { PersistenceCoordinator } from "../persistence";
import type { DocumentAuditService } from "./DocumentAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export class DocumentRegistryService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: DocumentAuditService,
    private readonly dependencies: DocumentPlatformDependencies,
  ) {}

  listDocuments(tenantId?: TenantId): DocumentRecord[] {
    return this.persistence.listDocuments(tenantId);
  }

  getDocument(documentId: string): DocumentRecord | undefined {
    return this.persistence.getDocument(documentId);
  }

  async registerDocument(input: {
    tenantId: TenantId;
    type: DocumentType;
    title: string;
    actor: DocumentActorContext;
    ownerOrganizationId?: string;
    ownerContactId?: string;
    metadata?: DocumentMetadata;
    initialContent: DocumentStructuredContent;
    lifecycleStatus?: DocumentLifecycleStatus;
  }): Promise<DocumentRecord> {
    if (!input.tenantId || !input.title) {
      throw new DocumentError("DOCUMENT_INVALID", "missing required document registration fields", false, true, "HIGH");
    }

    if (input.ownerOrganizationId) {
      const exists = await this.dependencies.organization.organizationExists({
        organizationId: input.ownerOrganizationId,
        tenantId: input.tenantId,
      });
      if (!exists) {
        throw new DocumentError("DOCUMENT_INVALID", "owner organization not found", false, true, "HIGH");
      }
    }

    if (input.ownerContactId) {
      const exists = await this.dependencies.contacts.contactExists({
        contactId: input.ownerContactId,
        tenantId: input.tenantId,
      });
      if (!exists) {
        throw new DocumentError("DOCUMENT_INVALID", "owner contact not found", false, true, "HIGH");
      }
    }

    const at = nowIso();
    const documentId = `document_${randomUUID()}`;
    const revisionId = `document_revision_${randomUUID()}`;
    const document: DocumentRecord = {
      documentId,
      tenantId: input.tenantId,
      type: input.type,
      title: normalizeText(input.title),
      ownerOrganizationId: input.ownerOrganizationId,
      ownerContactId: input.ownerContactId,
      lifecycleStatus: input.lifecycleStatus ?? "DRAFT",
      approvalStatus: "PENDING",
      metadata: structuredClone(input.metadata ?? {}),
      currentRevisionId: revisionId,
      revisions: [{
        revisionId,
        documentId,
        tenantId: input.tenantId,
        revisionNumber: 1,
        changeSummary: "initial revision",
        content: structuredClone(input.initialContent),
        metadata: structuredClone(input.metadata ?? {}),
        createdAt: at,
        createdBy: input.actor.actorId,
      }],
      approvalHistory: [],
      signatures: [],
      relationships: [],
      assetReferences: [],
      createdAt: at,
      createdBy: input.actor.actorId,
      updatedAt: at,
      updatedBy: input.actor.actorId,
    };

    await this.persistence.mutate((state) => {
      if (state.documents.some((item) => item.documentId === documentId)) {
        throw new DocumentError("DOCUMENT_DUPLICATE", `duplicate document id: ${documentId}`, false, true, "HIGH");
      }
      state.documents.push(document);
    });

    await this.audit.append({
      eventType: "DOCUMENT_REGISTERED",
      tenantId: input.tenantId,
      documentId,
      actor: input.actor,
      message: `document ${documentId} registered`,
      details: { type: input.type },
    });

    return this.requireDocument(documentId);
  }

  async updateMetadata(input: {
    tenantId: TenantId;
    documentId: string;
    metadata: DocumentMetadata;
    actor: DocumentActorContext;
  }): Promise<DocumentRecord> {
    await this.persistence.mutate((state) => {
      const document = state.documents.find((item) => item.documentId === input.documentId);
      if (!document) {
        throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
      }
      if (document.tenantId !== input.tenantId) {
        throw new DocumentError("TENANT_MISMATCH", `tenant mismatch for ${input.documentId}`, false, true, "HIGH");
      }

      document.metadata = structuredClone(input.metadata);
      document.updatedAt = nowIso();
      document.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "DOCUMENT_METADATA_UPDATED",
      tenantId: input.tenantId,
      documentId: input.documentId,
      actor: input.actor,
      message: `metadata updated for ${input.documentId}`,
    });

    return this.requireDocument(input.documentId);
  }

  async setLifecycleStatus(input: {
    tenantId: TenantId;
    documentId: string;
    status: DocumentLifecycleStatus;
    actor: DocumentActorContext;
  }): Promise<DocumentRecord> {
    await this.persistence.mutate((state) => {
      const document = state.documents.find((item) => item.documentId === input.documentId);
      if (!document) {
        throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
      }
      if (document.tenantId !== input.tenantId) {
        throw new DocumentError("TENANT_MISMATCH", `tenant mismatch for ${input.documentId}`, false, true, "HIGH");
      }

      const allowedTransitions: Record<DocumentLifecycleStatus, DocumentLifecycleStatus[]> = {
        DRAFT: ["IN_REVIEW", "ARCHIVED"],
        IN_REVIEW: ["APPROVED", "DRAFT", "ARCHIVED"],
        APPROVED: ["ACTIVE", "ARCHIVED"],
        ACTIVE: ["ARCHIVED", "RETIRED"],
        ARCHIVED: ["ACTIVE", "RETIRED"],
        RETIRED: [],
      };

      if (!allowedTransitions[document.lifecycleStatus].includes(input.status)) {
        throw new DocumentError("LIFECYCLE_TRANSITION_INVALID", `invalid lifecycle transition ${document.lifecycleStatus} -> ${input.status}`, false, true, "HIGH");
      }

      document.lifecycleStatus = input.status;
      document.updatedAt = nowIso();
      document.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "DOCUMENT_LIFECYCLE_UPDATED",
      tenantId: input.tenantId,
      documentId: input.documentId,
      actor: input.actor,
      message: `lifecycle status set to ${input.status}`,
    });

    return this.requireDocument(input.documentId);
  }

  private requireDocument(documentId: string): DocumentRecord {
    const found = this.persistence.getDocument(documentId);
    if (!found) {
      throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${documentId}`, false, true, "MEDIUM");
    }
    return found;
  }
}
