import { randomUUID } from "node:crypto";
import type { ProductActorContext } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

function nowIso(): string {
  return new Date().toISOString();
}

export class ProductAuditService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  async append(input: {
    eventType: string;
    tenantId: string;
    actor: ProductActorContext;
    message: string;
    productId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.persistence.appendAudit({
      auditId: `audit_${randomUUID()}`,
      eventType: input.eventType,
      tenantId: input.tenantId,
      productId: input.productId,
      actor: input.actor,
      message: input.message,
      details: input.details,
      recordedAt: nowIso(),
    });
  }
}
