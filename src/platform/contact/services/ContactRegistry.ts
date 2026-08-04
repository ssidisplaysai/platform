import { randomUUID } from "node:crypto";
import {
  ContactError,
  type Contact,
  type ContactActorContext,
  type ContactClassification,
  type ContactId,
  type ContactMetadata,
  type ContactPlatformDependencies,
  type ContactSettings,
  type ContactStatus,
  type ContactType,
  type PersonName,
  type TenantId,
} from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { ContactAuditWriter } from "./ContactAuditWriter";
import type { ContactMetricsService } from "./ContactMetricsService";

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeName(input: {
  legalGivenName: string;
  legalFamilyName: string;
  legalMiddleName?: string;
  preferredGivenName?: string;
  preferredFamilyName?: string;
}): PersonName {
  const legalGivenName = normalizeText(input.legalGivenName);
  const legalFamilyName = normalizeText(input.legalFamilyName);
  const legalMiddleName = input.legalMiddleName ? normalizeText(input.legalMiddleName) : undefined;
  const preferredGivenName = input.preferredGivenName ? normalizeText(input.preferredGivenName) : undefined;
  const preferredFamilyName = input.preferredFamilyName ? normalizeText(input.preferredFamilyName) : undefined;

  const displayName = [preferredGivenName ?? legalGivenName, preferredFamilyName ?? legalFamilyName]
    .filter(Boolean)
    .join(" ");

  const normalizedFullName = [legalGivenName, legalMiddleName, legalFamilyName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    legalGivenName,
    legalFamilyName,
    legalMiddleName,
    preferredGivenName,
    preferredFamilyName,
    displayName,
    normalizedFullName,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

export type RegisterContactInput = {
  contactId?: ContactId;
  tenantId: TenantId;
  organizationId: string;
  type: ContactType;
  name: {
    legalGivenName: string;
    legalFamilyName: string;
    legalMiddleName?: string;
    preferredGivenName?: string;
    preferredFamilyName?: string;
  };
  classifications?: ContactClassification[];
  metadata?: ContactMetadata;
  settings?: ContactSettings;
  actor: ContactActorContext;
};

export class ContactRegistry {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: ContactAuditWriter,
    private readonly metrics: ContactMetricsService,
    private readonly dependencies: ContactPlatformDependencies,
  ) {}

  async initialize(): Promise<void> {
    await this.persistence.load();
    const snapshot = this.persistence.snapshot();

    // Fail closed during recovery if durable state references invalid tenant or organization boundaries.
    for (const contact of snapshot.contacts) {
      if (!contact.tenantId || !contact.organizationId) {
        throw new ContactError("STATE_CORRUPT", `invalid tenant or organization reference for ${contact.contactId}`, false, true, "CRITICAL");
      }

      const organizationExists = await this.dependencies.organization.organizationExists({
        organizationId: contact.organizationId,
        tenantId: contact.tenantId,
      });
      if (!organizationExists) {
        throw new ContactError("ORGANIZATION_REFERENCE_INVALID", `invalid organization reference for ${contact.contactId}`, false, true, "CRITICAL");
      }
    }

    this.audit.replace(snapshot.audits);
    this.metrics.replace(snapshot.metrics);
    this.metrics.recalculate(snapshot.contacts, snapshot.duplicateBacklog.length);
  }

  listContacts(tenantId?: TenantId): Contact[] {
    if (!tenantId) {
      return this.persistence.listContacts();
    }
    return this.persistence.tenantContacts(tenantId);
  }

  getContact(contactId: ContactId): Contact | undefined {
    const found = this.persistence.getContact(contactId);
    return found ? structuredClone(found) : undefined;
  }

  async registerContact(input: RegisterContactInput): Promise<Contact> {
    if (!input.tenantId || !input.organizationId || !input.name.legalGivenName || !input.name.legalFamilyName) {
      throw new ContactError("CONTACT_INVALID", "missing required contact fields", false, true, "HIGH");
    }

    const auth = await this.dependencies.authorization.authorize({
      actorId: input.actor.actorId,
      action: "contact:register",
      tenantId: input.tenantId,
    });
    if (!auth.allowed) {
      throw new ContactError("TENANT_INVALID", auth.reason ?? "authorization rejected", false, true, "HIGH");
    }

    const organizationExists = await this.dependencies.organization.organizationExists({
      organizationId: input.organizationId,
      tenantId: input.tenantId,
    });
    if (!organizationExists) {
      throw new ContactError("ORGANIZATION_REFERENCE_INVALID", "organization reference invalid", false, true, "HIGH");
    }

    const contactId = input.contactId ?? `contact_${randomUUID()}`;
    if (this.persistence.getContact(contactId)) {
      throw new ContactError("CONTACT_DUPLICATE_ID", `duplicate contact id: ${contactId}`, false, true, "HIGH");
    }

    const at = nowIso();
    const contact: Contact = {
      contactId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      type: input.type,
      status: "ACTIVE",
      personName: normalizeName(input.name),
      classifications: (input.classifications ?? []).map((value) => ({
        classificationId: `classification_${randomUUID()}`,
        value,
        version: 1,
        actor: input.actor,
      })),
      methods: [],
      affiliations: [],
      preferences: [],
      consentHistory: [],
      identityLinks: [],
      mergeHistory: [],
      metadata: structuredClone(input.metadata ?? {}),
      settings: structuredClone(input.settings ?? {}),
      createdAt: at,
      createdBy: input.actor.actorId,
      updatedAt: at,
      updatedBy: input.actor.actorId,
      version: 1,
      versionHistory: [{ version: 1, changedAt: at, actorId: input.actor.actorId, changeSummary: "registered" }],
    };

    await this.persistence.mutate((state) => {
      if (state.contacts.some((item) => item.contactId === contact.contactId)) {
        throw new ContactError("CONTACT_DUPLICATE_ID", `duplicate contact id: ${contact.contactId}`, false, true, "HIGH");
      }
      state.contacts.push(contact);
    });

    const snapshot = this.persistence.snapshot();
    this.metrics.replace(snapshot.metrics);

    await this.audit.append({
      eventType: "CONTACT_CREATED",
      contactId: contact.contactId,
      tenantId: contact.tenantId,
      actor: input.actor,
      message: `contact ${contact.contactId} created`,
      details: { organizationId: contact.organizationId, classifications: input.classifications ?? [] },
    });

    return structuredClone(contact);
  }

  async updateContact(input: {
    contactId: ContactId;
    tenantId: TenantId;
    actor: ContactActorContext;
    metadata?: ContactMetadata;
    settings?: ContactSettings;
    status?: ContactStatus;
  }): Promise<Contact> {
    let updated: Contact | undefined;

    await this.persistence.mutate((state) => {
      const contact = state.contacts.find((item) => item.contactId === input.contactId);
      if (!contact) {
        throw new ContactError("CONTACT_INVALID", `contact not found: ${input.contactId}`, false, true, "MEDIUM");
      }
      if (contact.tenantId !== input.tenantId) {
        throw new ContactError("TENANT_INVALID", `tenant mismatch for ${input.contactId}`, false, true, "HIGH");
      }

      if (input.metadata) {
        contact.metadata = structuredClone(input.metadata);
      }
      if (input.settings) {
        contact.settings = structuredClone(input.settings);
      }
      if (input.status) {
        contact.status = input.status;
      }

      contact.version += 1;
      contact.updatedAt = nowIso();
      contact.updatedBy = input.actor.actorId;
      contact.versionHistory.push({
        version: contact.version,
        changedAt: contact.updatedAt,
        actorId: input.actor.actorId,
        changeSummary: "contact updated",
      });

      updated = structuredClone(contact);
    });

    const snapshot = this.persistence.snapshot();
    this.metrics.replace(snapshot.metrics);

    if (!updated) {
      throw new ContactError("CONTACT_INVALID", "update failed", false, true, "MEDIUM");
    }

    await this.audit.append({
      eventType: "CONTACT_UPDATED",
      contactId: updated.contactId,
      tenantId: updated.tenantId,
      actor: input.actor,
      message: `contact ${updated.contactId} updated`,
    });

    return updated;
  }

  async mutateContact(input: {
    contactId: ContactId;
    tenantId: TenantId;
    actor: ContactActorContext;
    changeSummary: string;
    mutator: (contact: Contact) => void;
  }): Promise<Contact> {
    let updated: Contact | undefined;

    await this.persistence.mutate((state) => {
      const contact = state.contacts.find((item) => item.contactId === input.contactId);
      if (!contact) {
        throw new ContactError("CONTACT_INVALID", `contact not found: ${input.contactId}`, false, true, "MEDIUM");
      }
      if (contact.tenantId !== input.tenantId) {
        throw new ContactError("TENANT_INVALID", `tenant mismatch for ${input.contactId}`, false, true, "HIGH");
      }

      input.mutator(contact);
      contact.version += 1;
      contact.updatedAt = nowIso();
      contact.updatedBy = input.actor.actorId;
      contact.versionHistory.push({
        version: contact.version,
        changedAt: contact.updatedAt,
        actorId: input.actor.actorId,
        changeSummary: input.changeSummary,
      });
      updated = structuredClone(contact);
    });

    const snapshot = this.persistence.snapshot();
    this.metrics.replace(snapshot.metrics);

    if (!updated) {
      throw new ContactError("CONTACT_INVALID", "contact mutation failed", false, true, "MEDIUM");
    }

    return updated;
  }

  async deactivateContact(contactId: ContactId, tenantId: TenantId, actor: ContactActorContext): Promise<Contact> {
    const updated = await this.updateContact({ contactId, tenantId, actor, status: "INACTIVE" });
    await this.audit.append({
      eventType: "CONTACT_DEACTIVATED",
      contactId,
      tenantId,
      actor,
      message: `contact ${contactId} deactivated`,
    });
    return updated;
  }

  async reactivateContact(contactId: ContactId, tenantId: TenantId, actor: ContactActorContext): Promise<Contact> {
    const current = this.persistence.getContact(contactId);
    if (!current) {
      throw new ContactError("CONTACT_INVALID", `contact not found: ${contactId}`, false, true, "MEDIUM");
    }
    if (current.status === "MERGED" || current.status === "DECEASED") {
      throw new ContactError("LIFECYCLE_TRANSITION_INVALID", `reactivation not allowed from ${current.status}`, false, true, "HIGH");
    }

    const updated = await this.updateContact({ contactId, tenantId, actor, status: "ACTIVE" });
    await this.audit.append({
      eventType: "CONTACT_REACTIVATED",
      contactId,
      tenantId,
      actor,
      message: `contact ${contactId} reactivated`,
    });
    return updated;
  }
}
