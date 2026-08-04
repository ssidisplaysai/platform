import { createHash } from "node:crypto";
import type { Contact, ContactId, DeduplicationDecision, TenantId } from "../contracts";
import type { ContactRegistry } from "./ContactRegistry";
import type { ContactAuditWriter } from "./ContactAuditWriter";
import type { PersistenceCoordinator } from "../persistence";

function normalizedSignals(contact: Contact): {
  emails: string[];
  phones: string[];
  identities: string[];
  externalIdentifiers: string[];
  affiliations: string[];
  names: string[];
  addresses: string[];
} {
  return {
    emails: contact.methods.filter((item) => item.type === "EMAIL").map((item) => item.email.normalizedValue),
    phones: contact.methods.filter((item) => item.type === "PHONE").map((item) => item.phone.normalizedValue),
    identities: contact.identityLinks.map((item) => `${item.identityProvider}:${item.subjectId}`),
    externalIdentifiers: contact.identityLinks
      .map((item) => item.externalIdentifier?.trim().toLowerCase() ?? "")
      .filter((item) => item.length > 0),
    affiliations: contact.affiliations.map((item) => `${item.organizationId}:${item.role}`),
    names: [contact.personName.normalizedFullName],
    addresses: contact.methods.filter((item) => item.type === "POSTAL").map((item) => item.postal.normalizedValue),
  };
}

function scoreMatch(left: Contact, right: Contact): DeduplicationDecision {
  const leftSignals = normalizedSignals(left);
  const rightSignals = normalizedSignals(right);
  const reasons: string[] = [];
  let score = 0;

  const shared = <T>(a: T[], b: T[]): T[] => a.filter((item) => b.includes(item));

  if (shared(leftSignals.emails, rightSignals.emails).length > 0) {
    score += 50;
    reasons.push("shared_normalized_email");
  }
  if (shared(leftSignals.phones, rightSignals.phones).length > 0) {
    score += 35;
    reasons.push("shared_normalized_phone");
  }
  if (shared(leftSignals.identities, rightSignals.identities).length > 0) {
    score += 60;
    reasons.push("shared_identity_link");
  }
  if (shared(leftSignals.externalIdentifiers, rightSignals.externalIdentifiers).length > 0) {
    score += 40;
    reasons.push("shared_external_identifier");
  }
  if (shared(leftSignals.affiliations, rightSignals.affiliations).length > 0) {
    score += 20;
    reasons.push("shared_affiliation");
  }
  if (shared(leftSignals.names, rightSignals.names).length > 0) {
    score += 15;
    reasons.push("shared_name");
  }
  if (shared(leftSignals.addresses, rightSignals.addresses).length > 0) {
    score += 20;
    reasons.push("shared_address");
  }

  const deterministicHash = createHash("sha256")
    .update(`${left.contactId}:${right.contactId}:${reasons.join(",")}:${score}`)
    .digest("hex");

  return {
    candidateContactId: right.contactId,
    score,
    reasons,
    deterministicHash,
  };
}

export class ContactDeduplicationService {
  constructor(
    private readonly registry: ContactRegistry,
    private readonly audit: ContactAuditWriter,
    private readonly persistence: PersistenceCoordinator,
  ) {}

  async detectCandidates(input: { contactId: ContactId; tenantId: TenantId; threshold?: number }): Promise<DeduplicationDecision[]> {
    const source = this.registry.getContact(input.contactId);
    if (!source) {
      return [];
    }

    const candidates = this.registry
      .listContacts(input.tenantId)
      .filter((item) => item.contactId !== source.contactId)
      .map((item) => scoreMatch(source, item))
      .filter((item) => item.score >= (input.threshold ?? 50))
      .sort((left, right) => right.score - left.score || left.candidateContactId.localeCompare(right.candidateContactId));

    for (const candidate of candidates) {
      await this.persistence.touchDuplicateBacklog(candidate.candidateContactId);
      await this.audit.append({
        eventType: "DUPLICATE_CANDIDATE_IDENTIFIED",
        contactId: input.contactId,
        tenantId: input.tenantId,
        message: "duplicate candidate identified",
        details: { candidateContactId: candidate.candidateContactId, score: candidate.score, reasons: candidate.reasons },
      });
    }

    return candidates;
  }
}
