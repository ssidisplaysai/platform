import { createHash } from "node:crypto";
import { buildOnboardingProfileInput, createOnboardingProfileId, type OnboardingProfileType } from "./onboarding-profile-creation";
import type {
  IntegrationProfileConfiguration,
  IntegrationProfileReferenceSet,
  SiteConfiguration,
} from "./types";

const PREPARED_PROFILE_TYPES = ["brand", "seo", "prompt", "image"] as const;
type PreparedProfileType = (typeof PREPARED_PROFILE_TYPES)[number];

export type AutoPreparedProfileProposal = {
  profileType: PreparedProfileType;
  mode: "existing" | "proposed";
  profileId: string;
  profileName: string;
  description: string;
  references: Partial<IntegrationProfileReferenceSet>;
  existingReason: string | null;
};

export type AutoPreparedWorkflowStatus = {
  configured: boolean;
  profileId: string | null;
  reason: string;
};

export type AutoPreparedProfilesPreview = {
  organizationId: string;
  siteId: string;
  fingerprint: string;
  proposals: AutoPreparedProfileProposal[];
  workflow: AutoPreparedWorkflowStatus;
};

export type AutoPreparedProfileOverride = {
  profileType: PreparedProfileType;
  profileName?: string;
  description?: string;
  references?: Partial<IntegrationProfileReferenceSet>;
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nonEmpty(value: string | null | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function findSiteProfileReference(
  site: SiteConfiguration,
  profileType: PreparedProfileType,
): string | null {
  switch (profileType) {
    case "brand":
      return site.profiles.brandProfileReference;
    case "seo":
      return site.profiles.seoProfileReference;
    case "prompt":
      return site.profiles.promptProfileReference;
    case "image":
      return site.profiles.imageProfileReference;
  }
}

function profileTypeLabel(value: PreparedProfileType): string {
  switch (value) {
    case "brand":
      return "Brand";
    case "seo":
      return "SEO";
    case "prompt":
      return "Prompt";
    case "image":
      return "Image";
  }
}

function inferCreativeReferenceAssetId(input: {
  likedCreativeAssetIds?: readonly string[];
}): string | null {
  return input.likedCreativeAssetIds?.find((assetId) => nonEmpty(assetId)) ?? null;
}

function proposedReferences(input: {
  site: SiteConfiguration;
  profileType: PreparedProfileType;
  likedCreativeAssetId: string | null;
  brandProfileId: string;
}): Partial<IntegrationProfileReferenceSet> {
  const identity = `${slugify(input.site.organizationId)}-${slugify(input.site.slug)}`;
  switch (input.profileType) {
    case "brand":
      return {
        logoReference: input.likedCreativeAssetId
          ? `site-intelligence-asset:${input.likedCreativeAssetId}`
          : `logo-owner-supplied-${identity}`,
        colorPaletteReference: `palette-${identity}-dark-navy-electric-cyan-v1`,
        typographyReference: `typography-${identity}-modern-high-legibility-v1`,
        voiceReference: `voice-${identity}-local-business-growth-v1`,
        defaultCtaReference: `cta-${identity}-book-consultation-v1`,
      };
    case "seo":
      return {
        brandReference: input.brandProfileId,
        titleStrategyReference: `titlestrategy-${identity}-local-market-v1`,
        metaStrategyReference: `metastrategy-${identity}-local-market-v1`,
        schemaReference: `schemaref-${identity}-local-business-v1`,
        openGraphReference: `ogref-${identity}-premium-local-growth-v1`,
        slugStrategyReference: `slugstrategy-${identity}-city-service-area-v1`,
        canonicalPolicyReference: `canonical-policy-${identity}-primary-domain`,
      };
    case "prompt":
      return {
        brandReference: input.brandProfileId,
        providerReference: "provider-openai-text",
        promptReference: `promptref-${identity}-local-growth-positioning-v1`,
      };
    case "image":
      return {
        brandReference: input.brandProfileId,
        providerReference: "provider-openai-image",
        promptReference: `imgpromptref-${identity}-dark-navy-cyan-local-market-v1`,
      };
  }
}

function proposedProfileMetadata(input: {
  site: SiteConfiguration;
  profileType: PreparedProfileType;
}): {
  profileId: string;
  profileName: string;
  description: string;
} {
  const brandName = input.site.displayName.trim();
  const suffixByType: Record<PreparedProfileType, string> = {
    brand: "Brand Profile",
    seo: "SEO Profile",
    prompt: "Prompt Profile",
    image: "Image Profile",
  };
  const profileName = `${brandName} ${suffixByType[input.profileType]}`;
  return {
    profileId: createOnboardingProfileId({
      organizationId: input.site.organizationId,
      profileType: input.profileType as OnboardingProfileType,
      profileName,
    }),
    profileName,
    description: `Auto-prepared ${profileTypeLabel(input.profileType)} authority for ${brandName} onboarding.`,
  };
}

function createFingerprint(input: {
  organizationId: string;
  siteId: string;
  proposals: readonly AutoPreparedProfileProposal[];
  workflow: AutoPreparedWorkflowStatus;
}): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

export function createAutoPreparedProfilesPreview(input: {
  site: SiteConfiguration;
  organizationProfiles: readonly IntegrationProfileConfiguration[];
  likedCreativeAssetIds?: readonly string[];
}): AutoPreparedProfilesPreview {
  const likedCreativeAssetId = inferCreativeReferenceAssetId({
    likedCreativeAssetIds: input.likedCreativeAssetIds,
  });
  const organizationProfiles = input.organizationProfiles.filter((profile) => (
    profile.organizationId === input.site.organizationId
    && profile.enabled
    && profile.status === "active"
  ));

  const provisionalBrandProfileId = proposedProfileMetadata({
    site: input.site,
    profileType: "brand",
  }).profileId;

  const proposals = PREPARED_PROFILE_TYPES.map((profileType): AutoPreparedProfileProposal => {
    const siteReference = findSiteProfileReference(input.site, profileType);
    const existingBySiteReference = siteReference
      ? organizationProfiles.find((profile) => (
          profile.profileId === siteReference
          && profile.profileType === profileType
        ))
      : null;
    if (existingBySiteReference) {
      return {
        profileType,
        mode: "existing",
        profileId: existingBySiteReference.profileId,
        profileName: existingBySiteReference.profileName,
        description: existingBySiteReference.description ?? "",
        references: existingBySiteReference.references,
        existingReason: "Already bound to this site.",
      };
    }

    const metadata = proposedProfileMetadata({
      site: input.site,
      profileType,
    });
    const existingByDeterministicId = organizationProfiles.find((profile) => (
      profile.profileId === metadata.profileId
      && profile.profileType === profileType
    ));
    if (existingByDeterministicId) {
      return {
        profileType,
        mode: "existing",
        profileId: existingByDeterministicId.profileId,
        profileName: existingByDeterministicId.profileName,
        description: existingByDeterministicId.description ?? "",
        references: existingByDeterministicId.references,
        existingReason: "Existing deterministic profile will be reused.",
      };
    }

    const brandProfileId = profileType === "brand"
      ? metadata.profileId
      : (existingBySiteReference?.profileId
        ?? input.site.profiles.brandProfileReference
        ?? provisionalBrandProfileId);

    return {
      profileType,
      mode: "proposed",
      profileId: metadata.profileId,
      profileName: metadata.profileName,
      description: metadata.description,
      references: proposedReferences({
        site: input.site,
        profileType,
        likedCreativeAssetId,
        brandProfileId,
      }),
      existingReason: null,
    };
  });

  const workflowConfigured = nonEmpty(input.site.integrations.workflowReference);
  const workflow: AutoPreparedWorkflowStatus = workflowConfigured
    ? {
        configured: true,
        profileId: input.site.integrations.workflowReference,
        reason: "Existing site workflow profile remains in place.",
      }
    : {
        configured: false,
        profileId: null,
        reason: "Workflow profile remains pending until an isolated, verified workflow reference is approved.",
      };

  return {
    organizationId: input.site.organizationId,
    siteId: input.site.siteId,
    fingerprint: createFingerprint({
      organizationId: input.site.organizationId,
      siteId: input.site.siteId,
      proposals,
      workflow,
    }),
    proposals,
    workflow,
  };
}

function mergeOverrides(
  proposal: AutoPreparedProfileProposal,
  overrides: Map<PreparedProfileType, AutoPreparedProfileOverride>,
): AutoPreparedProfileProposal {
  const override = overrides.get(proposal.profileType);
  if (!override || proposal.mode === "existing") {
    return proposal;
  }

  return {
    ...proposal,
    profileName: override.profileName?.trim() || proposal.profileName,
    description: override.description?.trim() || proposal.description,
    references: {
      ...proposal.references,
      ...(override.references ?? {}),
    },
  };
}

export function applyAutoPreparedProfileOverrides(input: {
  preview: AutoPreparedProfilesPreview;
  overrides?: readonly AutoPreparedProfileOverride[];
}): AutoPreparedProfileProposal[] {
  const map = new Map<PreparedProfileType, AutoPreparedProfileOverride>();
  for (const override of input.overrides ?? []) {
    if (!PREPARED_PROFILE_TYPES.includes(override.profileType)) {
      continue;
    }
    map.set(override.profileType, override);
  }
  return input.preview.proposals.map((proposal) => mergeOverrides(proposal, map));
}

export function buildNewProfileFromAutoPreparedProposal(input: {
  organizationId: string;
  proposal: AutoPreparedProfileProposal;
}) {
  return buildOnboardingProfileInput({
    organizationId: input.organizationId,
    profileType: input.proposal.profileType,
    profileName: input.proposal.profileName,
    description: input.proposal.description,
    references: input.proposal.references,
  });
}

