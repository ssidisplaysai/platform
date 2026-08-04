import type { Contact, ContactMetrics, ContactMethodType } from "../contracts";
import { createDefaultContactMetrics } from "../contracts";

export class ContactMetricsService {
  private snapshotState: ContactMetrics = createDefaultContactMetrics();

  replace(metrics: ContactMetrics): void {
    this.snapshotState = structuredClone(metrics);
  }

  snapshot(): ContactMetrics {
    return structuredClone(this.snapshotState);
  }

  increment(field: keyof ContactMetrics, amount = 1): void {
    const value = this.snapshotState[field];
    if (typeof value === "number") {
      (this.snapshotState[field] as number) = value + amount;
    }
  }

  setEligible(channel: ContactMethodType, value: number): void {
    this.snapshotState.eligibleContactsByChannel[channel] = value;
  }

  recalculate(contacts: Contact[], duplicateCandidates: number): void {
    this.snapshotState.registeredContacts = contacts.length;
    this.snapshotState.activeContacts = contacts.filter((item) => item.status === "ACTIVE").length;
    this.snapshotState.inactiveContacts = contacts.filter((item) => item.status === "INACTIVE").length;
    this.snapshotState.archivedContacts = contacts.filter((item) => item.status === "ARCHIVED").length;
    this.snapshotState.mergedContacts = contacts.filter((item) => item.status === "MERGED").length;
    this.snapshotState.blockedContacts = contacts.filter((item) => item.status === "BLOCKED").length;
    this.snapshotState.verifiedEmailMethods = contacts.flatMap((item) => item.methods).filter((item) => item.type === "EMAIL" && item.email.verified).length;
    this.snapshotState.verifiedPhoneMethods = contacts.flatMap((item) => item.methods).filter((item) => item.type === "PHONE" && item.phone.verified).length;
    this.snapshotState.activeAffiliations = contacts.flatMap((item) => item.affiliations).filter((item) => !item.effectiveTo).length;
    this.snapshotState.consentGrants = contacts.flatMap((item) => item.consentHistory).filter((item) => item.status === "GRANTED").length;
    this.snapshotState.consentWithdrawals = contacts.flatMap((item) => item.consentHistory).filter((item) => item.status === "WITHDRAWN").length;
    this.snapshotState.duplicateCandidates = duplicateCandidates;
  }
}
