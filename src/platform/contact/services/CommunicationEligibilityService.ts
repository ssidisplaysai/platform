import { type CommunicationEligibility, type ContactActorContext, type ContactId, type ContactMethodType } from "../contracts";
import type { ConsentService } from "./ConsentService";
import type { ContactAuditWriter } from "./ContactAuditWriter";

export class CommunicationEligibilityService {
  constructor(
    private readonly consentService: ConsentService,
    private readonly audit: ContactAuditWriter,
  ) {}

  async evaluate(input: {
    contactId: ContactId;
    channel: ContactMethodType;
    actor: ContactActorContext;
  }): Promise<CommunicationEligibility> {
    const eligibility = this.consentService.deriveEligibilityFacts(input.contactId, input.channel);

    await this.audit.append({
      eventType: "ELIGIBILITY_EVALUATED",
      contactId: input.contactId,
      tenantId: eligibility.tenantId,
      actor: input.actor,
      message: "communication eligibility evaluated",
      details: { channel: input.channel, eligible: eligibility.eligible, reasons: eligibility.reasons },
    });

    return eligibility;
  }
}
