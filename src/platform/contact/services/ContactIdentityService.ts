import { randomUUID } from "node:crypto";
import { ContactError, type ContactActorContext, type ContactId, type IdentityLink, type TenantId } from "../contracts";
import type { ContactRegistry } from "./ContactRegistry";

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export class ContactIdentityService {
  constructor(private readonly registry: ContactRegistry) {}

  normalizeName(input: {
    legalGivenName: string;
    legalFamilyName: string;
    legalMiddleName?: string;
    preferredGivenName?: string;
    preferredFamilyName?: string;
  }) {
    return {
      legalGivenName: normalize(input.legalGivenName),
      legalFamilyName: normalize(input.legalFamilyName),
      legalMiddleName: input.legalMiddleName ? normalize(input.legalMiddleName) : undefined,
      preferredGivenName: input.preferredGivenName ? normalize(input.preferredGivenName) : undefined,
      preferredFamilyName: input.preferredFamilyName ? normalize(input.preferredFamilyName) : undefined,
    };
  }

  async linkIdentity(input: {
    contactId: ContactId;
    tenantId: TenantId;
    identityProvider: string;
    subjectId: string;
    externalIdentifier?: string;
    actor: ContactActorContext;
  }): Promise<IdentityLink> {
    const contact = this.registry.getContact(input.contactId);
    if (!contact) {
      throw new ContactError("CONTACT_INVALID", `contact not found: ${input.contactId}`, false, true, "MEDIUM");
    }
    if (contact.tenantId !== input.tenantId) {
      throw new ContactError("TENANT_INVALID", "tenant mismatch", false, true, "HIGH");
    }

    if (contact.identityLinks.some((item) => item.identityProvider === input.identityProvider && item.subjectId === input.subjectId)) {
      throw new ContactError("CONTACT_INVALID", "duplicate identity link prohibited", false, true, "HIGH");
    }

    const link: IdentityLink = {
      identityLinkId: `identity_link_${randomUUID()}`,
      identityProvider: input.identityProvider,
      subjectId: input.subjectId,
      externalIdentifier: input.externalIdentifier,
      actor: input.actor,
      linkedAt: new Date().toISOString(),
    };

    await this.registry.mutateContact({
      contactId: contact.contactId,
      tenantId: contact.tenantId,
      actor: input.actor,
      changeSummary: "identity link added",
      mutator: (record) => {
        record.identityLinks.push(link);
      },
    });

    return structuredClone(link);
  }
}
