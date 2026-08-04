import { randomUUID } from "node:crypto";
import { DocumentError, type DocumentActorContext, type DocumentApprovalStatus, type DocumentRecord, type TenantId } from "../contracts";
import type { DocumentPlatformDependencies } from "../integration";
import type { PersistenceCoordinator } from "../persistence";
import type { DocumentAuditService } from "./DocumentAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

const allowedTransitions: Record<DocumentApprovalStatus, DocumentApprovalStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["REJECTED"],
  REJECTED: ["PENDING"],
};

export class DocumentApprovalService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: DocumentAuditService,
    private readonly dependencies: DocumentPlatformDependencies,
  ) {}

  async transition(input: {
    tenantId: TenantId;
    documentId: string;
    toStatus: DocumentApprovalStatus;
    actor: DocumentActorContext;
    reason?: string;
  }): Promise<DocumentRecord> {
    await this.persistence.mutate((state) => {
      const document = state.documents.find((item) => item.documentId === input.documentId);
      if (!document) {
        throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
      }
      if (document.tenantId !== input.tenantId) {
        throw new DocumentError("TENANT_MISMATCH", `tenant mismatch for ${input.documentId}`, false, true, "HIGH");
      }

      if (!allowedTransitions[document.approvalStatus].includes(input.toStatus)) {
        throw new DocumentError(
          "APPROVAL_TRANSITION_INVALID",
          `invalid approval transition ${document.approvalStatus} -> ${input.toStatus}`,
          false,
          true,
          "HIGH",
        );
      }

      document.approvalHistory.push({
        approvalId: `document_approval_${randomUUID()}`,
        documentId: input.documentId,
        tenantId: input.tenantId,
        fromStatus: document.approvalStatus,
        toStatus: input.toStatus,
        reason: input.reason,
        actor: input.actor,
        occurredAt: nowIso(),
      });

      document.approvalStatus = input.toStatus;
      document.lifecycleStatus = input.toStatus === "APPROVED" ? "APPROVED" : document.lifecycleStatus;
      document.updatedAt = nowIso();
      document.updatedBy = input.actor.actorId;
    });

    void this.dependencies.workflow.canStartWorkflow({
      tenantId: input.tenantId,
      documentId: input.documentId,
    });

    await this.audit.append({
      eventType: "DOCUMENT_APPROVAL_TRANSITION",
      tenantId: input.tenantId,
      documentId: input.documentId,
      actor: input.actor,
      message: `approval transitioned to ${input.toStatus}`,
      details: { reason: input.reason },
    });

    const updated = this.persistence.getDocument(input.documentId);
    if (!updated) {
      throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
    }
    return updated;
  }
}
