import type { SiteConfiguration } from "./types";

export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

function hasConfigurationSelections(site: SiteConfiguration): boolean {
  return Boolean(
    site.profiles.seoProfileReference
      && site.profiles.promptProfileReference
      && site.profiles.imageProfileReference
      && site.profiles.brandProfileReference
      && site.integrations.workflowReference,
  );
}

export function resolveOnboardingResumeStep(site: SiteConfiguration): OnboardingStep {
  if (!site.primaryAddress) {
    return 2;
  }

  const onboardingStatus = site.onboarding?.status ?? "not_started";
  const hasCredential = Boolean(site.integrations.wordpressCredentialReference);
  if (!hasCredential || onboardingStatus === "not_started") {
    return 3;
  }

  if (!hasConfigurationSelections(site)) {
    return 4;
  }

  return 5;
}

export function isOnboardingResumable(site: SiteConfiguration): boolean {
  return resolveOnboardingResumeStep(site) < 5;
}

