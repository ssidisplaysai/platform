import { evaluateIntegrationProfileReadiness } from "./integration-profile-readiness";
import type {
  IntegrationProfileConfiguration,
  IntegrationProfileReadinessResult,
  IntegrationProfileReferenceSet,
  IntegrationProfileType,
  NewIntegrationProfileInput,
} from "./types";

export type OnboardingProfileType = Extract<
  IntegrationProfileType,
  "brand" | "seo" | "prompt" | "image" | "workflow"
>;

export type OnboardingProfileReferenceField = {
  key: keyof IntegrationProfileReferenceSet;
  label: string;
  placeholder: string;
};

export type OnboardingProfileSelection = {
  seoProfileReference: string;
  promptProfileReference: string;
  imageProfileReference: string;
  brandProfileReference: string;
  workflowReference: string;
};

export const ONBOARDING_PROFILE_REFERENCE_FIELDS: Record<
  OnboardingProfileType,
  readonly OnboardingProfileReferenceField[]
> = {
  brand: [
    { key: "logoReference", label: "Logo authority reference", placeholder: "assetref-rj-metal-logo" },
    { key: "colorPaletteReference", label: "Color palette reference", placeholder: "paletteref-rj-metal-commercial" },
    { key: "typographyReference", label: "Typography reference", placeholder: "typographyref-rj-metal-commercial" },
    { key: "voiceReference", label: "Brand voice reference", placeholder: "voiceref-rj-metal-commercial" },
    { key: "defaultCtaReference", label: "Default CTA reference", placeholder: "ctaref-rj-metal-contact" },
  ],
  seo: [
    { key: "titleStrategyReference", label: "Title strategy reference", placeholder: "titlestrategy-rj-metal-commercial" },
    { key: "metaStrategyReference", label: "Meta strategy reference", placeholder: "metastrategy-rj-metal-commercial" },
    { key: "schemaReference", label: "Schema reference", placeholder: "schemaref-rj-metal-commercial" },
    { key: "openGraphReference", label: "OpenGraph reference", placeholder: "openGraphref-rj-metal-commercial" },
    { key: "slugStrategyReference", label: "Slug strategy reference", placeholder: "slugstrategy-rj-metal-location" },
    { key: "canonicalPolicyReference", label: "Canonical policy reference", placeholder: "canonicalref-rj-metal-primary" },
  ],
  prompt: [
    { key: "promptReference", label: "Prompt authority reference", placeholder: "promptref-rj-metal-commercial" },
    { key: "providerReference", label: "Text provider reference", placeholder: "provider-openai-text" },
  ],
  image: [
    { key: "providerReference", label: "Image provider reference", placeholder: "provider-openai-image" },
    { key: "promptReference", label: "Image prompt reference", placeholder: "promptref-rj-metal-commercial-images" },
  ],
  workflow: [
    { key: "workflowReference", label: "Workflow authority reference", placeholder: "workflowref-rj-metal-location-pages" },
    { key: "providerReference", label: "Workflow provider reference", placeholder: "provider-n8n" },
    { key: "retryPolicyReference", label: "Retry policy reference", placeholder: "retrypolicy-standard-3" },
    { key: "executionTimeoutReference", label: "Execution timeout reference", placeholder: "timeout-policy-30s" },
  ],
};

