import { randomUUID } from "node:crypto";
import { ContactError, type CommunicationEligibility, type ConsentRecord, type ConsentStatus, type ConsentType, type ContactActorContext, type ContactId, type TenantId } from "../contracts";
import type { ContactRegistry } from "./ContactRegistry";
import type { ContactAuditWriter } from "./ContactAuditWriter";

export class ConsentService {
  constructor(
    private readonly registry: ContactRegistry,
    private readonly audit: ContactAuditWriter,
  ) {}

  async captureConsent(input: {
    contactId: ContactId;
    tenantId: TenantId;
    type: ConsentType;
    status: Extract<ConsentStatus, "GRANTED" | "DENIED">;
    jurisdiction?: string;
    captureSource?: string;
    expiresAt?: string;
    evidenceReference?: string;
    actor: ContactActorContext;
  }): Promise<ConsentRecord> {
    let created!: ConsentRecord;

    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "consent captured",
      mutator: (record) => {
        created = {
          consentRecordId: `consent_${randomUUID()}`,
          contactId: input.contactId,
          tenantId: input.tenantId,
          type: input.type,
          status: input.status,
          jurisdiction: input.jurisdiction,
          captureSource: input.captureSource,
          capturedAt: new Date().toISOString(),
          expiresAt: input.expiresAt,
          evidenceReference: input.evidenceReference,
          actor: input.actor,
          version: record.consentHistory.filter((item) => item.type === input.type).length + 1,
        };
        record.consentHistory.push(created);
      },
    });

    await this.audit.append({
      eventType: "CONSENT_CAPTURED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "consent captured",
      details: { type: input.type, status: input.status },
    });

    return structuredClone(created);
  }

  async withdrawConsent(input: {
    contactId: ContactId;
    tenantId: TenantId;
    type: ConsentType;
    actor: ContactActorContext;
    evidenceReference?: string;
  }): Promise<ConsentRecord> {
    const current = this.registry.getContact(input.contactId);
    if (!current) {
      throw new ContactError("CONTACT_INVALID", `contact not found: ${input.contactId}`, false, true, "MEDIUM");
    }

    const latest = [...current.consentHistory]
      .filter((item) => item.type === input.type)
      .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0];

    if (!latest || latest.status !== "GRANTED") {
      throw new ContactError("CONSENT_TRANSITION_INVALID", "cannot withdraw non-granted consent", false, true, "HIGH");
    }

    let withdrawn!: ConsentRecord;
    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "consent withdrawn",
      mutator: (record) => {
        withdrawn = {
          consentRecordId: `consent_${randomUUID()}`,
          contactId: input.contactId,
          tenantId: input.tenantId,
          type: input.type,
          status: "WITHDRAWN",
          capturedAt: new Date().toISOString(),
          withdrawnAt: new Date().toISOString(),
          evidenceReference: input.evidenceReference,
          actor: input.actor,
          version: record.consentHistory.filter((item) => item.type === input.type).length + 1,
        };
        record.consentHistory.push(withdrawn);
      },
    });

    await this.audit.append({
      eventType: "CONSENT_WITHDRAWN",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "consent withdrawn",
      details: { type: input.type },
    });

    return withdrawn;
  }

  async expireConsent(input: {
    contactId: ContactId;
    tenantId: TenantId;
    type: ConsentType;
    actor: ContactActorContext;
    evidenceReference?: string;
  }): Promise<ConsentRecord> {
    const current = this.registry.getContact(input.contactId);
    if (!current) {
      throw new ContactError("CONTACT_INVALID", `contact not found: ${input.contactId}`, false, true, "MEDIUM");
    }

    const latest = [...current.consentHistory]
      .filter((item) => item.type === input.type)
      .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0];

    if (!latest || latest.status !== "GRANTED") {
      throw new ContactError("CONSENT_TRANSITION_INVALID", "cannot expire non-granted consent", false, true, "HIGH");
    }

    let expired!: ConsentRecord;
    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "consent expired",
      mutator: (record) => {
        const now = new Date().toISOString();
        expired = {
          consentRecordId: `consent_${randomUUID()}`,
          contactId: input.contactId,
          tenantId: input.tenantId,
          type: input.type,
          status: "EXPIRED",
          capturedAt: now,
          expiresAt: now,
          evidenceReference: input.evidenceReference,
          actor: input.actor,
          version: record.consentHistory.filter((item) => item.type === input.type).length + 1,
        };
        record.consentHistory.push(expired);
      },
    });

    await this.audit.append({
      eventType: "CONSENT_EXPIRED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "consent expired",
      details: { type: input.type },
    });

    return structuredClone(expired);
  }

  deriveEligibilityFacts(contactId: ContactId, channel: "EMAIL" | "PHONE" | "POSTAL"): CommunicationEligibility {
    const contact = this.registry.getContact(contactId);
    if (!contact) {
      throw new ContactError("CONTACT_INVALID", `contact not found: ${contactId}`, false, true, "MEDIUM");
    }

    const statusBlocked = contact.status === "BLOCKED" || contact.status === "MERGED" || contact.status === "DECEASED";
    const activeMethod = contact.methods.find((item) => {
      if (channel === "EMAIL") {
        return item.type === "EMAIL" && item.email.valid && item.email.verified;
      }
      if (channel === "PHONE") {
        return item.type === "PHONE" && item.phone.valid && item.phone.verified;
      }
      return item.type === "POSTAL" && item.postal.valid;
    });

    const consentRequired = channel === "EMAIL" ? "EMAIL_MARKETING" : channel === "PHONE" ? "PHONE_CONTACT" : "DATA_PROCESSING";
    const latestConsent = [...contact.consentHistory]
      .filter((item) => item.type === consentRequired)
      .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0];

    const consentExpired = Boolean(
      latestConsent?.expiresAt && Number.isFinite(Date.parse(latestConsent.expiresAt)) && Date.parse(latestConsent.expiresAt) <= Date.now(),
    );
    const consentBlocked = !latestConsent || latestConsent.status !== "GRANTED" || consentExpired;
    const pref = [...contact.preferences].sort((left, right) => right.version - left.version)[0];
    const preferenceBlocked = pref?.channelPreferences[channel] === "DISALLOWED";

    return {
      contactId: contact.contactId,
      tenantId: contact.tenantId,
      channel,
      eligible: !statusBlocked && Boolean(activeMethod) && !consentBlocked && !preferenceBlocked,
      blockedByStatus: statusBlocked,
      blockedByMethod: !activeMethod,
      blockedByConsent: consentBlocked,
      blockedByPreference: Boolean(preferenceBlocked),
      reasons: [
        ...(statusBlocked ? ["status_blocked"] : []),
        ...(!activeMethod ? ["missing_valid_method"] : []),
        ...(consentBlocked ? [consentExpired ? "consent_expired" : "consent_missing_or_withdrawn"] : []),
        ...(preferenceBlocked ? ["preference_disallowed"] : []),
      ],
      evaluatedAt: new Date().toISOString(),
    };
  }
}
