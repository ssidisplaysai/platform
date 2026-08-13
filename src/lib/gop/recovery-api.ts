import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { createJobRecoveryService } from "@/lib/runtime/job-recovery";
import { logRecoveryTrace } from "@/lib/gop/recovery-trace";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const GLW_MODULE_ID = "glw.core";

type RecoveryAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

const MANUAL_ADJUDICATION_ACTION = "job:manual_adjudicate";

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

async function authorizeManualAdjudication(): Promise<RecoveryAuthorizeResult> {
  const session = await getGlwSession();
  if (!session) {
    return { error: unauthorizedResponse() };
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: GLW_MODULE_ID,
    action: createActionReference(MANUAL_ADJUDICATION_ACTION, "job_action"),
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

export async function handleAdjudicateManualReview(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as {
    jobId?: string;
    decision?: "MARK_FAILED";
    reason?: string;
    idempotencyKey?: string;
    workspaceId?: string;
    moduleId?: string;
  } | null;

  if (!body || !body.jobId || !body.decision || !body.reason || !body.idempotencyKey) {
    return NextResponse.json({ error: "jobId, decision, reason, and idempotencyKey are required." }, { status: 400 });
  }

  const access = await authorizeManualAdjudication();
  if ("error" in access) {
    return access.error;
  }

  try {
    const service = createJobRecoveryService();
    const result = await service.adjudicateManualReview({
      actorId: access.subject.actorId,
      jobId: body.jobId,
      decision: body.decision,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      workspaceId: body.workspaceId ?? GENESIS_PRIMARY_WORKSPACE_ID,
      moduleId: body.moduleId ?? GLW_MODULE_ID,
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manual adjudication failed." },
      { status: 400 },
    );
  }
}

export async function handleExecuteRecovery(request: Request): Promise<NextResponse> {
  const traceId = request.headers.get("x-glw-recovery-trace-id") ?? `recovery_trace_${Math.random().toString(16).slice(2)}`;
  const body = await request.json().catch(() => null) as {
    mode?: "RECOVER_SELECTED_SAFE" | "RECOVER_ALL_SAFE";
    selectedJobIds?: string[];
    dryRun?: boolean;
    approvalToken?: string;
    reason?: string;
  } | null;

  const rawDryRun = body?.dryRun;
  const routeResolvedDryRun = body?.dryRun ?? true;
  const mode = body?.mode ?? "RECOVER_ALL_SAFE";
  const dryRun = routeResolvedDryRun;

  logRecoveryTrace(traceId, "ROUTE_PARSED_BODY", rawDryRun, {
    boundary: "ROUTE_PARSED_BODY",
    authenticated: false,
    approvalTokenPresent: Boolean(body?.approvalToken),
    writeAuthorizationEntered: false,
    approvalGateEntered: false,
    persistenceBranchEntered: false,
  });
  logRecoveryTrace(traceId, "ROUTE_RESOLVED_DRYRUN", routeResolvedDryRun, {
    boundary: "ROUTE_RESOLVED_DRYRUN",
    authenticated: false,
    approvalTokenPresent: Boolean(body?.approvalToken),
    writeAuthorizationEntered: false,
    approvalGateEntered: false,
    persistenceBranchEntered: false,
  });

  if (!dryRun) {
    const access = await authorizeRecoveryWrite();
    logRecoveryTrace(traceId, "WRITE_AUTHORIZATION_BRANCH", dryRun, {
      boundary: "WRITE_AUTHORIZATION_BRANCH",
      authenticated: "error" in access ? false : true,
      approvalTokenPresent: Boolean(body?.approvalToken),
      writeAuthorizationEntered: true,
      approvalGateEntered: false,
      persistenceBranchEntered: false,
    });

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
        traceId,
      });
      logRecoveryTrace(traceId, "ROUTE_RESULT_DRYRUN", result.dryRun, {
        boundary: "ROUTE_RESULT_DRYRUN",
        authenticated: true,
        approvalTokenPresent: Boolean(body?.approvalToken),
        writeAuthorizationEntered: true,
        approvalGateEntered: Boolean(body?.approvalToken),
        persistenceBranchEntered: result.dryRun === false,
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
  logRecoveryTrace(traceId, "READ_AUTHORIZATION_BRANCH", dryRun, {
    boundary: "READ_AUTHORIZATION_BRANCH",
    authenticated: "error" in access ? false : true,
    approvalTokenPresent: Boolean(body?.approvalToken),
    writeAuthorizationEntered: false,
    approvalGateEntered: false,
    persistenceBranchEntered: false,
  });

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
    traceId,
  });
  logRecoveryTrace(traceId, "ROUTE_RESULT_DRYRUN", result.dryRun, {
    boundary: "ROUTE_RESULT_DRYRUN",
    authenticated: true,
    approvalTokenPresent: Boolean(body?.approvalToken),
    writeAuthorizationEntered: false,
    approvalGateEntered: false,
    persistenceBranchEntered: false,
  });

  return NextResponse.json({ result });
}
