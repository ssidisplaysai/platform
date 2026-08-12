import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const GLW_MODULE_ID = "glw.core";

type FabricAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
}

function forbiddenResponse(reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status: 403 });
}

async function authorizeFabricControl(): Promise<FabricAuthorizeResult> {
  const session = await getGlwSession();
  if (!session) {
    return { error: unauthorizedResponse() } as const;
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: GLW_MODULE_ID,
    action: createActionReference("fabric:control", "admin_control"),
    resource: {
      workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
      moduleId: GLW_MODULE_ID,
      route: "/api/gop/dead-letters",
    },
  });

  if (!decision.allowed) {
    return { error: forbiddenResponse(decision.reason) } as const;
  }

  return { subject } as const;
}

export async function handleListDeadLetters(): Promise<NextResponse> {
  const access = await authorizeFabricControl();
  if ("error" in access) {
    return access.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  await runtime.ensureRecovered();
  const deadLetters = runtime.listDeadLetters();
  return NextResponse.json({ deadLetters });
}

export async function handleRetryDeadLetter(executionId: string): Promise<NextResponse> {
  const access = await authorizeFabricControl();
  if ("error" in access) {
    return access.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  await runtime.ensureRecovered();
  const execution = runtime.retryDeadLetter(executionId);

  if (!execution) {
    return NextResponse.json({ error: "Dead-letter entry not found." }, { status: 404 });
  }

  return NextResponse.json({ execution });
}

export async function handleArchiveDeadLetter(executionId: string): Promise<NextResponse> {
  const access = await authorizeFabricControl();
  if ("error" in access) {
    return access.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  await runtime.ensureRecovered();
  const archived = runtime.archiveDeadLetter(executionId);

  if (!archived) {
    return NextResponse.json({ error: "Dead-letter entry not found." }, { status: 404 });
  }

  return NextResponse.json({ archived: true, executionId });
}
