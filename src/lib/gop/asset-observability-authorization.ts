import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { getGenesisAuthorizationService } from "@/platform/gop/auth/authorization";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";
import type { GenesisSessionLike } from "@/platform/gop/auth/authentication";

const ASSET_MODULE_ID = "platform.assets";

export const ASSET_OBSERVABILITY_ACTIONS = {
  health: "assets:health:view",
  metrics: "assets:metrics:view",
} as const;

export type AssetObservabilityAction = (typeof ASSET_OBSERVABILITY_ACTIONS)[keyof typeof ASSET_OBSERVABILITY_ACTIONS];

export function authorizeAssetObservability(input: {
  session: GenesisSessionLike | null;
  action: AssetObservabilityAction | string;
  route: string;
}): {
  allowed: boolean;
  reason: string;
  reasonCode: string;
  deniedCount: number;
} {
  const subject = buildGenesisSubjectFromSession(input.session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: ASSET_MODULE_ID,
    action: createActionReference(input.action, "route_access"),
    resource: {
      workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
      moduleId: ASSET_MODULE_ID,
      route: input.route,
    },
  });

  return {
    allowed: decision.allowed,
    reason: decision.reason,
    reasonCode: decision.reasonCode,
    deniedCount: getGenesisAuthorizationService().getMetrics().deniedCount,
  };
}
