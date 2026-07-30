import { randomUUID } from "node:crypto";
import { getDefaultAuthenticationAuditStore } from "@/platform/identity/persistence";

export type AuthorizationAuditRecord = {
  auditId: string;
  eventType: "AUTHORIZATION_EVALUATED";
  principalId: string;
  workspaceId?: string;
  occurredAt: string;
  outcome: "SUCCESS" | "DENY" | "ERROR";
  details: Record<string, unknown>;
};

export class AuthorizationAuditWriter {
  async write(record: Omit<AuthorizationAuditRecord, "auditId" | "occurredAt">): Promise<void> {
    try {
      await getDefaultAuthenticationAuditStore().publish({
        auditId: randomUUID(),
        eventType: record.eventType,
        principalId: record.principalId,
        workspaceId: record.workspaceId,
        occurredAt: new Date().toISOString(),
        outcome: record.outcome,
        details: record.details,
      });
    } catch {
      // Preserve runtime decision behavior if audit store is unavailable.
    }
  }
}
