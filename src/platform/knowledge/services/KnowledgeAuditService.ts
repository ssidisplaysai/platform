import { randomUUID } from "node:crypto";
import type { KnowledgeActorContext } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

function nowIso(): string {
  return new Date().toISOString();
}

export class KnowledgeAuditService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  async append(input: {
    eventType: string;
    tenantId: string;
    knowledgeId?: string;
    actor: KnowledgeActorContext;
    message: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.persistence.appendAudit({
      auditId: `knowledge_audit_${randomUUID()}`,
      eventType: input.eventType,
      tenantId: input.tenantId,
      knowledgeId: input.knowledgeId,
      actor: input.actor,
      message: input.message,
      details: input.details,
      recordedAt: nowIso(),
    });
  }
}
