import { randomUUID } from "node:crypto";
import type { ActorContext, AuditRecord } from "../contracts";

export class AuditService {
  private readonly entries: AuditRecord[] = [];

  append(input: {
    eventType: string;
    actor: ActorContext;
    message: string;
    details?: Record<string, unknown>;
  }): void {
    this.entries.push({
      auditId: `shared_audit_${randomUUID()}`,
      eventType: input.eventType,
      actor: input.actor,
      message: input.message,
      details: input.details,
      recordedAt: new Date().toISOString(),
    });
  }

  list(): AuditRecord[] {
    return this.entries.map((entry) => structuredClone(entry));
  }
}
