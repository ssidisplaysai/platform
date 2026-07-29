import type {
  IntegrationProfileConfiguration,
  IntegrationProfileReadinessCondition,
  IntegrationProfileReadinessResult,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function statusPermits(profile: IntegrationProfileConfiguration): boolean {
  return profile.status === "active";
}

function nonEmpty(value: string | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function evaluateIntegrationProfileReadiness(input: {
  profile: IntegrationProfileConfiguration;
  profileLookup: Map<string, IntegrationProfileConfiguration>;
}): IntegrationProfileReadinessResult {
  const { profile, profileLookup } = input;
  const conditions: IntegrationProfileReadinessCondition[] = [
    {
      key: "profile_enabled",
      passed: profile.enabled,
      details: profile.enabled ? "Profile is enabled." : "Profile is disabled.",
    },
    {
      key: "status_permits_operation",
      passed: statusPermits(profile),
      details: `Profile status is ${profile.status}.`,
    },
    {
      key: "version_present",
      passed: nonEmpty(profile.version),
      details: nonEmpty(profile.version) ? `Version ${profile.version} configured.` : "Version is missing.",
    },
  ];

  if (profile.profileType === "wordpress") {
    conditions.push(
      {
        key: "wordpress_base_url_reference_present",
        passed: nonEmpty(profile.references.baseUrlReference),
        details: nonEmpty(profile.references.baseUrlReference)
          ? "WordPress base URL reference configured."
          : "WordPress base URL reference is missing.",
      },
      {
        key: "wordpress_credential_reference_present",
        passed: nonEmpty(profile.references.credentialReference),
        details: nonEmpty(profile.references.credentialReference)
          ? "WordPress credential reference configured."
          : "WordPress credential reference is missing.",
      },
    );
  }

  if (profile.profileType === "workflow") {
    conditions.push(
      {
        key: "workflow_reference_present",
        passed: nonEmpty(profile.references.workflowReference),
        details: nonEmpty(profile.references.workflowReference)
          ? "Workflow reference configured."
          : "Workflow reference is missing.",
      },
      {
        key: "provider_reference_present",
        passed: nonEmpty(profile.references.providerReference),
        details: nonEmpty(profile.references.providerReference)
          ? "Provider reference configured."
          : "Provider reference is missing.",
      },
      {
        key: "retry_policy_reference_present",
        passed: nonEmpty(profile.references.retryPolicyReference),
        details: nonEmpty(profile.references.retryPolicyReference)
          ? "Retry policy reference configured."
          : "Retry policy reference is missing.",
      },
      {
        key: "execution_timeout_reference_present",
        passed: nonEmpty(profile.references.executionTimeoutReference),
        details: nonEmpty(profile.references.executionTimeoutReference)
          ? "Execution timeout reference configured."
          : "Execution timeout reference is missing.",
      },
    );
  }

  if (profile.profileType === "prompt") {
    conditions.push(
      {
        key: "prompt_reference_present",
        passed: nonEmpty(profile.references.promptReference),
        details: nonEmpty(profile.references.promptReference)
          ? "Prompt reference configured."
          : "Prompt reference is missing.",
      },
      {
        key: "provider_reference_present",
        passed: nonEmpty(profile.references.providerReference),
        details: nonEmpty(profile.references.providerReference)
          ? "Provider reference configured."
          : "Provider reference is missing.",
      },
    );
  }

  if (profile.profileType === "image") {
    conditions.push(
      {
        key: "image_provider_reference_present",
        passed: nonEmpty(profile.references.providerReference),
        details: nonEmpty(profile.references.providerReference)
          ? "Image provider reference configured."
          : "Image provider reference is missing.",
      },
      {
        key: "prompt_reference_present",
        passed: nonEmpty(profile.references.promptReference),
        details: nonEmpty(profile.references.promptReference)
          ? "Image prompt reference configured."
          : "Image prompt reference is missing.",
      },
    );
  }

  if (profile.profileType === "seo") {
    conditions.push(
      {
        key: "seo_title_strategy_present",
        passed: nonEmpty(profile.references.titleStrategyReference),
        details: nonEmpty(profile.references.titleStrategyReference)
          ? "Title strategy reference configured."
          : "Title strategy reference is missing.",
      },
      {
        key: "seo_meta_strategy_present",
        passed: nonEmpty(profile.references.metaStrategyReference),
        details: nonEmpty(profile.references.metaStrategyReference)
          ? "Meta strategy reference configured."
          : "Meta strategy reference is missing.",
      },
      {
        key: "seo_schema_reference_present",
        passed: nonEmpty(profile.references.schemaReference),
        details: nonEmpty(profile.references.schemaReference)
          ? "Schema reference configured."
          : "Schema reference is missing.",
      },
      {
        key: "seo_open_graph_reference_present",
        passed: nonEmpty(profile.references.openGraphReference),
        details: nonEmpty(profile.references.openGraphReference)
          ? "OpenGraph reference configured."
          : "OpenGraph reference is missing.",
      },
      {
        key: "seo_slug_strategy_present",
        passed: nonEmpty(profile.references.slugStrategyReference),
        details: nonEmpty(profile.references.slugStrategyReference)
          ? "Slug strategy reference configured."
          : "Slug strategy reference is missing.",
      },
      {
        key: "seo_canonical_policy_present",
        passed: nonEmpty(profile.references.canonicalPolicyReference),
        details: nonEmpty(profile.references.canonicalPolicyReference)
          ? "Canonical policy reference configured."
          : "Canonical policy reference is missing.",
      },
    );
  }

  if (profile.profileType === "brand") {
    conditions.push(
      {
        key: "brand_logo_reference_present",
        passed: nonEmpty(profile.references.logoReference),
        details: nonEmpty(profile.references.logoReference)
          ? "Logo reference configured."
          : "Logo reference is missing.",
      },
      {
        key: "brand_palette_reference_present",
        passed: nonEmpty(profile.references.colorPaletteReference),
        details: nonEmpty(profile.references.colorPaletteReference)
          ? "Color palette reference configured."
          : "Color palette reference is missing.",
      },
      {
        key: "brand_typography_reference_present",
        passed: nonEmpty(profile.references.typographyReference),
        details: nonEmpty(profile.references.typographyReference)
          ? "Typography reference configured."
          : "Typography reference is missing.",
      },
      {
        key: "brand_voice_reference_present",
        passed: nonEmpty(profile.references.voiceReference),
        details: nonEmpty(profile.references.voiceReference)
          ? "Voice reference configured."
          : "Voice reference is missing.",
      },
      {
        key: "brand_cta_reference_present",
        passed: nonEmpty(profile.references.defaultCtaReference),
        details: nonEmpty(profile.references.defaultCtaReference)
          ? "Default CTA reference configured."
          : "Default CTA reference is missing.",
      },
    );
  }

  if (profile.profileType === "analytics") {
    conditions.push({
      key: "analytics_provider_reference_present",
      passed: nonEmpty(profile.references.providerReference),
      details: nonEmpty(profile.references.providerReference)
        ? "Analytics provider reference configured."
        : "Analytics provider reference is missing.",
    });
  }

  if (profile.profileType === "publishing") {
    const wp = profile.references.wordpressProfileReference
      ? profileLookup.get(profile.references.wordpressProfileReference)
      : null;
    const workflow = profile.references.workflowProfileReference
      ? profileLookup.get(profile.references.workflowProfileReference)
      : null;
    const prompt = profile.references.promptProfileReference
      ? profileLookup.get(profile.references.promptProfileReference)
      : null;
    const seo = profile.references.seoProfileReference
      ? profileLookup.get(profile.references.seoProfileReference)
      : null;

    conditions.push(
      {
        key: "publishing_wordpress_profile_present",
        passed: Boolean(wp?.enabled),
        details: wp?.enabled
          ? "WordPress profile is assigned and enabled."
          : "WordPress profile assignment is missing or disabled.",
      },
      {
        key: "publishing_workflow_profile_present",
        passed: Boolean(workflow?.enabled),
        details: workflow?.enabled
          ? "Workflow profile is assigned and enabled."
          : "Workflow profile assignment is missing or disabled.",
      },
      {
        key: "publishing_prompt_profile_present",
        passed: Boolean(prompt?.enabled),
        details: prompt?.enabled
          ? "Prompt profile is assigned and enabled."
          : "Prompt profile assignment is missing or disabled.",
      },
      {
        key: "publishing_seo_profile_present",
        passed: Boolean(seo?.enabled),
        details: seo?.enabled
          ? "SEO profile is assigned and enabled."
          : "SEO profile assignment is missing or disabled.",
      },
    );
  }

  const blockers = conditions
    .filter((condition) => !condition.passed)
    .map((condition) => condition.details);

  const warnings: string[] = [];
  if (profile.status === "draft") {
    warnings.push("Profile is draft and should be promoted before production usage.");
  }

  return {
    profileId: profile.profileId,
    profileType: profile.profileType,
    ready: blockers.length === 0,
    warnings,
    blockers,
    checkedConditions: conditions,
    timestamp: nowIso(),
  };
}
