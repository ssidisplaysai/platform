import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";

const WORKSPACE_ID = "glw-led-display-warehouse";
const MODULE_ID = "gmp.analytics";

export type AnalyticsRoutePermissions = {
  canManageSources: boolean;
  canRunCollection: boolean;
  canValidateSource: boolean;
  canViewCapabilities: boolean;
  canViewHealth: boolean;
  canViewCollections: boolean;
  canViewCollectionDetail: boolean;
  canRetryCollection: boolean;
  canViewCollectionTimeline: boolean;
  canViewSnapshots: boolean;
  canViewConfiguration: boolean;
  canManageConfiguration: boolean;
  canViewEvidence: boolean;
  canViewEvidenceSnapshots: boolean;
  canViewCompilerRuns: boolean;
  canRunEvidenceCompiler: boolean;
  canReplayCompilation: boolean;
  canViewMetricCatalog: boolean;
  canViewRecommendations: boolean;
  canReviewRecommendations: boolean;
  canDismissRecommendations: boolean;
  canReplayRecommendationEngine: boolean;
  canViewAttribution: boolean;
  canViewRuleCatalog: boolean;
  canViewDecisionSupport: boolean;
};

export async function resolveAnalyticsPermissions(route: string): Promise<AnalyticsRoutePermissions> {
  const session = await getGlwSession();
  const subject = buildGenesisSubjectFromSession(session);
  const resolver = getGenesisAuthorizationResolver();

  const authorize = (actionId: string) => resolver.authorize({
    subject,
    workspaceId: WORKSPACE_ID,
    moduleId: MODULE_ID,
    action: createActionReference(actionId, "route_access"),
    resource: { workspaceId: WORKSPACE_ID, moduleId: MODULE_ID, route },
  }).allowed;

  const canView = authorize("gmp:analytics:view");
  if (!canView) {
    notFound();
  }

  return {
    canManageSources: authorize("gmp:analytics:manage_sources"),
    canRunCollection: authorize("gmp:analytics:run_collection"),
    canValidateSource: authorize("gmp:analytics:validate_source"),
    canViewCapabilities: authorize("gmp:analytics:view_capabilities"),
    canViewHealth: authorize("gmp:analytics:view_health"),
    canViewCollections: authorize("gmp:analytics:view_collections"),
    canViewCollectionDetail: authorize("gmp:analytics:view_collection_detail"),
    canRetryCollection: authorize("gmp:analytics:retry_collection"),
    canViewCollectionTimeline: authorize("gmp:analytics:view_collection_timeline"),
    canViewSnapshots: authorize("gmp:analytics:view_snapshots"),
    canViewConfiguration: authorize("gmp:analytics:view_configuration"),
    canManageConfiguration: authorize("gmp:analytics:manage_configuration"),
    canViewEvidence: authorize("gmp:evidence:view"),
    canViewEvidenceSnapshots: authorize("gmp:evidence:view_snapshots"),
    canViewCompilerRuns: authorize("gmp:evidence:view_compiler_runs"),
    canRunEvidenceCompiler: authorize("gmp:evidence:run_compiler"),
    canReplayCompilation: authorize("gmp:evidence:replay_compilation"),
    canViewMetricCatalog: authorize("gmp:evidence:view_metric_catalog"),
    canViewRecommendations: authorize("gmp:recommendations:view"),
    canReviewRecommendations: authorize("gmp:recommendations:review"),
    canDismissRecommendations: authorize("gmp:recommendations:dismiss"),
    canReplayRecommendationEngine: authorize("gmp:recommendations:replay"),
    canViewAttribution: authorize("gmp:recommendations:view_attribution"),
    canViewRuleCatalog: authorize("gmp:recommendations:view_rule_catalog"),
    canViewDecisionSupport: authorize("gmp:recommendations:view_decision_support"),
  };
}
