import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { createJobRecoveryService } from "@/lib/runtime/job-recovery";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const GLW_MODULE_ID = "glw.core";

type RecoveryAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
}

function forbiddenResponse(reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status: 403 });
}

async function authorizeRecoveryRead(): Promise<RecoveryAuthorizeResult> {
  const session = await getGlwSession();
  if (!session) {
    return { error: unauthorizedResponse() };
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: GLW_MODULE_ID,
    action: createActionReference("metrics:view", "metrics_access"),
    resource: {
      workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
      moduleId: GLW_MODULE_ID,
      route: "/glw/operations",
    },
  });

  if (!decision.allowed) {
    return { error: forbiddenResponse(decision.reason) };
  }

  return { subject };
}

async function authorizeRecoveryWrite(): Promise<RecoveryAuthorizeResult> {
  const session = await getGlwSession();
  if (!session) {
    return { error: unauthorizedResponse() };
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: GLW_MODULE_ID,
    action: createActionReference("job:retry", "job_action"),
    resource: {
      workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
      moduleId: GLW_MODULE_ID,
      route: "/glw/operations",
    },
  });

  if (!decision.allowed) {
    return { error: forbiddenResponse(decision.reason) };
  }

  return { subject };
}

export async function handleGetRecoveryAudit(): Promise<NextResponse> {
  const access = await authorizeRecoveryRead();
  if ("error" in access) {
    return access.error;
  }

  const service = createJobRecoveryService();
  const audit = await service.runAudit();
  return NextResponse.json({ audit });
}

export async function handleExecuteRecovery(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as {
    mode?: "RECOVER_SELECTED_SAFE" | "RECOVER_ALL_SAFE";
    selectedJobIds?: string[];
    dryRun?: boolean;
    approvalToken?: string;
    reason?: string;
  } | null;

  const mode = body?.mode ?? "RECOVER_ALL_SAFE";
  const dryRun = body?.dryRun ?? true;

  if (!dryRun) {
    const access = await authorizeRecoveryWrite();
    if ("error" in access) {
      return access.error;
    }

    try {
      const service = createJobRecoveryService();
      const result = await service.executeRecovery({
        actorId: access.subject.actorId,
        mode,
        selectedJobIds: body?.selectedJobIds,
        reason: body?.reason,
        approvalToken: body?.approvalToken,
        dryRun,
      });
      return NextResponse.json({ result });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Recovery execution failed." },
        { status: 400 },
      );
    }
  }

  const access = await authorizeRecoveryRead();
  if ("error" in access) {
    return access.error;
  }

  const service = createJobRecoveryService();
  const result = await service.executeRecovery({
    actorId: access.subject.actorId,
    mode,
    selectedJobIds: body?.selectedJobIds,
    reason: body?.reason,
    dryRun: true,
  });

  return NextResponse.json({ result });
}
