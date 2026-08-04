import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { getGenesisAuthorizationService } from "@/platform/gop/auth/authorization";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";
import type { GenesisSessionLike } from "@/platform/gop/auth/authentication";

const CONTACT_MODULE_ID = "platform.contact";

export const CONTACT_OBSERVABILITY_ACTIONS = {
  health: "contact:health:view",
  metrics: "contact:metrics:view",
} as const;

export type ContactObservabilityAction = (typeof CONTACT_OBSERVABILITY_ACTIONS)[keyof typeof CONTACT_OBSERVABILITY_ACTIONS];

export function authorizeContactObservability(input: {
  session: GenesisSessionLike | null;
  action: ContactObservabilityAction | string;
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
    moduleId: CONTACT_MODULE_ID,
    action: createActionReference(input.action, "route_access"),
    resource: {
      workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
      moduleId: CONTACT_MODULE_ID,
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
