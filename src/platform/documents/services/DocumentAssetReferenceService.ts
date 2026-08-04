import { randomUUID } from "node:crypto";
import { DocumentError, type DocumentActorContext, type DocumentAssetReference, type DocumentMetadata, type TenantId } from "../contracts";
import type { DocumentPlatformDependencies } from "../integration";
import type { PersistenceCoordinator } from "../persistence";
import type { DocumentAuditService } from "./DocumentAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

export class DocumentAssetReferenceService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: DocumentAuditService,
    private readonly dependencies: DocumentPlatformDependencies,
  ) {}

  async addReference(input: {
    tenantId: TenantId;
    documentId: string;
    assetId: string;
    role: "PRIMARY_OUTPUT" | "ATTACHMENT" | "SOURCE" | "EVIDENCE";
    metadata?: DocumentMetadata;
    actor: DocumentActorContext;
  }): Promise<DocumentAssetReference> {
    const exists = await this.dependencies.assets.assetExists({
      assetId: input.assetId,
      tenantId: input.tenantId,
    });
    if (!exists) {
      throw new DocumentError("DOCUMENT_INVALID", `asset not found: ${input.assetId}`, false, true, "HIGH");
    }

    const reference: DocumentAssetReference = {
      referenceId: `document_asset_ref_${randomUUID()}`,
      tenantId: input.tenantId,
      documentId: input.documentId,
      assetId: input.assetId,
      role: input.role,
      metadata: structuredClone(input.metadata ?? {}),
      createdAt: nowIso(),
      createdBy: input.actor.actorId,
    };

    await this.persistence.mutate((state) => {
      const document = state.documents.find((item) => item.documentId === input.documentId);
      if (!document) {
        throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
      }
      if (document.tenantId !== input.tenantId) {
        throw new DocumentError("TENANT_MISMATCH", `tenant mismatch for ${input.documentId}`, false, true, "HIGH");
      }

      state.assetReferences.push(reference);
      document.assetReferences.push(reference.referenceId);
      document.updatedAt = nowIso();
      document.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "DOCUMENT_ASSET_REFERENCE_ADDED",
      tenantId: input.tenantId,
      documentId: input.documentId,
      actor: input.actor,
      message: `asset reference added for ${input.assetId}`,
      details: { role: input.role },
    });

    return reference;
  }
}
