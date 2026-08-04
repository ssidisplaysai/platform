import { randomUUID } from "node:crypto";
import { DocumentError, type DocumentActorContext, type DocumentRecord, type TenantId } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { DocumentAuditService } from "./DocumentAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

export class DocumentSignatureService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: DocumentAuditService,
  ) {}

  async sign(input: {
    tenantId: TenantId;
    documentId: string;
    signerActorId: string;
    signerName: string;
    signatureType: "APPROVAL" | "ATTESTATION" | "ACKNOWLEDGEMENT";
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

      document.signatures.push({
        signatureId: `document_signature_${randomUUID()}`,
        documentId: input.documentId,
        tenantId: input.tenantId,
        signerActorId: input.signerActorId,
        signerName: input.signerName,
        signatureType: input.signatureType,
        signedAt: nowIso(),
      });
      document.updatedAt = nowIso();
      document.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "DOCUMENT_SIGNED",
      tenantId: input.tenantId,
      documentId: input.documentId,
      actor: input.actor,
      message: `document signed by ${input.signerActorId}`,
    });

    const updated = this.persistence.getDocument(input.documentId);
    if (!updated) {
      throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
    }
    return updated;
  }

  async revoke(input: {
    tenantId: TenantId;
    documentId: string;
    signatureId: string;
    actor: DocumentActorContext;
    reason: string;
  }): Promise<DocumentRecord> {
    await this.persistence.mutate((state) => {
      const document = state.documents.find((item) => item.documentId === input.documentId);
      if (!document) {
        throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
      }
      if (document.tenantId !== input.tenantId) {
        throw new DocumentError("TENANT_MISMATCH", `tenant mismatch for ${input.documentId}`, false, true, "HIGH");
      }

      const signature = document.signatures.find((item) => item.signatureId === input.signatureId);
      if (!signature) {
        throw new DocumentError("SIGNATURE_INVALID", `signature not found: ${input.signatureId}`, false, true, "MEDIUM");
      }
      if (signature.revokedAt) {
        throw new DocumentError("SIGNATURE_INVALID", `signature already revoked: ${input.signatureId}`, false, true, "MEDIUM");
      }

      signature.revokedAt = nowIso();
      signature.revokedBy = input.actor.actorId;
      signature.revocationReason = input.reason;
      document.updatedAt = nowIso();
      document.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "DOCUMENT_SIGNATURE_REVOKED",
      tenantId: input.tenantId,
      documentId: input.documentId,
      actor: input.actor,
      message: `signature ${input.signatureId} revoked`,
      details: { reason: input.reason },
    });

    const updated = this.persistence.getDocument(input.documentId);
    if (!updated) {
      throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
    }
    return updated;
  }
}
