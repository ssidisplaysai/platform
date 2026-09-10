import {
  applyCreatedOnboardingProfile,
  buildOnboardingProfileInput,
  createOnboardingProfileId,
  evaluateNewProfileReadiness,
  filterReadyOnboardingProfiles,
  type OnboardingProfileSelection,
  type OnboardingProfileType,
} from "../onboarding-profile-creation";
import type {
  IntegrationProfileConfiguration,
  IntegrationProfileReferenceSet,
} from "../types";

const completeReferences: Record<
  OnboardingProfileType,
  Partial<IntegrationProfileReferenceSet>
> = {
  brand: {
    logoReference: "assetref-rj-metal-logo",
    colorPaletteReference: "paletteref-rj-metal-commercial",
    typographyReference: "typographyref-rj-metal-commercial",
    voiceReference: "voiceref-rj-metal-commercial",
    defaultCtaReference: "ctaref-rj-metal-contact",
  },
  seo: {
    titleStrategyReference: "titlestrategy-rj-metal-commercial",
    metaStrategyReference: "metastrategy-rj-metal-commercial",
    schemaReference: "schemaref-rj-metal-commercial",
    openGraphReference: "openGraphref-rj-metal-commercial",
    slugStrategyReference: "slugstrategy-rj-metal-location",
    canonicalPolicyReference: "canonicalref-rj-metal-primary",
  },
  prompt: {
    promptReference: "promptref-rj-metal-commercial",
    providerReference: "provider-openai-text",
  },
  image: {
    promptReference: "promptref-rj-metal-commercial-images",
    providerReference: "provider-openai-image",
  },
  workflow: {
    workflowReference: "workflowref-rj-metal-location-pages",
    providerReference: "provider-n8n",
    retryPolicyReference: "retrypolicy-standard-3",
    executionTimeoutReference: "timeout-policy-30s",
  },
};

const emptySelection: OnboardingProfileSelection = {
  seoProfileReference: "",
  promptProfileReference: "",
  imageProfileReference: "",
  brandProfileReference: "",
  workflowReference: "",
};

function profile(type: OnboardingProfileType, name = `RJ Metal ${type}`) {
  const input = buildOnboardingProfileInput({
    organizationId: "rj-metal",
    profileType: type,
    profileName: name,
    description: `Reusable RJ Metal ${type} authority.`,
    references: completeReferences[type],
  });
  return {
    ...input,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
  } satisfies IntegrationProfileConfiguration;
}

describe("fresh-site onboarding profile creation", () => {
  test.each<OnboardingProfileType>(["brand", "seo", "prompt", "image", "workflow"])(
    "builds a ready reusable organization %s profile",
    (profileType) => {
      const input = buildOnboardingProfileInput({
        organizationId: "rj-metal",
        profileType,
        profileName: `RJ Metal Commercial ${profileType}`,
        description: "Reusable RJ Metal commercial authority.",
        references: completeReferences[profileType],
      });
      const readiness = evaluateNewProfileReadiness({ profile: input });

      expect(input.organizationId).toBe("rj-metal");
      expect(input.assignedSiteIds).toEqual([]);
      expect(input.defaultForOrganization).toBe(false);
      expect(input.version).toBe("1.0.0");
      expect(readiness.ready).toBe(true);
    },
  );

  test("uses deterministic identity and leaves incomplete profiles not ready", () => {
    const identity = {
      organizationId: "rj-metal",
      profileType: "brand" as const,
      profileName: "RJ Metal Commercial Fabrication Brand",
    };
    expect(createOnboardingProfileId(identity)).toBe(createOnboardingProfileId(identity));

    const incomplete = buildOnboardingProfileInput({
      ...identity,
      description: "Incomplete brand authority.",
      references: {},
    });
    const readiness = evaluateNewProfileReadiness({ profile: incomplete });
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toContain("Logo reference is missing.");
  });

  test("workspace organization cannot leak profiles into onboarding organization", () => {
    const rjProfile = profile("seo");
    const ledwProfile = {
      ...profile("seo", "LEDW SEO"),
      profileId: "profile-seo-ledw-default",
      organizationId: "led-display-warehouse",
    };
    const filtered = filterReadyOnboardingProfiles({
      organizationId: "rj-metal",
      profiles: [ledwProfile, rjProfile],
      readiness: [
        { profileId: ledwProfile.profileId, ready: true },
        { profileId: rjProfile.profileId, ready: true },
      ],
    });

    expect(filtered.map((candidate) => candidate.profileId)).toEqual([rjProfile.profileId]);
  });

  test("ready creation is immediately selected without replacing existing profiles", () => {
    const existing = profile("brand", "Existing RJ Metal Brand");
    const created = profile("brand", "New RJ Metal Brand");
    const result = applyCreatedOnboardingProfile({
      organizationId: "rj-metal",
      profiles: [existing],
      selection: emptySelection,
      profile: created,
    });

    expect(result.ok).toBe(true);
    expect(result.profiles.map((candidate) => candidate.profileId)).toEqual([
      existing.profileId,
      created.profileId,
    ]);
    expect(result.selection.brandProfileReference).toBe(created.profileId);
  });

  test("created profile organization mismatch is rejected without selection change", () => {
    const ledwProfile = {
      ...profile("workflow", "LEDW Workflow"),
      profileId: "profile-workflow-ledw",
      organizationId: "led-display-warehouse",
    };
    const result = applyCreatedOnboardingProfile({
      organizationId: "rj-metal",
      profiles: [],
      selection: emptySelection,
      profile: ledwProfile,
    });

    expect(result.ok).toBe(false);
    expect(result.profiles).toEqual([]);
    expect(result.selection).toEqual(emptySelection);
  });
});