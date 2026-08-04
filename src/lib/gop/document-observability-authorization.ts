import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { getGenesisAuthorizationService } from "@/platform/gop/auth/authorization";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";
import type { GenesisSessionLike } from "@/platform/gop/auth/authentication";

const DOCUMENT_MODULE_ID = "platform.documents";

export const DOCUMENT_OBSERVABILITY_ACTIONS = {
  health: "documents:health:view",
  metrics: "documents:metrics:view",
} as const;

export type DocumentObservabilityAction =
  (typeof DOCUMENT_OBSERVABILITY_ACTIONS)[keyof typeof DOCUMENT_OBSERVABILITY_ACTIONS];

export function authorizeDocumentObservability(input: {
  session: GenesisSessionLike | null;
  action: DocumentObservabilityAction | string;
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
    moduleId: DOCUMENT_MODULE_ID,
    action: createActionReference(input.action, "route_access"),
    resource: {
      workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
      moduleId: DOCUMENT_MODULE_ID,
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
