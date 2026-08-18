import { NextResponse } from "next/server";
import { getGlwSession } from "./auth";
import { createGlwDeliveryOperationsService, resolveGlwDeliveryAuthorizationClass, type GlwDeliveryOperatorAction } from "./callback-delivery-operations";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const MODULE_ID = "glw.delivery";
const ROUTE = "/api/glw/callback-deliveries";

export type GlwDeliveryOperationsApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  service?: ReturnType<typeof createGlwDeliveryOperationsService>;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

async function authorize(actionId: string, dependencies?: GlwDeliveryOperationsApiDependencies) {
  const session = await (dependencies?.sessionLoader ?? getGlwSession)();
  if (!session) return { error: json({ error: "GLW session is required." }, 401) } as const;
  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: MODULE_ID,
    action: createActionReference(actionId, "route_access"),
    resource: { workspaceId: GENESIS_PRIMARY_WORKSPACE_ID, moduleId: MODULE_ID, route: ROUTE },
  });
  if (!decision.allowed) return { error: json({ error: decision.reason }, 403) } as const;
  return { subject, authorizationClass: resolveGlwDeliveryAuthorizationClass(subject) } as const;
}

function actionPermission(action: GlwDeliveryOperatorAction): string {
  if (action === "APPROVE_RECOVERY" || action === "REJECT_RECOVERY") return "glw:delivery:recovery:approve";
  if (action === "REQUEST_RECOVERY") return "glw:delivery:recovery:request";
  if (action === "ACKNOWLEDGE_ESCALATION") return "glw:delivery:escalation:acknowledge";
  if (action === "ASSIGN_ESCALATION") return "glw:delivery:escalation:assign";
  if (action === "COMMENT") return "glw:delivery:comment";
  return "glw:delivery:escalation:close";
}

function safeError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Delivery operation failed.";
  const status = /STALE|ALREADY_ACTIVE|SELF_APPROVAL|NOT_ELIGIBLE|ACTIVE_LEASE|LATE_ACK/.test(message) ? 409
    : /FORBIDDEN|APPROVER_REQUIRED/.test(message) ? 403
      : /NOT_FOUND/.test(message) ? 404 : 400;
  return json({ error: message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_DATABASE_URL]") }, status);
}

export async function handleGetGlwCallbackDeliveries(request: Request, dependencies?: GlwDeliveryOperationsApiDependencies) {
  const access = await authorize("glw:delivery:view", dependencies);
  if ("error" in access) return access.error;
  const url = new URL(request.url);
  const service = dependencies?.service ?? createGlwDeliveryOperationsService();
  try {
    const idempotencyKey = url.searchParams.get("idempotencyKey");
    if (idempotencyKey) {
      const history = await service.getDeliveryHistory(idempotencyKey);
      return json({ history, permissions: permissionsFor(access.authorizationClass) });
    }
    const snapshot = await service.listDeliveries({
      limit: Number(url.searchParams.get("limit") ?? 50),
      state: url.searchParams.get("state") ?? undefined,
    });
    return json({ snapshot, permissions: permissionsFor(access.authorizationClass) });
  } catch (error) {
    return safeError(error);
  }
}

function permissionsFor(role: ReturnType<typeof resolveGlwDeliveryAuthorizationClass>) {
  return {
    canView: true,
    canOperate: role !== "VIEWER",
    canRequestRecovery: role !== "VIEWER",
    canApproveRecovery: role === "RECOVERY_APPROVER" || role === "ADMINISTRATOR",
  };
}

export async function handlePostGlwCallbackDeliveries(request: Request, dependencies?: GlwDeliveryOperationsApiDependencies) {
  const body = await request.json().catch(() => null) as {
    action?: GlwDeliveryOperatorAction;
    requestId?: string;
    reason?: string;
    idempotencyKey?: string;
    escalationId?: string;
    recoveryAuthorizationId?: string;
    expectedVersion?: number;
    assignee?: string;
  } | null;
  if (!body?.action || !body.reason) return json({ error: "action and reason are required." }, 400);
  const access = await authorize(actionPermission(body.action), dependencies);
  if ("error" in access) return access.error;
  const service = dependencies?.service ?? createGlwDeliveryOperationsService();
  try {
    const result = await service.executeAction({
      ...body,
      action: body.action,
      actorId: access.subject.actorId,
      actorRole: access.authorizationClass,
      reason: body.reason,
    });
    return json({ result });
  } catch (error) {
    return safeError(error);
  }
}
