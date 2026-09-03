import "server-only";

import { evaluateSiteReadiness } from "./site-readiness";
import { updateSite } from "./site-repository";
import type { PermissionAction, SiteConfiguration } from "./types";

export type SitePublishReadinessCertificationResult = {
  certified: boolean;
  site: SiteConfiguration | null;
  blockingReasons: readonly string[];
  warnings: readonly string[];
};

export function certifySitePublishReadiness(input: {
  site: SiteConfiguration;
  organizationActive: boolean;
  permissions: Set<PermissionAction>;
}): SitePublishReadinessCertificationResult {
  const candidate: SiteConfiguration = {
    ...input.site,
    publishingStatus: "ready",
  };

  const readiness = evaluateSiteReadiness({
    site: candidate,
    organizationActive: input.organizationActive,
    requiredPermission: "sites:manage_integrations",
    permissions: input.permissions,
    intent: "publish",
    requireWorkflowReference: true,
  });

  if (!readiness.ready) {
    return {
      certified: false,
      site: null,
      blockingReasons: readiness.blockingReasons,
      warnings: readiness.warnings,
    };
  }

  const updated = updateSite(input.site.siteId, {
    publishingStatus: "ready",
  });

  if (!updated.validation.valid || !updated.site) {
    return {
      certified: false,
      site: null,
      blockingReasons: updated.validation.issues.map((issue) => issue.message),
      warnings: readiness.warnings,
    };
  }

  return {
    certified: true,
    site: updated.site,
    blockingReasons: [],
    warnings: readiness.warnings,
  };
}
