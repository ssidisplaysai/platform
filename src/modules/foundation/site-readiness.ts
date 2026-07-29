import type {
  PermissionAction,
  SiteActionIntent,
  SiteConfiguration,
  SiteReadinessCondition,
  SiteReadinessResult,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function profilesConfigured(site: SiteConfiguration): boolean {
  return Boolean(
    site.profiles.promptProfileReference &&
      site.profiles.imageProfileReference &&
      site.profiles.seoProfileReference &&
      site.profiles.brandProfileReference,
  );
}

function lifecyclePermits(site: SiteConfiguration, action: SiteActionIntent): boolean {
  if (site.lifecycleState === "archived" || site.lifecycleState === "suspended") {
    return false;
  }

  if (action === "publish") {
    return site.lifecycleState === "active";
  }

  return site.lifecycleState === "active" || site.lifecycleState === "configuring" || site.lifecycleState === "draft";
}

function environmentPermits(site: SiteConfiguration, action: SiteActionIntent): boolean {
  if (action !== "publish") {
    return true;
  }

  return site.environment === "production" || site.environment === "staging" || site.environment === "test";
}

export function evaluateSiteReadiness(input: {
  site: SiteConfiguration;
  organizationActive: boolean;
  requiredPermission: PermissionAction;
  permissions: Set<PermissionAction>;
  intent: SiteActionIntent;
  requireWorkflowReference: boolean;
}): SiteReadinessResult {
  const conditions: SiteReadinessCondition[] = [
    {
      key: "site_enabled",
      passed: input.site.enabled,
      details: input.site.enabled ? "Site is enabled." : "Site is disabled.",
    },
    {
      key: "lifecycle_permits_operation",
      passed: lifecyclePermits(input.site, input.intent),
      details: `Lifecycle state is ${input.site.lifecycleState}.`,
    },
    {
      key: "domain_present",
      passed: Boolean(input.site.domain),
      details: input.site.domain ? `Domain: ${input.site.domain}` : "Domain is not configured.",
    },
    {
      key: "wordpress_api_present",
      passed: Boolean(input.site.integrations.wordpressApiBaseUrl),
      details: input.site.integrations.wordpressApiBaseUrl
        ? "WordPress API base URL configured."
        : "WordPress API base URL is missing.",
    },
    {
      key: "credential_reference_present",
      passed: Boolean(input.site.integrations.wordpressCredentialReference),
      details: input.site.integrations.wordpressCredentialReference
        ? "WordPress credential reference configured."
        : "WordPress credential reference is missing.",
    },
    {
      key: "workflow_reference_present",
      passed: input.requireWorkflowReference
        ? Boolean(input.site.integrations.workflowReference)
        : true,
      details: input.requireWorkflowReference
        ? input.site.integrations.workflowReference
          ? "Workflow reference configured."
          : "Workflow reference is required and missing."
        : "Workflow reference is optional for this intent.",
    },
    {
      key: "health_acceptable",
      passed:
        input.site.healthStatus === "healthy" ||
        input.site.healthStatus === "degraded",
      details: `Health state is ${input.site.healthStatus}.`,
    },
    {
      key: "environment_permits_action",
      passed: environmentPermits(input.site, input.intent),
      details: `Environment is ${input.site.environment}.`,
    },
    {
      key: "publishing_state_permits_action",
      passed:
        input.intent !== "publish" || input.site.publishingStatus === "ready",
      details: `Publishing status is ${input.site.publishingStatus}.`,
    },
    {
      key: "profiles_present",
      passed: profilesConfigured(input.site),
      details: profilesConfigured(input.site)
        ? "Required profile references are configured."
        : "One or more required profile references are missing.",
    },
    {
      key: "organization_active",
      passed: input.organizationActive,
      details: input.organizationActive
        ? "Organization is active."
        : "Organization is not active.",
    },
    {
      key: "user_has_site_permission",
      passed: input.permissions.has(input.requiredPermission),
      details: input.permissions.has(input.requiredPermission)
        ? `Permission ${input.requiredPermission} granted.`
        : `Permission ${input.requiredPermission} missing.`,
    },
  ];

  const blockingReasons = conditions
    .filter((condition) => !condition.passed)
    .map((condition) => condition.details);

  const warnings: string[] = [];
  if (input.site.healthStatus === "degraded") {
    warnings.push("Site health is degraded. Publishing should be carefully reviewed.");
  }

  const ready = blockingReasons.length === 0;

  return {
    ready,
    status: ready ? "ready" : warnings.length > 0 ? "warning" : "blocked",
    blockingReasons,
    warnings,
    checkedConditions: conditions,
    checkedAt: nowIso(),
  };
}
