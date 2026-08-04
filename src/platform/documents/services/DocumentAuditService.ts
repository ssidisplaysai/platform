import { randomUUID } from "node:crypto";
import type { DocumentActorContext } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

function nowIso(): string {
  return new Date().toISOString();
}

export class DocumentAuditService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  async append(input: {
    eventType: string;
    tenantId: string;
    documentId?: string;
    actor: DocumentActorContext;
    message: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.persistence.appendAudit({
      auditId: `document_audit_${randomUUID()}`,
      eventType: input.eventType,
      tenantId: input.tenantId,
      documentId: input.documentId,
      actor: input.actor,
      message: input.message,
      details: input.details,
      recordedAt: nowIso(),
    });
  }
}
