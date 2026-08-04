import { randomUUID } from "node:crypto";
import { type ContactActorContext, type ContactClassification, type ContactId, type TenantId } from "../contracts";
import type { ContactRegistry } from "./ContactRegistry";
import type { ContactAuditWriter } from "./ContactAuditWriter";

export class ContactClassificationService {
  constructor(
    private readonly registry: ContactRegistry,
    private readonly audit: ContactAuditWriter,
  ) {}

  async addClassification(input: {
    contactId: ContactId;
    tenantId: TenantId;
    classification: ContactClassification;
    actor: ContactActorContext;
    effectiveFrom?: string;
    effectiveTo?: string;
  }): Promise<void> {
    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "classification added",
      mutator: (record) => {
        const current = record.classifications.filter((item) => item.value === input.classification);
        const version = current.length === 0 ? 1 : Math.max(...current.map((item) => item.version)) + 1;
        record.classifications.push({
          classificationId: `classification_${randomUUID()}`,
          value: input.classification,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          version,
          actor: input.actor,
        });
      },
    });

    await this.audit.append({
      eventType: "CLASSIFICATION_ADDED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "classification added",
      details: { classification: input.classification },
    });
  }
}
