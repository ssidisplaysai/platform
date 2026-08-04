import { randomUUID } from "node:crypto";
import { ContactError, type ContactActorContext, type ContactId, type ContactRole, type OrganizationAffiliation, type TenantId } from "../contracts";
import type { ContactRegistry } from "./ContactRegistry";
import type { ContactAuditWriter } from "./ContactAuditWriter";
import type { ContactPlatformDependencies } from "../contracts";

export class OrganizationAffiliationService {
  constructor(
    private readonly registry: ContactRegistry,
    private readonly audit: ContactAuditWriter,
    private readonly dependencies: ContactPlatformDependencies,
  ) {}

  async addAffiliation(input: {
    contactId: ContactId;
    tenantId: TenantId;
    organizationId: string;
    role: ContactRole;
    actor: ContactActorContext;
    primary?: boolean;
    effectiveFrom?: string;
    effectiveTo?: string;
  }): Promise<OrganizationAffiliation> {
    const contact = this.registry.getContact(input.contactId);
    if (!contact) {
      throw new ContactError("CONTACT_INVALID", `contact not found: ${input.contactId}`, false, true, "MEDIUM");
    }
    if (contact.tenantId !== input.tenantId) {
      throw new ContactError("TENANT_INVALID", `tenant mismatch for ${input.contactId}`, false, true, "HIGH");
    }

    const orgExists = await this.dependencies.organization.organizationExists({ organizationId: input.organizationId, tenantId: input.tenantId });
    if (!orgExists) {
      throw new ContactError("ORGANIZATION_REFERENCE_INVALID", "invalid organization reference", false, true, "HIGH");
    }

    if (contact.affiliations.some((item) => item.organizationId === input.organizationId && item.role === input.role && !item.effectiveTo)) {
      throw new ContactError("CONTACT_INVALID", "duplicate active affiliation", false, true, "MEDIUM");
    }

    const affiliation: OrganizationAffiliation = {
      affiliationId: `affiliation_${randomUUID()}`,
      contactId: input.contactId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      role: input.role,
      primary: Boolean(input.primary),
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
    };

    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "organization affiliation added",
      mutator: (record) => {
        if (affiliation.primary) {
          record.affiliations = record.affiliations.map((item) => ({ ...item, primary: false }));
        }
        record.affiliations.push(affiliation);
      },
    });

    await this.audit.append({
      eventType: "AFFILIATION_ADDED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "organization affiliation added",
      details: { organizationId: input.organizationId, role: input.role },
    });

    return structuredClone(affiliation);
  }

  async endAffiliation(input: {
    contactId: ContactId;
    tenantId: TenantId;
    affiliationId: string;
    actor: ContactActorContext;
  }): Promise<void> {
    await this.registry.mutateContact({
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      changeSummary: "organization affiliation ended",
      mutator: (record) => {
        const affiliation = record.affiliations.find((item) => item.affiliationId === input.affiliationId);
        if (!affiliation) {
          throw new ContactError("CONTACT_INVALID", `affiliation not found: ${input.affiliationId}`, false, true, "MEDIUM");
        }
        affiliation.effectiveTo = new Date().toISOString();
        affiliation.primary = false;
      },
    });

    await this.audit.append({
      eventType: "AFFILIATION_ENDED",
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: "organization affiliation ended",
      details: { affiliationId: input.affiliationId },
    });
  }
}
