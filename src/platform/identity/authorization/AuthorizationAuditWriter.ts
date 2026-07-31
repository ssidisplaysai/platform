import { randomUUID } from "node:crypto";
import type { DeterministicJsonObject, DeterministicJsonValue } from "@/platform/identity/contracts";
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

function toDeterministicJsonValue(value: unknown): DeterministicJsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toDeterministicJsonValue(entry));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toDeterministicJsonValue(entry)]),
    ) as DeterministicJsonObject;
  }

  return String(value);
}

function toDeterministicJsonObject(input: Record<string, unknown>): DeterministicJsonObject {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, toDeterministicJsonValue(value)]),
  ) as DeterministicJsonObject;
}

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
        details: toDeterministicJsonObject(record.details),
      });
    } catch {
      // Preserve runtime decision behavior if audit store is unavailable.
    }
  }
}