export function createEmptyProfileReferences(): IntegrationProfileReferenceSet {
  return {
    credentialReference: null,
    workflowReference: null,
    promptReference: null,
    providerReference: null,
    brandReference: null,
    workflowProfileReference: null,
    wordpressProfileReference: null,
    promptProfileReference: null,
    imageProfileReference: null,
    seoProfileReference: null,
    analyticsProfileReference: null,
    titleStrategyReference: null,
    metaStrategyReference: null,
    schemaReference: null,
    openGraphReference: null,
    slugStrategyReference: null,
    canonicalPolicyReference: null,
    logoReference: null,
    colorPaletteReference: null,
    typographyReference: null,
    voiceReference: null,
    defaultCtaReference: null,
    assetReference: null,
    baseUrlReference: null,
    authorReference: null,
    categoryReference: null,
    postStatusReference: null,
    featuredImagePolicyReference: null,
    imageInsertionPolicyReference: null,
    yoastPolicyReference: null,
    inputContractReference: null,
    outputContractReference: null,
    retryPolicyReference: null,
    executionTimeoutReference: null,
    environmentReference: null,
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createOnboardingProfileId(input: {
  organizationId: string;
  profileType: OnboardingProfileType;
  profileName: string;
}): string {
  return `profile-${input.profileType}-${slugify(input.organizationId)}-${slugify(input.profileName)}`;
}

export function buildOnboardingProfileInput(input: {
  organizationId: string;
  profileType: OnboardingProfileType;
  profileName: string;
  description: string;
  references: Partial<IntegrationProfileReferenceSet>;
}): NewIntegrationProfileInput {
  return {
    profileId: createOnboardingProfileId(input),
    profileType: input.profileType,
    organizationId: input.organizationId,
    profileName: input.profileName.trim(),
    description: input.description.trim() || null,
    status: "active",
    enabled: true,
    version: "1.0.0",
    assignedSiteIds: [],
    defaultForOrganization: false,
    references: {
      ...createEmptyProfileReferences(),
      ...input.references,
    },
    notes: "Created through fresh-site onboarding.",
  };
}

export function evaluateNewProfileReadiness(input: {
  profile: NewIntegrationProfileInput;
  profiles?: readonly IntegrationProfileConfiguration[];
}): IntegrationProfileReadinessResult {
  const timestamp = new Date().toISOString();
  const profile: IntegrationProfileConfiguration = {
    ...input.profile,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const lookup = new Map(
    [...(input.profiles ?? []), profile].map((candidate) => [
      candidate.profileId,
      candidate,
    ]),
  );

  return evaluateIntegrationProfileReadiness({ profile, profileLookup: lookup });
}

export function filterReadyOnboardingProfiles(input: {
  organizationId: string;
  profiles: readonly IntegrationProfileConfiguration[];
  readiness: readonly Pick<IntegrationProfileReadinessResult, "profileId" | "ready">[];
}): IntegrationProfileConfiguration[] {
  const readyIds = new Set(
    input.readiness.filter((entry) => entry.ready).map((entry) => entry.profileId),
  );

  return input.profiles.filter((profile) =>
    profile.organizationId === input.organizationId
    && profile.enabled
    && profile.status === "active"
    && readyIds.has(profile.profileId),
  );
}

export function applyCreatedOnboardingProfile(input: {
  organizationId: string;
  profiles: readonly IntegrationProfileConfiguration[];
  selection: OnboardingProfileSelection;
  profile: IntegrationProfileConfiguration;
}): {
  ok: boolean;
  profiles: IntegrationProfileConfiguration[];
  selection: OnboardingProfileSelection;
} {
  if (input.profile.organizationId !== input.organizationId) {
    return {
      ok: false,
      profiles: [...input.profiles],
      selection: { ...input.selection },
    };
  }

  const profiles = [
    ...input.profiles.filter((candidate) => candidate.profileId !== input.profile.profileId),
    input.profile,
  ];
  const selection = { ...input.selection };

  switch (input.profile.profileType) {
    case "seo":
      selection.seoProfileReference = input.profile.profileId;
      break;
    case "prompt":
      selection.promptProfileReference = input.profile.profileId;
      break;
    case "image":
      selection.imageProfileReference = input.profile.profileId;
      break;
    case "brand":
      selection.brandProfileReference = input.profile.profileId;
      break;
    case "workflow":
      selection.workflowReference = input.profile.profileId;
      break;
  }

  return { ok: true, profiles, selection };
}