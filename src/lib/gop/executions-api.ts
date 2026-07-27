import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { authorizeGenesisJobAction } from "@/platform/gop/actions/authorization";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import { getGenesisEventStore } from "@/platform/gop/runtime/event-store";
import type { GenesisExecution, GenesisJobStatus, GenesisJobType } from "@/platform/gop/contracts";

const GLW_WORKSPACE_ID = "glw-led-display-warehouse";
const GLW_MODULE_ID = "glw.core";

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
}

function forbiddenResponse(reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status: 403 });
}

function mapExecutionStatusToJobStatus(executionStatus: GenesisExecution["status"]): GenesisJobStatus {
  switch (executionStatus) {
    case "SUCCEEDED":
      return "COMPLETE";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    case "TIMED_OUT":
      return "TIMED_OUT";
    case "QUEUED":
      return "QUEUED";
    default:
      return "RUNNING";
  }
}

async function authorizeOperationsRead() {
  const session = await getGlwSession();
  if (!session) {
    return { error: unauthorizedResponse() } as const;
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: GLW_WORKSPACE_ID,
    moduleId: GLW_MODULE_ID,
    action: createActionReference("metrics:view", "metrics_access"),
    resource: {
      workspaceId: GLW_WORKSPACE_ID,
      moduleId: GLW_MODULE_ID,
      route: "/api/gop/executions",
    },
  });

  if (!decision.allowed) {
    return { error: forbiddenResponse(decision.reason) } as const;
  }

  return { subject } as const;
}

async function authorizeExecutionRead(execution: GenesisExecution) {
  const session = await getGlwSession();
  if (!session) {
    return { error: unauthorizedResponse() } as const;
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = authorizeGenesisJobAction({
    subject,
    workspaceId: execution.workspaceId,
    moduleId: execution.moduleId,
    jobType: (execution.jobType ?? "PAGE_GENERATION") as GenesisJobType,
    jobStatus: mapExecutionStatusToJobStatus(execution.status),
    actionId: "job:view",
    ownerActorId: subject.actorId,
  });

  if (!decision.allowed) {
    return { error: forbiddenResponse(decision.reason) } as const;
  }

  return { subject } as const;
}

function parseListQuery(url: URL): { workspaceId?: string; moduleId?: string; status?: string; q?: string; limit?: number } {
  const workspaceId = url.searchParams.get("workspaceId") ?? GLW_WORKSPACE_ID;
  const moduleId = url.searchParams.get("moduleId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const rawLimit = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(rawLimit) ? Math.min(500, Math.max(1, rawLimit)) : 100;

  return { workspaceId, moduleId, status, q, limit };
}

export async function handleGetJobExecution(jobId: string): Promise<NextResponse> {
  const access = await authorizeOperationsRead();
  if ("error" in access) {
    return access.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  await runtime.ensureRecovered();
  const execution = runtime.getExecutionByJobId(jobId);

  if (!execution) {
    return NextResponse.json({ execution: null }, { status: 200 });
  }

  const authorization = await authorizeExecutionRead(execution);
  if ("error" in authorization) {
    return authorization.error;
  }

  return NextResponse.json({ execution });
}

export async function handleListExecutions(request: Request): Promise<NextResponse> {
  const access = await authorizeOperationsRead();
  if ("error" in access) {
    return access.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  await runtime.ensureRecovered();

  const query = parseListQuery(new URL(request.url));
  const executions = query.q
    ? await runtime.searchExecutions(query)
    : await runtime.listDurableExecutions(query);

  return NextResponse.json({ executions });
}

export async function handleGetExecutionById(executionId: string): Promise<NextResponse> {
  const access = await authorizeOperationsRead();
  if ("error" in access) {
    return access.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  await runtime.ensureRecovered();

  const execution = runtime.getExecutionById(executionId);
  if (!execution) {
    return NextResponse.json({ execution: null }, { status: 200 });
  }

  const authorization = await authorizeExecutionRead(execution);
  if ("error" in authorization) {
    return authorization.error;
  }

  return NextResponse.json({ execution });
}

export async function handleGetExecutionHistory(executionId: string): Promise<NextResponse> {
  const access = await authorizeOperationsRead();
  if ("error" in access) {
    return access.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  await runtime.ensureRecovered();

  const execution = runtime.getExecutionById(executionId);
  if (!execution) {
    return NextResponse.json({ execution: null, history: [] }, { status: 200 });
  }

  const authorization = await authorizeExecutionRead(execution);
  if ("error" in authorization) {
    return authorization.error;
  }

  const history = await runtime.getExecutionHistory(executionId);
  return NextResponse.json({ execution, history });
}

export async function handleReplayExecution(request: Request, executionId: string): Promise<NextResponse> {
  const access = await authorizeOperationsRead();
  if ("error" in access) {
    return access.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  await runtime.ensureRecovered();

  const existing = runtime.getExecutionById(executionId);
  if (!existing) {
    return NextResponse.json({ execution: null, replayed: null }, { status: 200 });
  }

  const authorization = await authorizeExecutionRead(existing);
  if ("error" in authorization) {
    return authorization.error;
  }

  const sequenceParam = new URL(request.url).searchParams.get("sequence");
  const sequence = sequenceParam ? Number(sequenceParam) : undefined;
  const replayed = await runtime.replayExecution(executionId, {
    sequence: Number.isFinite(sequence) ? sequence : undefined,
    eventStore: getGenesisEventStore(),
  });

  return NextResponse.json({ execution: existing, replayed });
}
