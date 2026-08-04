import { randomUUID } from "node:crypto";
import { ContactError, type ContactActorContext, type ContactId, type MergeRecord, type TenantId } from "../contracts";
import type { ContactRegistry } from "./ContactRegistry";
import type { ContactAuditWriter } from "./ContactAuditWriter";

function methodKey(input: { type: string; value: string }): string {
  return `${input.type}:${input.value}`;
}

export class ContactMergeService {
  private idempotency = new Map<string, MergeRecord>();

  constructor(
    private readonly registry: ContactRegistry,
    private readonly audit: ContactAuditWriter,
  ) {}

  async merge(input: {
    sourceContactId: ContactId;
    targetContactId: ContactId;
    tenantId: TenantId;
    actor: ContactActorContext;
    idempotencyKey: string;
    notes?: string;
  }): Promise<MergeRecord> {
    const existing = this.idempotency.get(input.idempotencyKey);
    if (existing) {
      return structuredClone(existing);
    }

    const source = this.registry.getContact(input.sourceContactId);
    const target = this.registry.getContact(input.targetContactId);
    if (!source || !target) {
      throw new ContactError("MERGE_CONFLICT", "source or target contact not found", false, true, "HIGH");
    }

    if (source.tenantId !== input.tenantId || target.tenantId !== input.tenantId) {
      throw new ContactError("CROSS_TENANT_MERGE", "cross-tenant merge rejected", false, true, "CRITICAL");
    }

    if (source.status === "MERGED") {
      throw new ContactError("MERGE_CONFLICT", "source already merged", false, true, "HIGH");
    }

    const sourceKeys = new Set(
      source.methods.map((item) =>
        item.type === "EMAIL"
          ? methodKey({ type: "EMAIL", value: item.email.normalizedValue })
          : item.type === "PHONE"
            ? methodKey({ type: "PHONE", value: item.phone.normalizedValue })
            : methodKey({ type: "POSTAL", value: item.postal.normalizedValue }),
      ),
    );
    const targetKeys = new Set(
      target.methods.map((item) =>
        item.type === "EMAIL"
          ? methodKey({ type: "EMAIL", value: item.email.normalizedValue })
          : item.type === "PHONE"
            ? methodKey({ type: "PHONE", value: item.phone.normalizedValue })
            : methodKey({ type: "POSTAL", value: item.postal.normalizedValue }),
      ),
    );

    const conflicting = [...sourceKeys].some((key) => targetKeys.has(key));
    if (conflicting) {
      throw new ContactError("MERGE_CONFLICT", "merge conflict on duplicate method keys", false, true, "HIGH");
    }

    const mergeRecord: MergeRecord = {
      mergeRecordId: `merge_${randomUUID()}`,
      sourceContactId: source.contactId,
      targetContactId: target.contactId,
      tenantId: input.tenantId,
      mergedAt: new Date().toISOString(),
      actor: input.actor,
      mergedMethodIds: source.methods.map((item) =>
        item.type === "EMAIL" ? item.email.methodId : item.type === "PHONE" ? item.phone.methodId : item.postal.methodId,
      ),
      preservedConsentRecordIds: source.consentHistory.map((item) => item.consentRecordId),
      notes: input.notes,
    };

    await this.registry.mutateContact({
      contactId: target.contactId,
      tenantId: target.tenantId,
      actor: input.actor,
      changeSummary: "merged data from source contact",
      mutator: (record) => {
        record.methods.push(...source.methods);
        record.affiliations.push(...source.affiliations);
        record.preferences.push(...source.preferences);
        record.consentHistory.push(...source.consentHistory);
        record.identityLinks.push(...source.identityLinks);
        record.mergeHistory.push(mergeRecord);
      },
    });

    await this.registry.mutateContact({
      contactId: source.contactId,
      tenantId: source.tenantId,
      actor: input.actor,
      changeSummary: "source contact marked merged",
      mutator: (record) => {
        record.status = "MERGED";
        record.mergedIntoContactId = target.contactId;
        record.mergeHistory.push(mergeRecord);
      },
    });

    this.idempotency.set(input.idempotencyKey, mergeRecord);

    await this.audit.append({
      eventType: "MERGE_COMPLETED",
      contactId: source.contactId,
      tenantId: source.tenantId,
      actor: input.actor,
      message: "contact merge completed",
      details: {
        sourceContactId: source.contactId,
        targetContactId: target.contactId,
        mergeRecordId: mergeRecord.mergeRecordId,
      },
    });

    return structuredClone(mergeRecord);
  }
}
