import type { IntegrationProfileConfiguration } from "../types";
import {
  hydrateExistingAuthorityProfileSelection,
} from "../FreshSiteOnboardingFlow";

function profile(input: {
  profileId: string;
  profileType: IntegrationProfileConfiguration["profileType"];
  organizationId?: string;
  status?: IntegrationProfileConfiguration["status"];
  enabled?: boolean;
}): IntegrationProfileConfiguration {
  return {
    profileId: input.profileId,
    profileType: input.profileType,
    organizationId: input.organizationId ?? "ssi",
    profileName: input.profileId,
    description: null,
    status: input.status ?? "active",
    enabled: input.enabled ?? true,
    version: "1.0.0",
    assignedSiteIds: [],
    defaultForOrganization: false,
    references: {},
    notes: null,
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  } as IntegrationProfileConfiguration;
}

describe("existing authority profile prepopulation", () => {
  test("prepopulates all five selectors when stored references are active and registered", () => {
    const selection = {
      seoProfileReference: "",
      promptProfileReference: "",
      imageProfileReference: "",
      brandProfileReference: "",
      workflowReference: "",
    };

    const site = {
      profiles: {
        seoProfileReference: "profile-seo-projectorenclosure-default",
        promptProfileReference: "profile-prompt-projectorenclosure-product",
        imageProfileReference: "profile-image-projectorenclosure-product",
        brandProfileReference: "profile-brand-projectorenclosure-default",
      },
      integrations: {
        workflowReference: "profile-workflow-projectorenclosure-site-studio",
      },
    };

    const profiles: IntegrationProfileConfiguration[] = [
      profile({ profileId: "profile-seo-projectorenclosure-default", profileType: "seo" }),
      profile({ profileId: "profile-prompt-projectorenclosure-product", profileType: "prompt" }),
      profile({ profileId: "profile-image-projectorenclosure-product", profileType: "image" }),
      profile({ profileId: "profile-brand-projectorenclosure-default", profileType: "brand" }),
      profile({ profileId: "profile-workflow-projectorenclosure-site-studio", profileType: "workflow" }),
    ];

    expect(hydrateExistingAuthorityProfileSelection(selection, site, profiles)).toEqual({
      seoProfileReference: "profile-seo-projectorenclosure-default",
      promptProfileReference: "profile-prompt-projectorenclosure-product",
      imageProfileReference: "profile-image-projectorenclosure-product",
      brandProfileReference: "profile-brand-projectorenclosure-default",
      workflowReference: "profile-workflow-projectorenclosure-site-studio",
    });
  });

  test("leaves invalid or missing stored references unresolved while keeping valid ones", () => {
    const selection = {
      seoProfileReference: "",
      promptProfileReference: "",
      imageProfileReference: "",
      brandProfileReference: "",
      workflowReference: "",
    };

    const site = {
      profiles: {
        seoProfileReference: "profile-seo-projectorenclosure-default",
        promptProfileReference: "profile-prompt-projectorenclosure-product",
        imageProfileReference: "profile-image-missing",
        brandProfileReference: "profile-brand-projectorenclosure-default",
      },
      integrations: {
        workflowReference: "profile-workflow-projectorenclosure-site-studio",
      },
    };

    const profiles: IntegrationProfileConfiguration[] = [
      profile({ profileId: "profile-seo-projectorenclosure-default", profileType: "seo" }),
      profile({ profileId: "profile-prompt-projectorenclosure-product", profileType: "prompt" }),
      profile({ profileId: "profile-brand-projectorenclosure-default", profileType: "brand" }),
      profile({ profileId: "profile-workflow-projectorenclosure-site-studio", profileType: "workflow" }),
    ];

    expect(hydrateExistingAuthorityProfileSelection(selection, site, profiles)).toEqual({
      seoProfileReference: "profile-seo-projectorenclosure-default",
      promptProfileReference: "profile-prompt-projectorenclosure-product",
      imageProfileReference: "",
      brandProfileReference: "profile-brand-projectorenclosure-default",
      workflowReference: "profile-workflow-projectorenclosure-site-studio",
    });
  });

  test("does not auto-substitute organization defaults when stored site reference is invalid", () => {
    const selection = {
      seoProfileReference: "",
      promptProfileReference: "",
      imageProfileReference: "",
      brandProfileReference: "",
      workflowReference: "",
    };

    const site = {
      profiles: {
        seoProfileReference: "profile-seo-missing",
        promptProfileReference: null,
        imageProfileReference: null,
        brandProfileReference: null,
      },
      integrations: {
        workflowReference: null,
      },
    };

    const profiles: IntegrationProfileConfiguration[] = [
      profile({ profileId: "profile-seo-ssi-default", profileType: "seo" }),
      profile({ profileId: "profile-prompt-ssi-default", profileType: "prompt" }),
      profile({ profileId: "profile-image-ssi-default", profileType: "image" }),
      profile({ profileId: "profile-brand-ssi-default", profileType: "brand" }),
      profile({ profileId: "profile-workflow-ssi-default", profileType: "workflow" }),
    ];

    expect(hydrateExistingAuthorityProfileSelection(selection, site, profiles)).toEqual(selection);
  });

  test("keeps fresh/no-site selection unchanged and does not mutate inputs", () => {
    const selection = {
      seoProfileReference: "",
      promptProfileReference: "",
      imageProfileReference: "",
      brandProfileReference: "",
      workflowReference: "",
    };

    const selectionClone = { ...selection };
    const profiles: IntegrationProfileConfiguration[] = [
      profile({ profileId: "profile-seo-ssi-default", profileType: "seo" }),
    ];

    const result = hydrateExistingAuthorityProfileSelection(selection, null, profiles);

    expect(result).toEqual(selection);
    expect(selection).toEqual(selectionClone);
    expect(profiles).toHaveLength(1);
  });
});
