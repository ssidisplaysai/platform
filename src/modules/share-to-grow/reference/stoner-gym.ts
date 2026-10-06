import type { AttributionDecision } from "../attribution";
import type { NormalizedCommerceLine } from "../commerce";
import type { EconomicRuleVersion } from "../economic-rule";
import type { EconomicRuleResolver } from "../allocation-pipeline";

export const STONER_GYM_REFERENCE = Object.freeze({
  organizationId: "stoner",
  verticalId: "stoner-gym",
  foundingCollaboratorPartnerId: "daniel",
  attributionPolicy: Object.freeze({
    id: "stoner-gym-attribution-30d-v1",
    version: 1,
    windowDays: 30,
    effectiveFrom: "2026-10-05T00:00:00Z",
  }),
  payoutPolicy: Object.freeze({
    id: "stoner-gym-standard-30d-v1",
    clearingDays: 30,
  }),
});

export function stonerGymEconomicRules(input: {
  creatorPartnerId?: string;
} = {}): Readonly<Record<"danielDirect" | "creator" | "organic", EconomicRuleVersion>> {
  const creator = input.creatorPartnerId ?? "reference-creator";
  return Object.freeze({
    danielDirect: Object.freeze({
      id: "stoner-gym-daniel-direct-v1",
      ruleId: "stoner-gym-daniel-direct",
      version: 1,
      effectiveFrom: "2026-10-05T00:00:00Z",
      beneficiaries: Object.freeze([
        { beneficiaryId: "stoner", role: "brand", basisPoints: 5000 },
        { beneficiaryId: "daniel", role: "founding_collaborator", basisPoints: 5000 },
      ]),
      residualBeneficiaryId: "stoner",
    }),
    creator: Object.freeze({
      id: `stoner-gym-creator-${creator}-v1`,
      ruleId: "stoner-gym-recruited-creator",
      version: 1,
      effectiveFrom: "2026-10-05T00:00:00Z",
      beneficiaries: Object.freeze([
        { beneficiaryId: "stoner", role: "brand", basisPoints: 5000 },
        { beneficiaryId: creator, role: "creator", basisPoints: 3500 },
        { beneficiaryId: "daniel", role: "network_override", basisPoints: 1500 },
      ]),
      residualBeneficiaryId: "stoner",
    }),
    organic: Object.freeze({
      id: "stoner-gym-organic-v1",
      ruleId: "stoner-gym-organic",
      version: 1,
      effectiveFrom: "2026-10-05T00:00:00Z",
      beneficiaries: Object.freeze([
        { beneficiaryId: "stoner", role: "brand", basisPoints: 10000 },
      ]),
      residualBeneficiaryId: "stoner",
    }),
  });
}

export function createStonerGymRuleResolver(input: {
  recruitedCreatorPartnerIds: readonly string[];
}): EconomicRuleResolver {
  const creators = new Set(input.recruitedCreatorPartnerIds);

  return Object.freeze({
    resolve({ attribution }: {
      line: NormalizedCommerceLine;
      attribution: AttributionDecision;
    }): EconomicRuleVersion {
      if (attribution.selectedPartnerId && creators.has(attribution.selectedPartnerId)) {
        return stonerGymEconomicRules({
          creatorPartnerId: attribution.selectedPartnerId,
        }).creator;
      }
      if (attribution.selectedPartnerId === STONER_GYM_REFERENCE.foundingCollaboratorPartnerId) {
        return stonerGymEconomicRules().danielDirect;
      }
      return stonerGymEconomicRules().organic;
    },
  });
}
