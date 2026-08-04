import { randomUUID } from "node:crypto";
import { DocumentError, type DocumentActorContext, type DocumentRelationship, type TenantId } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { DocumentAuditService } from "./DocumentAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

export class DocumentRelationshipService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: DocumentAuditService,
  ) {}

  async link(input: {
    tenantId: TenantId;
    fromDocumentId: string;
    toDocumentId: string;
    relationshipType: "REFERENCES" | "DERIVED_FROM" | "SUPERCEDES" | "SUPPORTS";
    actor: DocumentActorContext;
  }): Promise<DocumentRelationship> {
    if (input.fromDocumentId === input.toDocumentId) {
      throw new DocumentError("DOCUMENT_INVALID", "self-document relationship is not allowed", false, true, "MEDIUM");
    }

    const relationship: DocumentRelationship = {
      relationshipId: `document_relationship_${randomUUID()}`,
      tenantId: input.tenantId,
      fromDocumentId: input.fromDocumentId,
      toDocumentId: input.toDocumentId,
      relationshipType: input.relationshipType,
      createdAt: nowIso(),
      createdBy: input.actor.actorId,
    };

    await this.persistence.mutate((state) => {
      const from = state.documents.find((item) => item.documentId === input.fromDocumentId);
      const to = state.documents.find((item) => item.documentId === input.toDocumentId);
      if (!from || !to) {
        throw new DocumentError("DOCUMENT_NOT_FOUND", "relationship documents not found", false, true, "MEDIUM");
      }
      if (from.tenantId !== input.tenantId || to.tenantId !== input.tenantId) {
        throw new DocumentError("TENANT_MISMATCH", "relationship tenant mismatch", false, true, "HIGH");
      }

      state.relationships.push(relationship);
      from.relationships.push(relationship.relationshipId);
      to.relationships.push(relationship.relationshipId);
      from.updatedAt = nowIso();
      to.updatedAt = nowIso();
      from.updatedBy = input.actor.actorId;
      to.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "DOCUMENT_RELATIONSHIP_CREATED",
      tenantId: input.tenantId,
      documentId: input.fromDocumentId,
      actor: input.actor,
      message: `relationship ${relationship.relationshipId} created`,
      details: { toDocumentId: input.toDocumentId, relationshipType: input.relationshipType },
    });

    return relationship;
  }
}
