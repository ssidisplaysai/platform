import { randomUUID } from "node:crypto";
import type { ContactActorContext, ContactId, ContactPreference, TenantId } from "../contracts";
import type { ContactRegistry } from "./ContactRegistry";
import type { ContactAuditWriter } from "./ContactAuditWriter";

export class ContactPreferenceService {
  constructor(
    private readonly registry: ContactRegistry,
    private readonly audit: ContactAuditWriter,
  ) {}

  async setPreference(input: {
    contactId: ContactId;
    tenantId: TenantId;
    actor: ContactActorContext;
    preferredLanguage?: string;
    preferredTimeZone?: string;
    preferredContactMethodType?: "EMAIL" | "PHONE" | "POSTAL";
    channelPreferences: Partial<Record<"EMAIL" | "PHONE" | "POSTAL", "PREFERRED" | "ALLOWED" | "DISALLOWED">>;
    communicationFrequency?: "LOW" | "NORMAL" | "HIGH";
    quietHoursReference?: string;
    accessibilityPreferences?: string[];
  }): Promise<ContactPreference> {
    const at = new Date().toISOString();
    let created!: ContactPreference;

    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "preference changed",
      mutator: (record) => {
        const version = record.preferences.length === 0 ? 1 : Math.max(...record.preferences.map((item) => item.version)) + 1;
        created = {
          preferenceId: `preference_${randomUUID()}`,
          contactId: input.contactId,
          tenantId: input.tenantId,
          preferredLanguage: input.preferredLanguage,
          preferredTimeZone: input.preferredTimeZone,
          preferredContactMethodType: input.preferredContactMethodType,
          channelPreferences: input.channelPreferences,
          communicationFrequency: input.communicationFrequency,
          quietHoursReference: input.quietHoursReference,
          accessibilityPreferences: input.accessibilityPreferences,
          effectiveFrom: at,
          version,
        };
        record.preferences.push(created);
      },
    });

    await this.audit.append({
      eventType: "PREFERENCE_CHANGED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "contact preference changed",
    });

    return structuredClone(created);
  }
}
