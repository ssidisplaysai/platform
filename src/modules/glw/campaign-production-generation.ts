import "server-only";

import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveGlwCampaignGenerationContext } from "@/modules/glw/campaign-generation-context";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import type { GlwCampaign } from "@/modules/glw/campaign-types";
import {
  adaptProductForGeneration,
  adaptSiteForGeneration,
  createDefaultGlwGenerationInput,
} from "@/modules/glw/page-generation";

export function buildGlwCampaignProductionGenerationForm(input: {
  campaign: GlwCampaign;
  stateCode: string;
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
  const form = createDefaultGlwGenerationInput(
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

  // Production campaign execution remains draft-only until publication authority
  // is separately certified. The campaign publication policy is intentionally not
  // allowed to override this boundary.
  form.publicationIntent = "draft";
  form.plannedOperation = "CREATE_STATE";

  const generationContext = resolveGlwCampaignGenerationContext({
    campaignId: input.campaign.campaignId,
    referencePage: false,
  });

  if (!generationContext) {
    throw new Error("Approved campaign generation guidance could not be resolved.");
  }

  form.additionalInstructions = generationContext.additionalInstructions;
  form.imageDirection = generationContext.imageDirection;
  form.campaignId = input.campaign.campaignId;

  return {
    state,
    form,
  };
}
