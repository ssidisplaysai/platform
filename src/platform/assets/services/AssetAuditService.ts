import { randomUUID } from "node:crypto";
import type { AssetActorContext } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

function nowIso(): string {
  return new Date().toISOString();
}

export class AssetAuditService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  async append(input: {
    eventType: string;
    tenantId: string;
    assetId?: string;
    actor: AssetActorContext;
    message: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.persistence.appendAudit({
      auditId: `asset_audit_${randomUUID()}`,
      eventType: input.eventType,
      tenantId: input.tenantId,
      assetId: input.assetId,
      actor: input.actor,
      message: input.message,
      details: input.details,
      recordedAt: nowIso(),
    });
  }
}
