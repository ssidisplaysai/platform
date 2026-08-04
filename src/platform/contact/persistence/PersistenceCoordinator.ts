import {
  ContactError,
  createDefaultContactPersistedState,
  type Contact,
  type ContactAuditRecord,
  type ContactId,
  type ContactMethod,
  type ContactMetrics,
  type ContactPersistedState,
  type ConsentRecord,
  type TenantId,
} from "../contracts";
import type { ContactStore } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function hasDuplicateContactIds(contacts: Contact[]): string | null {
  const seen = new Set<string>();
  for (const contact of contacts) {
    if (seen.has(contact.contactId)) {
      return contact.contactId;
    }
    seen.add(contact.contactId);
  }
  return null;
}

function validateMethods(contact: Contact): void {
  const seen = new Set<string>();
  for (const method of contact.methods) {
    const key = method.type === "EMAIL"
      ? `EMAIL:${method.email.normalizedValue}`
      : method.type === "PHONE"
        ? `PHONE:${method.phone.normalizedValue}`
        : `POSTAL:${method.postal.normalizedValue}`;

    if (seen.has(key)) {
      throw new ContactError("CONTACT_METHOD_DUPLICATE", `duplicate method for ${contact.contactId}`, false, true, "HIGH");
    }
    seen.add(key);
  }
}

function validateConsentTransitions(consentHistory: ConsentRecord[]): void {
  const byType = new Map<string, ConsentRecord[]>();
  for (const item of consentHistory) {
    const rows = byType.get(item.type) ?? [];
    rows.push(item);
    byType.set(item.type, rows);
  }

  for (const [, rows] of byType) {
    const sorted = [...rows].sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));
    let seenWithdrawal = false;
    for (const row of sorted) {
      if (seenWithdrawal && row.status === "GRANTED") {
        throw new ContactError("CONSENT_TRANSITION_INVALID", "invalid consent transition after withdrawal", false, true, "HIGH");
      }
      if (row.status === "WITHDRAWN") {
        seenWithdrawal = true;
      }
    }
  }
}

function validateStateOrThrow(state: ContactPersistedState): void {
  if (state.schemaVersion !== "1.0.0") {
    throw new ContactError("STATE_CORRUPT", "unsupported contact state schema", false, true, "CRITICAL");
  }

  const duplicateContactId = hasDuplicateContactIds(state.contacts);
  if (duplicateContactId) {
    throw new ContactError("CONTACT_DUPLICATE_ID", `duplicate contact id in persisted state: ${duplicateContactId}`, false, true, "CRITICAL");
  }

  for (const contact of state.contacts) {
    validateMethods(contact);
    validateConsentTransitions(contact.consentHistory);

    for (const affiliation of contact.affiliations) {
      if (affiliation.tenantId !== contact.tenantId) {
        throw new ContactError("CROSS_TENANT_AFFILIATION", `cross-tenant affiliation detected for ${contact.contactId}`, false, true, "CRITICAL");
      }
    }

    if (contact.mergedIntoContactId && contact.status !== "MERGED") {
      throw new ContactError("STATE_CORRUPT", `merged target set on non-merged contact ${contact.contactId}`, false, true, "CRITICAL");
    }
  }
}

function computeMetrics(state: ContactPersistedState): ContactMetrics {
  const metrics = structuredClone(state.metrics ?? createDefaultContactPersistedState().metrics);
  const contacts = state.contacts;
  metrics.registeredContacts = contacts.length;
  metrics.activeContacts = contacts.filter((item) => item.status === "ACTIVE").length;
  metrics.inactiveContacts = contacts.filter((item) => item.status === "INACTIVE").length;
  metrics.archivedContacts = contacts.filter((item) => item.status === "ARCHIVED").length;
  metrics.mergedContacts = contacts.filter((item) => item.status === "MERGED").length;
  metrics.blockedContacts = contacts.filter((item) => item.status === "BLOCKED").length;
  metrics.verifiedEmailMethods = contacts.flatMap((item) => item.methods).filter((item) => item.type === "EMAIL" && item.email.verified).length;
  metrics.verifiedPhoneMethods = contacts.flatMap((item) => item.methods).filter((item) => item.type === "PHONE" && item.phone.verified).length;
  metrics.activeAffiliations = contacts.flatMap((item) => item.affiliations).filter((item) => !item.effectiveTo).length;
  metrics.consentGrants = contacts.flatMap((item) => item.consentHistory).filter((item) => item.status === "GRANTED").length;
  metrics.consentWithdrawals = contacts.flatMap((item) => item.consentHistory).filter((item) => item.status === "WITHDRAWN").length;
  metrics.duplicateCandidates = state.duplicateBacklog.length;

  if (state.duplicateBacklog.length === 0) {
    metrics.oldestUnreviewedDuplicateAgeMinutes = 0;
  } else {
    const oldest = state.duplicateBacklog
      .map((item) => Date.parse(item.firstDetectedAt))
      .reduce((min, value) => Math.min(min, value), Date.now());
    metrics.oldestUnreviewedDuplicateAgeMinutes = Math.max(0, Math.floor((Date.now() - oldest) / 60000));
  }

  return metrics;
}

export class PersistenceCoordinator {
  private state: ContactPersistedState = createDefaultContactPersistedState();

  constructor(private readonly store: ContactStore) {}

  async load(): Promise<void> {
    try {
      this.state = await this.store.load();
      validateStateOrThrow(this.state);
      this.state.metrics = computeMetrics(this.state);
      this.state.metrics.recoveryCount += 1;
      await this.store.save(this.state);
    } catch (error) {
      if (error instanceof ContactError) {
        if (this.state?.metrics) {
          this.state.metrics.corruptStateCount += 1;
        }
        throw error;
      }

      throw new ContactError("RECOVERY_FAILURE", "contact recovery failed", false, true, "CRITICAL");
    }
  }

  snapshot(): ContactPersistedState {
    return structuredClone(this.state);
  }

  getContact(contactId: ContactId): Contact | undefined {
    return this.state.contacts.find((item) => item.contactId === contactId);
  }

  listContacts(): Contact[] {
    return this.state.contacts.map((item) => structuredClone(item));
  }

  tenantContacts(tenantId: TenantId): Contact[] {
    return this.state.contacts.filter((item) => item.tenantId === tenantId).map((item) => structuredClone(item));
  }

  async mutate(mutator: (state: ContactPersistedState) => void): Promise<void> {
    const next = this.snapshot();
    mutator(next);
    validateStateOrThrow(next);
    next.metrics = computeMetrics(next);

    try {
      await this.store.save(next);
    } catch {
      throw new ContactError("PERSISTENCE_FAILURE", "contact persistence save failed", true, true, "HIGH");
    }

    this.state = next;
  }

  async appendAudit(record: ContactAuditRecord): Promise<void> {
    await this.mutate((state) => {
      state.audits.push(record);
    });
  }

  async touchDuplicateBacklog(contactId: ContactId): Promise<void> {
    await this.mutate((state) => {
      if (!state.duplicateBacklog.some((item) => item.contactId === contactId)) {
        state.duplicateBacklog.push({ contactId, firstDetectedAt: nowIso() });
      }
    });
  }
}
