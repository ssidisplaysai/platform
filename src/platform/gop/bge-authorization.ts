import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const BGE_MODULE_ID = "bge.runtime";

export type BgeAction =
  | "bge:evidence:create"
  | "bge:object:view"
  | "bge:proposal:create"
  | "bge:approval:decide"
  | "bge:relationship:view"
  | "bge:timeline:view";

export type BgeAuthorizationDependencies = {
  sessionLoader?: typeof getGlwSession;
};

export type BgeAuthorizationResult =
  | { error: Response }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession>; workspaceId: string; moduleId: string };

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function workspaceFromRequest(request: Request, tenantId?: string): string {
  const url = new URL(request.url);
  return url.searchParams.get("workspaceId") ?? tenantId ?? DEFAULT_WORKSPACE_ID;
}

export async function authorizeBgeAction(input: {
  request: Request;
  actionId: BgeAction;
  route: string;
  tenantId?: string;
  dependencies?: BgeAuthorizationDependencies;
}): Promise<BgeAuthorizationResult> {
  const sessionLoader = input.dependencies?.sessionLoader ?? getGlwSession;
  const session = await sessionLoader();
  if (!session) {
    return { error: json({ error: "GLW session is required." }, 401) };
  }

  const workspaceId = workspaceFromRequest(input.request, input.tenantId);
  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId,
    moduleId: BGE_MODULE_ID,
    action: createActionReference(input.actionId, "route_access"),
    resource: {
      workspaceId,
      moduleId: BGE_MODULE_ID,
      route: input.route,
    },
  });

  if (!decision.allowed) {
    return { error: json({ error: decision.reason }, 403) };
  }

  return { subject, workspaceId, moduleId: BGE_MODULE_ID };
}

export function getBgeModuleId(): string {
  return BGE_MODULE_ID;
}