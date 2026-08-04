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
  type MergeIdempotencyRecord,
  type TenantId,
} from "../contracts";
import type { ContactStore } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function parseTimestampOrThrow(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new ContactError("STATE_CORRUPT", `invalid timestamp for ${label}`, false, true, "CRITICAL");
  }
  return parsed;
}

function pruneExpiredMergeIdempotencyRecords(state: ContactPersistedState, nowMs = Date.now()): number {
  const before = state.mergeIdempotencyRecords.length;
  state.mergeIdempotencyRecords = state.mergeIdempotencyRecords.filter((item) => {
    const expiresAt = Date.parse(item.expiresAt);
    if (!Number.isFinite(expiresAt)) {
      return false;
    }
    return expiresAt > nowMs;
  });
  return before - state.mergeIdempotencyRecords.length;
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

  const keys = new Set<string>();
  for (const record of state.mergeIdempotencyRecords) {
    if (keys.has(record.idempotencyKey)) {
      throw new ContactError("STATE_CORRUPT", `duplicate merge idempotency key detected: ${record.idempotencyKey}`, false, true, "CRITICAL");
    }
    keys.add(record.idempotencyKey);

    if (!record.idempotencyKey || !record.mergeRecordId || !record.tenantId || !record.sourceContactId || !record.targetContactId) {
      throw new ContactError("STATE_CORRUPT", "invalid merge idempotency record", false, true, "CRITICAL");
    }

    const createdAt = parseTimestampOrThrow(record.createdAt, "mergeIdempotencyRecords.createdAt");
    const expiresAt = parseTimestampOrThrow(record.expiresAt, "mergeIdempotencyRecords.expiresAt");
    if (expiresAt <= createdAt) {
      throw new ContactError("STATE_CORRUPT", "merge idempotency expiry must be after creation", false, true, "CRITICAL");
    }
  }
}

function computeMetrics(state: ContactPersistedState): ContactMetrics {
  const metrics = structuredClone(state.metrics ?? createDefaultContactPersistedState().metrics);
  const contacts = state.contacts;
  const nowMs = Date.now();
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
  metrics.mergeIdempotencyRecords = state.mergeIdempotencyRecords.filter((item) => {
    const expiresAt = Date.parse(item.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > nowMs;
  }).length;

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
      const cleanedRecords = pruneExpiredMergeIdempotencyRecords(this.state);
      this.state.metrics = computeMetrics(this.state);
      this.state.metrics.recoveryCount += 1;
      this.state.metrics.mergeIdempotencyExpiredCleanups += cleanedRecords;
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

  async recordMergeIdempotency(input: {
    idempotencyKey: string;
    tenantId: TenantId;
    sourceContactId: ContactId;
    targetContactId: ContactId;
    mergeRecordId: string;
    ttlMs: number;
  }): Promise<void> {
    const createdAt = nowIso();
    const ttlMs = Math.max(1, Math.floor(input.ttlMs));
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    await this.mutate((state) => {
      const cleaned = pruneExpiredMergeIdempotencyRecords(state);
      if (cleaned > 0) {
        state.metrics.mergeIdempotencyExpiredCleanups += cleaned;
      }

      const existing = state.mergeIdempotencyRecords.find((item) => item.idempotencyKey === input.idempotencyKey);
      if (existing) {
        throw new ContactError("MERGE_CONFLICT", `duplicate merge idempotency key: ${input.idempotencyKey}`, false, true, "HIGH");
      }

      state.mergeIdempotencyRecords.push({
        idempotencyKey: input.idempotencyKey,
        tenantId: input.tenantId,
        sourceContactId: input.sourceContactId,
        targetContactId: input.targetContactId,
        mergeRecordId: input.mergeRecordId,
        createdAt,
        expiresAt,
      });
    });
  }

  findMergeIdempotencyRecord(input: {
    idempotencyKey: string;
    tenantId: TenantId;
    sourceContactId: ContactId;
    targetContactId: ContactId;
  }): MergeIdempotencyRecord | undefined {
    const nowMs = Date.now();
    const found = this.state.mergeIdempotencyRecords.find((item) => item.idempotencyKey === input.idempotencyKey);
    if (!found) {
      return undefined;
    }

    const expiresAt = Date.parse(found.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
      return undefined;
    }

    if (
      found.tenantId !== input.tenantId
      || found.sourceContactId !== input.sourceContactId
      || found.targetContactId !== input.targetContactId
    ) {
      throw new ContactError("MERGE_CONFLICT", `idempotency key scope conflict: ${input.idempotencyKey}`, false, true, "HIGH");
    }

    return structuredClone(found);
  }

  async incrementMergeIdempotencyRejectionCount(): Promise<void> {
    await this.mutate((state) => {
      state.metrics.mergeIdempotencyRejections += 1;
    });
  }

  async cleanupExpiredMergeIdempotencyRecords(): Promise<number> {
    let removed = 0;

    await this.mutate((state) => {
      removed = pruneExpiredMergeIdempotencyRecords(state);
      if (removed > 0) {
        state.metrics.mergeIdempotencyExpiredCleanups += removed;
      }
    });

    return removed;
  }
}
