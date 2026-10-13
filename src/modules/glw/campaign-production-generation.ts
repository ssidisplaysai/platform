import "server-only";

import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveGlwCampaignGenerationContext, type GlwResolvedCampaignGenerationContext } from "@/modules/glw/campaign-generation-context";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import { getGlwCampaignKnowledgePack } from "@/modules/glw/campaign-reference-repository";
import type { GlwCampaign } from "@/modules/glw/campaign-types";
import { resolveGlwReferenceGenerationAuthority } from "@/modules/glw/reference-generation-authority";
import { GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION } from "@/modules/glw/state-localization-contamination";
import {
  adaptProductForGeneration,
  adaptSiteForGeneration,
  createDefaultGlwGenerationInput,
  type GlwGenerationRequestInput,
} from "@/modules/glw/page-generation";

function normalizeCitySlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function attachGlwCampaignProductionAuthority(input: {
  form: GlwGenerationRequestInput;
  generationContext: GlwResolvedCampaignGenerationContext;
  generationAuthority: ReturnType<typeof resolveGlwReferenceGenerationAuthority>;
  productTopic: string;
  stateCode: string;
}): void {
  input.form.referenceGenerationClaimContract = input.generationContext.claimContract;
  input.form.referenceGenerationAuthority = {
    ...input.generationContext.referenceAuthority,
    productAuthority: {
      known: input.generationAuthority.productAuthorityKnown,
      path: input.generationAuthority.productAuthorityPath,
      anchorText: input.generationAuthority.productAuthorityAnchorText ?? input.productTopic,
      authorityScope: "NAVIGATION_AND_PRODUCT_IDENTITY_ONLY",
    },
    localizationPolicy: {
      version: GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION,
      expectedStateCode: input.stateCode,
      authorizedComparisonStateCodes: [],
    },
  };
  input.form.referenceAuthorityBinding = input.generationAuthority;
}

export function buildGlwCampaignProductionGenerationForm(input: {
  campaign: GlwCampaign;
  stateCode: string;
  citySlug?: string | null;
}) {
  const stateCode = input.stateCode.trim().toUpperCase();

  if (!input.campaign.stateCodes.includes(stateCode)) {
    throw new Error("Campaign target state is outside the campaign geography.");
  }

  const state = GLW_CAMPAIGN_US_STATES.find(
    (candidate) => candidate.code === stateCode,
  );

  if (!state) {
    throw new Error("Campaign target state is not recognized.");
  }

  const siteRecord = getSiteById(input.campaign.siteId);
  const productRecord = getProductById(input.campaign.productId);

  if (!siteRecord || !productRecord) {
    throw new Error("Campaign site and product must still exist.");
  }

  const profileCount = listIntegrationProfiles({
    organizationId: siteRecord.organizationId,
  }).filter(
    (profile) => profile.assignedSiteIds.includes(siteRecord.siteId),
  ).length;

  const site = adaptSiteForGeneration(siteRecord, profileCount);
  const product = adaptProductForGeneration(productRecord, site.siteId);

  let form;
  let target;

  if (input.campaign.pageType === "city_service") {
    const citySlug = normalizeCitySlug(input.citySlug ?? "");
    if (!citySlug) {
      throw new Error("City campaign target requires a city slug.");
    }

    const cityTarget = input.campaign.cityTargets?.find(
      (candidate) =>
        candidate.stateCode === stateCode
        && normalizeCitySlug(candidate.citySlug) === citySlug,
    );

    if (!cityTarget) {
      throw new Error("City campaign target is outside the campaign geography.");
    }

    form = createDefaultGlwGenerationInput(
      site,
      product,
      "city_service",
      stateCode,
      citySlug,
    );

    const title = `${product.topic} in ${cityTarget.cityName}`;
    form.title = title;
    form.seoTitle = `${title} | ${site.name}`;
    form.metaDescription = `Explore ${product.topic} solutions in ${cityTarget.cityName}, ${state.name} from ${site.name}.`;
    form.plannedOperation = "CREATE_CITY";
    target = {
      state,
      citySlug,
      cityName: cityTarget.cityName,
    };
  } else {
    form = createDefaultGlwGenerationInput(
      site,
      product,
      "state_service",
      stateCode,
      "",
    );

    const title = `${product.topic} in ${state.name}`;
    form.title = title;
    form.seoTitle = `${title} | ${site.name}`;
    form.metaDescription = `Explore ${product.topic} solutions for commercial projects in ${state.name} from ${site.name}.`;
    form.plannedOperation = "CREATE_STATE";
    target = {
      state,
      citySlug: null,
      cityName: null,
    };
  }

  // Production campaign execution remains draft-only until publication authority
  // is separately certified. The campaign publication policy is intentionally not
  // allowed to override this boundary.
  form.publicationIntent = "draft";

  const generationContext = resolveGlwCampaignGenerationContext({
    campaignId: input.campaign.campaignId,
    referencePage: false,
  });

  if (!generationContext) {
    throw new Error("Approved campaign generation guidance could not be resolved.");
  }
  const pack = getGlwCampaignKnowledgePack(input.campaign.campaignId);
  if (!pack) throw new Error("Approved campaign generation authority could not be resolved.");
  const generationAuthority = resolveGlwReferenceGenerationAuthority({
    campaign: input.campaign,
    pack,
    stateCode,
  });

  form.additionalInstructions = generationContext.additionalInstructions;
  form.imageDirection = generationContext.imageDirection;
  attachGlwCampaignProductionAuthority({ form, generationContext, generationAuthority, productTopic: product.topic, stateCode });
  form.campaignId = input.campaign.campaignId;

  return {
    ...target,
    form,
  };
}
