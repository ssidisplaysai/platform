import { randomUUID } from "node:crypto";
import {
  ContactError,
  type ContactActorContext,
  type ContactId,
  type ContactMethod,
  type TenantId,
} from "../contracts";
import type { ContactRegistry } from "./ContactRegistry";
import type { ContactAuditWriter } from "./ContactAuditWriter";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
}

function normalizePostal(input: {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode: string;
}): string {
  return [
    input.line1.trim().toLowerCase(),
    input.line2?.trim().toLowerCase() ?? "",
    input.city.trim().toLowerCase(),
    input.region?.trim().toLowerCase() ?? "",
    input.postalCode?.trim().toLowerCase() ?? "",
    input.countryCode.trim().toUpperCase(),
  ].join("|");
}

function methodKey(method: ContactMethod): string {
  if (method.type === "EMAIL") {
    return `EMAIL:${method.email.normalizedValue}`;
  }
  if (method.type === "PHONE") {
    return `PHONE:${method.phone.normalizedValue}`;
  }
  return `POSTAL:${method.postal.normalizedValue}`;
}

export class ContactMethodService {
  constructor(
    private readonly registry: ContactRegistry,
    private readonly audit: ContactAuditWriter,
  ) {}

  async addMethod(input: {
    contactId: ContactId;
    tenantId: TenantId;
    actor: ContactActorContext;
    method:
      | { type: "EMAIL"; value: string; label?: string; primary?: boolean; verified?: boolean; valid?: boolean; effectiveFrom?: string; effectiveTo?: string }
      | { type: "PHONE"; value: string; label?: string; primary?: boolean; verified?: boolean; valid?: boolean; effectiveFrom?: string; effectiveTo?: string }
      | { type: "POSTAL"; line1: string; line2?: string; city: string; region?: string; postalCode?: string; countryCode: string; label?: string; primary?: boolean; valid?: boolean; effectiveFrom?: string; effectiveTo?: string };
  }): Promise<ContactMethod> {
    const existing = this.registry.getContact(input.contactId);
    if (!existing) {
      throw new ContactError("CONTACT_INVALID", `contact not found: ${input.contactId}`, false, true, "MEDIUM");
    }

    const method: ContactMethod = input.method.type === "EMAIL"
      ? {
          type: "EMAIL",
          email: {
            methodId: `method_${randomUUID()}`,
            value: input.method.value,
            normalizedValue: normalizeEmail(input.method.value),
            label: input.method.label,
            primary: Boolean(input.method.primary),
            verified: Boolean(input.method.verified),
            valid: input.method.valid ?? true,
            effectiveFrom: input.method.effectiveFrom,
            effectiveTo: input.method.effectiveTo,
            consentRecordIds: [],
          },
        }
      : input.method.type === "PHONE"
        ? {
            type: "PHONE",
            phone: {
              methodId: `method_${randomUUID()}`,
              value: input.method.value,
              normalizedValue: normalizePhone(input.method.value),
              label: input.method.label,
              primary: Boolean(input.method.primary),
              verified: Boolean(input.method.verified),
              valid: input.method.valid ?? true,
              effectiveFrom: input.method.effectiveFrom,
              effectiveTo: input.method.effectiveTo,
              consentRecordIds: [],
            },
          }
        : {
            type: "POSTAL",
            postal: {
              methodId: `method_${randomUUID()}`,
              line1: input.method.line1,
              line2: input.method.line2,
              city: input.method.city,
              region: input.method.region,
              postalCode: input.method.postalCode,
              countryCode: input.method.countryCode,
              normalizedValue: normalizePostal(input.method),
              label: input.method.label,
              primary: Boolean(input.method.primary),
              valid: input.method.valid ?? true,
              effectiveFrom: input.method.effectiveFrom,
              effectiveTo: input.method.effectiveTo,
            },
          };

    const newKey = methodKey(method);
    if (existing.methods.some((item) => methodKey(item) === newKey)) {
      throw new ContactError("CONTACT_METHOD_DUPLICATE", `duplicate method for ${input.contactId}`, false, true, "HIGH");
    }

    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "contact method added",
      mutator: (contact) => {
        if (method.type === "EMAIL" && method.email.primary) {
          contact.methods = contact.methods.map((item) =>
            item.type === "EMAIL" ? { ...item, email: { ...item.email, primary: false } } : item,
          );
        }
        if (method.type === "PHONE" && method.phone.primary) {
          contact.methods = contact.methods.map((item) =>
            item.type === "PHONE" ? { ...item, phone: { ...item.phone, primary: false } } : item,
          );
        }
        if (method.type === "POSTAL" && method.postal.primary) {
          contact.methods = contact.methods.map((item) =>
            item.type === "POSTAL" ? { ...item, postal: { ...item.postal, primary: false } } : item,
          );
        }
        contact.methods.push(method);
      },
    });

    await this.audit.append({
      eventType: "METHOD_ADDED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "contact method added",
      details: { methodType: method.type },
    });

    return structuredClone(method);
  }

  async setPrimaryMethod(input: {
    contactId: ContactId;
    tenantId: TenantId;
    methodId: string;
    actor: ContactActorContext;
  }): Promise<void> {
    let methodType: ContactMethod["type"] | null = null;
    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "contact method primary flag updated",
      mutator: (contact) => {
        const target = contact.methods.find((item) =>
          item.type === "EMAIL"
            ? item.email.methodId === input.methodId
            : item.type === "PHONE"
              ? item.phone.methodId === input.methodId
              : item.postal.methodId === input.methodId,
        );
        if (!target) {
          throw new ContactError("CONTACT_INVALID", `method not found: ${input.methodId}`, false, true, "MEDIUM");
        }

        methodType = target.type;
        contact.methods = contact.methods.map((item) => {
          if (item.type !== target.type) {
            return item;
          }

          if (item.type === "EMAIL") {
            return { ...item, email: { ...item.email, primary: item.email.methodId === input.methodId } };
          }
          if (item.type === "PHONE") {
            return { ...item, phone: { ...item.phone, primary: item.phone.methodId === input.methodId } };
          }
          return { ...item, postal: { ...item.postal, primary: item.postal.methodId === input.methodId } };
        });
      },
    });

    await this.audit.append({
      eventType: "METHOD_PRIMARY_UPDATED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "contact method primary flag updated",
      details: { methodId: input.methodId, methodType },
    });
  }

  async setVerification(input: {
    contactId: ContactId;
    tenantId: TenantId;
    methodId: string;
    verified: boolean;
    actor: ContactActorContext;
  }): Promise<void> {
    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "contact method verification state updated",
      mutator: (contact) => {
        const index = contact.methods.findIndex((item) =>
          item.type === "EMAIL"
            ? item.email.methodId === input.methodId
            : item.type === "PHONE"
              ? item.phone.methodId === input.methodId
              : false,
        );
        if (index < 0) {
          throw new ContactError("CONTACT_INVALID", `verifiable method not found: ${input.methodId}`, false, true, "MEDIUM");
        }

        const target = contact.methods[index];
        if (target.type === "EMAIL") {
          contact.methods[index] = { ...target, email: { ...target.email, verified: input.verified } };
          return;
        }
        if (target.type === "PHONE") {
          contact.methods[index] = { ...target, phone: { ...target.phone, verified: input.verified } };
          return;
        }
        throw new ContactError("CONTACT_INVALID", "postal methods do not support verification state", false, true, "LOW");
      },
    });

    await this.audit.append({
      eventType: "METHOD_VERIFICATION_UPDATED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "contact method verification state updated",
      details: { methodId: input.methodId, verified: input.verified },
    });
  }

  async setValidity(input: {
    contactId: ContactId;
    tenantId: TenantId;
    methodId: string;
    valid: boolean;
    actor: ContactActorContext;
  }): Promise<void> {
    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "contact method validity updated",
      mutator: (contact) => {
        const index = contact.methods.findIndex((item) =>
          item.type === "EMAIL"
            ? item.email.methodId === input.methodId
            : item.type === "PHONE"
              ? item.phone.methodId === input.methodId
              : item.postal.methodId === input.methodId,
        );
        if (index < 0) {
          throw new ContactError("CONTACT_INVALID", `method not found: ${input.methodId}`, false, true, "MEDIUM");
        }

        const target = contact.methods[index];
        if (target.type === "EMAIL") {
          contact.methods[index] = { ...target, email: { ...target.email, valid: input.valid } };
          return;
        }
        if (target.type === "PHONE") {
          contact.methods[index] = { ...target, phone: { ...target.phone, valid: input.valid } };
          return;
        }
        contact.methods[index] = { ...target, postal: { ...target.postal, valid: input.valid } };
      },
    });

    await this.audit.append({
      eventType: "METHOD_VALIDITY_UPDATED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "contact method validity updated",
      details: { methodId: input.methodId, valid: input.valid },
    });
  }

  async attachConsentReference(input: {
    contactId: ContactId;
    tenantId: TenantId;
    methodId: string;
    consentRecordId: string;
    actor: ContactActorContext;
  }): Promise<void> {
    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "method consent reference attached",
      mutator: (contact) => {
        const target = contact.methods.find((item) =>
          item.type === "EMAIL"
            ? item.email.methodId === input.methodId
            : item.type === "PHONE"
              ? item.phone.methodId === input.methodId
              : false,
        );
        if (!target) {
          throw new ContactError("CONTACT_INVALID", `consent-compatible method not found: ${input.methodId}`, false, true, "MEDIUM");
        }

        const consentFound = contact.consentHistory.some((item) => item.consentRecordId === input.consentRecordId);
        if (!consentFound) {
          throw new ContactError("CONSENT_TRANSITION_INVALID", `consent record not found: ${input.consentRecordId}`, false, true, "MEDIUM");
        }

        if (target.type === "EMAIL") {
          if (!target.email.consentRecordIds.includes(input.consentRecordId)) {
            target.email.consentRecordIds.push(input.consentRecordId);
          }
          return;
        }

        if (target.type === "PHONE") {
          if (!target.phone.consentRecordIds.includes(input.consentRecordId)) {
            target.phone.consentRecordIds.push(input.consentRecordId);
          }
          return;
        }

        throw new ContactError("CONTACT_INVALID", "postal methods do not support consent references", false, true, "LOW");
      },
    });

    await this.audit.append({
      eventType: "METHOD_CONSENT_LINKED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "method consent reference attached",
      details: { methodId: input.methodId, consentRecordId: input.consentRecordId },
    });
  }
}
