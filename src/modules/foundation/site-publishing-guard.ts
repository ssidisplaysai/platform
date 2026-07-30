import type { PermissionAction, SiteConfiguration } from "./types";
import { evaluateSiteReadiness } from "./site-readiness";

export function evaluatePublishingGuard(input: {
  site: SiteConfiguration;
  permissions: Set<PermissionAction>;
  organizationActive: boolean;
}): {
  allowed: boolean;
  reasons: readonly string[];
} {
  const readiness = evaluateSiteReadiness({
    site: input.site,
    organizationActive: input.organizationActive,
    requiredPermission: "sites:manage_integrations",
    permissions: input.permissions,
    intent: "publish",
    requireWorkflowReference: true,
  });

  return {
    allowed: readiness.ready,
    reasons: readiness.blockingReasons,
  };
}
