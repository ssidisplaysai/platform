import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { authorizeGenesisJobAction } from "@/platform/gop/actions/authorization";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import { getGenesisEventStore } from "@/platform/gop/runtime/event-store";
import { createPrismaExecutionRepository } from "@/platform/gop/persistence/prisma-execution-repository";
import type { GenesisExecutionRepository } from "@/platform/gop/runtime/execution-repository";
import type { GenesisExecution, GenesisJobStatus, GenesisJobType } from "@/platform/gop/contracts";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const GLW_MODULE_ID = "glw.core";

type ExecutionsAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

type GopExecutionsApiDependencies = {
  runtime?: ReturnType<typeof getGenesisOrchestrationRuntime>;
  repository?: GenesisExecutionRepository;
  sessionLoader?: typeof getGlwSession;
};

function dependencies(input?: GopExecutionsApiDependencies) {
  return {
    runtime: input?.runtime ?? getGenesisOrchestrationRuntime(),
    repository: input?.repository ?? createPrismaExecutionRepository(),
    sessionLoader: input?.sessionLoader ?? getGlwSession,
  };
}

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

async function authorizeOperationsRead(sessionLoader: typeof getGlwSession = getGlwSession): Promise<ExecutionsAuthorizeResult> {
  const session = await sessionLoader();
  if (!session) {
    return { error: unauthorizedResponse() } as const;
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
      route: "/api/gop/executions",
    },
  });

  if (!decision.allowed) {
    return { error: forbiddenResponse(decision.reason) } as const;
  }

  return { subject } as const;
}

async function authorizeExecutionRead(execution: GenesisExecution, sessionLoader: typeof getGlwSession = getGlwSession): Promise<ExecutionsAuthorizeResult> {
  const session = await sessionLoader();
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
  const workspaceId = url.searchParams.get("workspaceId") ?? GENESIS_PRIMARY_WORKSPACE_ID;
  const moduleId = url.searchParams.get("moduleId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const rawLimit = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(rawLimit) ? Math.min(500, Math.max(1, rawLimit)) : 100;

  return { workspaceId, moduleId, status, q, limit };
}

async function loadExecutionById(
  executionId: string,
  d: ReturnType<typeof dependencies>,
): Promise<GenesisExecution | null> {
  try {
    const durable = await d.repository.loadExecution(executionId);
    if (durable) {
      return durable;
    }
  } catch {
    // Preserve the runtime fallback when durable persistence is unavailable.
  }

  await d.runtime.ensureRecovered();
  return d.runtime.getExecutionById(executionId);
}

async function loadExecutionByJobId(
  jobId: string,
  d: ReturnType<typeof dependencies>,
): Promise<GenesisExecution | null> {
  try {
    const durable = await d.repository.loadExecutionByJobId(jobId);
    if (durable) {
      return durable;
    }
  } catch {
    // Preserve the runtime fallback when durable persistence is unavailable.
  }

  await d.runtime.ensureRecovered();
  return d.runtime.getExecutionByJobId(jobId);
}

export async function handleGetJobExecution(jobId: string, input?: GopExecutionsApiDependencies): Promise<NextResponse> {
  const d = dependencies(input);
  const access = await authorizeOperationsRead(d.sessionLoader);
  if ("error" in access) {
    return access.error;
  }

  const execution = await loadExecutionByJobId(jobId, d);

  if (!execution) {
    return NextResponse.json({ execution: null }, { status: 200 });
  }

  const authorization = await authorizeExecutionRead(execution, d.sessionLoader);
  if ("error" in authorization) {
    return authorization.error;
  }

  return NextResponse.json({ execution });
}

export async function handleListExecutions(request: Request, input?: GopExecutionsApiDependencies): Promise<NextResponse> {
  const d = dependencies(input);
  const access = await authorizeOperationsRead(d.sessionLoader);
  if ("error" in access) {
    return access.error;
  }

  const runtime = d.runtime;
  await runtime.ensureRecovered();

  const query = parseListQuery(new URL(request.url));
  const executions = query.q
    ? await runtime.searchExecutions(query)
    : await runtime.listDurableExecutions(query);

  return NextResponse.json({ executions });
}

export async function handleGetExecutionById(executionId: string, input?: GopExecutionsApiDependencies): Promise<NextResponse> {
  const d = dependencies(input);
  const access = await authorizeOperationsRead(d.sessionLoader);
  if ("error" in access) {
    return access.error;
  }

  const execution = await loadExecutionById(executionId, d);
  if (!execution) {
    return NextResponse.json({ execution: null }, { status: 200 });
  }

  const authorization = await authorizeExecutionRead(execution, d.sessionLoader);
  if ("error" in authorization) {
    return authorization.error;
  }

  return NextResponse.json({ execution });
}

export async function handleGetExecutionHistory(executionId: string, input?: GopExecutionsApiDependencies): Promise<NextResponse> {
  const d = dependencies(input);
  const access = await authorizeOperationsRead(d.sessionLoader);
  if ("error" in access) {
    return access.error;
  }

  const execution = await loadExecutionById(executionId, d);
  if (!execution) {
    return NextResponse.json({ execution: null, history: [] }, { status: 200 });
  }

  const authorization = await authorizeExecutionRead(execution, d.sessionLoader);
  if ("error" in authorization) {
    return authorization.error;
  }

  let history;
  try {
    history = await d.repository.listExecutionHistory(executionId);
  } catch {
    history = await d.runtime.getExecutionHistory(executionId);
  }
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
