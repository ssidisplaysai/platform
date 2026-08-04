import { ContactError, type ContactActorContext, type ContactId, type ContactStatus, type TenantId } from "../contracts";
import type { ContactRegistry } from "./ContactRegistry";
import type { ContactAuditWriter } from "./ContactAuditWriter";

const transitions: Record<ContactStatus, ContactStatus[]> = {
  ACTIVE: ["INACTIVE", "ARCHIVED", "BLOCKED", "DECEASED", "MERGED"],
  INACTIVE: ["ACTIVE", "ARCHIVED", "BLOCKED", "DECEASED", "MERGED"],
  ARCHIVED: ["ACTIVE", "INACTIVE", "BLOCKED"],
  MERGED: [],
  DECEASED: ["ARCHIVED"],
  BLOCKED: ["ACTIVE", "INACTIVE", "ARCHIVED"],
};

export class ContactLifecycleService {
  constructor(
    private readonly registry: ContactRegistry,
    private readonly audit: ContactAuditWriter,
  ) {}

  async transition(input: {
    contactId: ContactId;
    tenantId: TenantId;
    to: ContactStatus;
    actor: ContactActorContext;
    mergeTargetContactId?: ContactId;
    reason?: string;
  }) {
    const current = this.registry.getContact(input.contactId);
    if (!current) {
      throw new ContactError("CONTACT_INVALID", `contact not found: ${input.contactId}`, false, true, "MEDIUM");
    }

    if (!transitions[current.status].includes(input.to)) {
      throw new ContactError("LIFECYCLE_TRANSITION_INVALID", `invalid lifecycle transition ${current.status} -> ${input.to}`, false, true, "HIGH");
    }

    if (input.to === "MERGED" && !input.mergeTargetContactId) {
      throw new ContactError("MERGE_CONFLICT", "merge target required for MERGED state", false, true, "HIGH");
    }

    if (input.to === "MERGED" && input.mergeTargetContactId) {
      const target = this.registry.getContact(input.mergeTargetContactId);
      if (!target) {
        throw new ContactError("MERGE_CONFLICT", `merge target not found: ${input.mergeTargetContactId}`, false, true, "HIGH");
      }
      if (target.tenantId !== input.tenantId) {
        throw new ContactError("CROSS_TENANT_MERGE", "cross-tenant merge target rejected", false, true, "CRITICAL");
      }
    }

    const updated = await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: `status changed to ${input.to}`,
      mutator: (record) => {
        record.status = input.to;
        if (input.to === "MERGED") {
          record.mergedIntoContactId = input.mergeTargetContactId;
        }
      },
    });

    await this.audit.append({
      eventType: input.to === "INACTIVE" ? "CONTACT_DEACTIVATED" : input.to === "ACTIVE" ? "CONTACT_REACTIVATED" : "CONTACT_UPDATED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: `lifecycle transition to ${input.to}`,
      details: { from: current.status, to: input.to, reason: input.reason, mergeTargetContactId: input.mergeTargetContactId },
    });

    return updated;
  }
}
