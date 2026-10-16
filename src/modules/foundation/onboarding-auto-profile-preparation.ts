import { createHash } from "node:crypto";
import { buildOnboardingProfileInput, createOnboardingProfileId, type OnboardingProfileType } from "./onboarding-profile-creation";
import type {
  IntegrationProfileConfiguration,
  IntegrationProfileReferenceSet,
  NewIntegrationProfileInput,
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
  instructionBody: string;
  references: Partial<IntegrationProfileReferenceSet>;
  diagnostics: {
    blockers: string[];
    warnings: string[];
    references: Array<{
      key: keyof IntegrationProfileReferenceSet;
      value: string | null;
      status: "verified_asset" | "supported_inline_instruction" | "declared_provider_unverified" | "unresolved_symbolic" | "missing";
      message: string;
    }>;
  };
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
  instructionBody?: string;
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

function proposalInstructionBody(input: {
  site: SiteConfiguration;
  profileType: PreparedProfileType;
}): string {
  const primaryDomain = input.site.domain ?? "pageengines.com";
  const linesByType: Record<PreparedProfileType, string[]> = {
    brand: [
      "Positioning: PageEngines is for local-business growth.",
      "Headline: Grow Your Business Where It Matters Most.",
      "Audience: businesses throughout the United States; each campaign targets the customer's city, service area, metro, or nearby communities.",
      "Do not frame PageEngines as Sacramento-specific.",
      "Visual direction: dark navy/black foundation, electric blue/cyan accents, illuminated local-market maps, location pins, premium typography, modern responsive layout.",
      "NationwidePages.com is a separate multi-market/nationwide offering; reference contextually only.",
      "No unverified testimonials, rankings, or growth statistics.",
      "Creative references marked OWNER_SUPPLIED_REFERENCE are inspiration by default, not approved logos.",
      `Primary domain discipline: ${primaryDomain}.`,
    ],
    seo: [
      "Create accurate title tags and meta descriptions aligned to local-business growth intent.",
      "Use page-appropriate schema and canonical discipline without implying physical offices in every target city.",
      "Prioritize useful original local content and avoid duplicate doorway/location pages.",
      "Require responsive layouts and clear internal linking.",
      "Include contextual cross-link language to NationwidePages.com for businesses needing multi-market expansion.",
      "Preserve four-stage framework messaging: Target Your Area, Build Local Pages, Optimize for Search, Track and Grow.",
      "Do not include fabricated rankings, guarantees, or unverified performance claims.",
    ],
    prompt: [
      "Generate premium, original local-growth marketing copy for PageEngines.",
      "Use the four-stage framework verbatim: Target Your Area, Build Local Pages, Optimize for Search, Track and Grow.",
      "Emphasize local-market customer acquisition, visibility, and conversion pathways.",
      "Do not claim Sacramento-specific brand identity.",
      "Include contextual mention of NationwidePages.com as separate nationwide expansion solution.",
      "Treat any statistics/testimonials seen in visual references as illustrative, not factual claims.",
      "Never invent testimonials, customer logos, rankings, traffic increases, or lead guarantees.",
    ],
    image: [
      "Generate or select premium local-market imagery aligned to dark navy/cyan system.",
      "Use illuminated local maps, location pins, modern business/technology motifs, and responsive hero/support compositions.",
      "Avoid generic admin-dashboard screenshots as customer-facing marketing imagery.",
      "Avoid Sacramento-specific identifiers unless explicitly requested for a customer-specific page.",
      "Ensure accessible alternatives and image-to-section relevance.",
      "Preserve contextual cross-link support to NationwidePages.com without presenting it as already operational.",
    ],
  };
  return linesByType[input.profileType].join("\n");
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
        logoReference: null,
        assetReference: input.likedCreativeAssetId
          ? `site-intelligence-asset:${input.likedCreativeAssetId}`
          : null,
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
        promptReference: `inline:prompt-${identity}-local-growth-positioning-v1`,
      };
    case "image":
      return {
        brandReference: input.brandProfileId,
        providerReference: "provider-openai-image",
        promptReference: `inline:image-prompt-${identity}-dark-navy-cyan-local-market-v1`,
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

function deriveReferenceDiagnostics(input: {
  profileType: PreparedProfileType;
  references: Partial<IntegrationProfileReferenceSet>;
  likedCreativeAssetId: string | null;
}): AutoPreparedProfileProposal["diagnostics"] {
  const keysByType: Record<PreparedProfileType, Array<keyof IntegrationProfileReferenceSet>> = {
    brand: ["logoReference", "assetReference", "colorPaletteReference", "typographyReference", "voiceReference", "defaultCtaReference"],
    seo: ["titleStrategyReference", "metaStrategyReference", "schemaReference", "openGraphReference", "slugStrategyReference", "canonicalPolicyReference"],
    prompt: ["promptReference", "providerReference"],
    image: ["promptReference", "providerReference"],
  };
  const references = keysByType[input.profileType].map((key) => {
    const value = input.references[key] ?? null;
    if (!value) {
      return { key, value: null, status: "missing" as const, message: `${key} is missing.` };
    }
    if (key === "assetReference" && value.startsWith("site-intelligence-asset:")) {
      const expected = input.likedCreativeAssetId ? `site-intelligence-asset:${input.likedCreativeAssetId}` : null;
      return {
        key,
        value,
        status: expected && value === expected ? "verified_asset" as const : "unresolved_symbolic" as const,
        message: expected && value === expected ? "Verified against current liked creative asset." : "Asset reference is not verified against current liked creative asset.",
      };
    }
    if (key === "logoReference") {
      return {
        key,
        value,
        status: value.startsWith("logo-") ? "unresolved_symbolic" as const : "unresolved_symbolic" as const,
        message: "Logo references must point to an approved logo authority; symbolic values are not treated as approved logos.",
      };
    }
    if (key === "providerReference" && (value === "provider-openai-text" || value === "provider-openai-image")) {
      return {
        key,
        value,
        status: "declared_provider_unverified",
        message: "Provider reference is declared but operational verification is still required.",
      };
    }
    if (value.startsWith("inline:")) {
      return {
        key,
        value,
        status: "supported_inline_instruction",
        message: "Supported inline instruction reference; inspectable body is stored in profile notes.",
      };
    }
    if (value.startsWith("site-intelligence-asset:")) {
      return {
        key,
        value,
        status: "unresolved_symbolic",
        message: "Creative reference assets are inspiration by default and not automatically approved as logos.",
      };
    }
    return {
      key,
      value,
      status: "unresolved_symbolic",
      message: "Symbolic authority reference requires an explicitly resolved backing record.",
    };
  });

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (input.profileType === "brand" && !input.references.logoReference) {
    blockers.push("Approved logo authority is required before brand profile can be operationally ready.");
  }
  if (references.some((item) => item.status === "declared_provider_unverified")) {
    warnings.push("Provider references are declared but not operationally verified.");
  }
  if (references.some((item) => item.status === "unresolved_symbolic")) {
    warnings.push("Some references are symbolic and require resolution before final readiness.");
  }
  return { blockers, warnings, references };
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
      const existingInstructionBody = (existingBySiteReference.notes ?? "").trim();
      return {
        profileType,
        mode: "existing",
        profileId: existingBySiteReference.profileId,
        profileName: existingBySiteReference.profileName,
        description: existingBySiteReference.description ?? "",
        instructionBody: existingInstructionBody,
        references: existingBySiteReference.references,
        diagnostics: deriveReferenceDiagnostics({
          profileType,
          references: existingBySiteReference.references,
          likedCreativeAssetId,
        }),
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
      const existingInstructionBody = (existingByDeterministicId.notes ?? "").trim();
      return {
        profileType,
        mode: "existing",
        profileId: existingByDeterministicId.profileId,
        profileName: existingByDeterministicId.profileName,
        description: existingByDeterministicId.description ?? "",
        instructionBody: existingInstructionBody,
        references: existingByDeterministicId.references,
        diagnostics: deriveReferenceDiagnostics({
          profileType,
          references: existingByDeterministicId.references,
          likedCreativeAssetId,
        }),
        existingReason: "Existing deterministic profile will be reused.",
      };
    }

    const brandProfileId = profileType === "brand"
      ? metadata.profileId
      : (existingBySiteReference?.profileId
        ?? input.site.profiles.brandProfileReference
        ?? provisionalBrandProfileId);
    const references = proposedReferences({
      site: input.site,
      profileType,
      likedCreativeAssetId,
      brandProfileId,
    });
    const instructionBody = proposalInstructionBody({
      site: input.site,
      profileType,
    });

    return {
      profileType,
      mode: "proposed",
      profileId: metadata.profileId,
      profileName: metadata.profileName,
      description: metadata.description,
      instructionBody,
      references,
      diagnostics: deriveReferenceDiagnostics({
        profileType,
        references,
        likedCreativeAssetId,
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
    instructionBody: override.instructionBody?.trim() || proposal.instructionBody,
    references: {
      ...proposal.references,
      ...(override.references ?? {}),
    },
    diagnostics: deriveReferenceDiagnostics({
      profileType: proposal.profileType,
      references: {
        ...proposal.references,
        ...(override.references ?? {}),
      },
      likedCreativeAssetId: null,
    }),
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
}): NewIntegrationProfileInput {
  const profile = buildOnboardingProfileInput({
    organizationId: input.organizationId,
    profileType: input.proposal.profileType,
    profileName: input.proposal.profileName,
    description: input.proposal.description,
    references: input.proposal.references,
  });
  return {
    ...profile,
    notes: input.proposal.instructionBody.trim().length > 0
      ? input.proposal.instructionBody
      : profile.notes,
  };
}
