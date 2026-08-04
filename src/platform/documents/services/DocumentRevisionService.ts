import { randomUUID } from "node:crypto";
import { DocumentError, type DocumentActorContext, type DocumentMetadata, type DocumentRecord, type DocumentStructuredContent, type TenantId } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { DocumentAuditService } from "./DocumentAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

export class DocumentRevisionService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: DocumentAuditService,
  ) {}

  async appendRevision(input: {
    tenantId: TenantId;
    documentId: string;
    actor: DocumentActorContext;
    changeSummary: string;
    content: DocumentStructuredContent;
    metadata?: DocumentMetadata;
  }): Promise<DocumentRecord> {
    await this.persistence.mutate((state) => {
      const document = state.documents.find((item) => item.documentId === input.documentId);
      if (!document) {
        throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
      }
      if (document.tenantId !== input.tenantId) {
        throw new DocumentError("TENANT_MISMATCH", `tenant mismatch for ${input.documentId}`, false, true, "HIGH");
      }

      const revisionId = `document_revision_${randomUUID()}`;
      const revisionNumber = document.revisions.length + 1;
      document.revisions.push({
        revisionId,
        documentId: input.documentId,
        tenantId: input.tenantId,
        revisionNumber,
        changeSummary: input.changeSummary,
        content: structuredClone(input.content),
        metadata: structuredClone(input.metadata ?? document.metadata),
        createdAt: nowIso(),
        createdBy: input.actor.actorId,
      });
      document.currentRevisionId = revisionId;
      document.updatedAt = nowIso();
      document.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "DOCUMENT_REVISION_APPENDED",
      tenantId: input.tenantId,
      documentId: input.documentId,
      actor: input.actor,
      message: `revision appended for ${input.documentId}`,
      details: { changeSummary: input.changeSummary },
    });

    const updated = this.persistence.getDocument(input.documentId);
    if (!updated) {
      throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
    }
    return updated;
  }
}
