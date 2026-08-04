import type { ContactPersistedState } from "../contracts";

export type ContactStore = {
  load(): Promise<ContactPersistedState>;
  save(state: ContactPersistedState): Promise<void>;
};

export type ContactMethodStore = ContactStore;
export type AffiliationStore = ContactStore;
export type PreferenceStore = ContactStore;
export type ConsentStore = ContactStore;
export type MergeStore = ContactStore;
export type AuditStore = ContactStore;
export type MetricsStore = ContactStore;
