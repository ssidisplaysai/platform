import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createInMemoryCapabilityRegistry, type CapabilityRegistry } from "./capability-registry";
import { createInMemoryToolRegistry, type ToolRegistry } from "./tool-framework";
import { createAgentRuntimeService, type AgentRuntimeService } from "./agent-runtime";
import { createPrismaGeaRepository, createSeedAgent, type GeaRepository } from "./agent-repository";
import { geaId, nowIso, stableChecksum, type AgentMemoryReference } from "./agent-models";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_MODULE_ID = "gea.runtime";

type GeaAction =
  | "gea:agents:view"
  | "gea:agents:execute"
  | "gea:agents:replay"
  | "gea:agents:approve_plans"
  | "gea:agents:manage_capabilities"
  | "gea:agents:manage_tools"
  | "gea:agents:view_audit"
  | "gea:agents:view_memory"
  | "gea:agents:manage_context"
  | "gea:agents:view_health";

export type GeaApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: GeaRepository;
  capabilityRegistry?: CapabilityRegistry;
  toolRegistry?: ToolRegistry;
  runtimeService?: AgentRuntimeService;
};

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

function deps(input?: GeaApiDependencies): Required<GeaApiDependencies> {
  const repository = input?.repository ?? createPrismaGeaRepository();
  const capabilityRegistry = input?.capabilityRegistry ?? createInMemoryCapabilityRegistry();
  const toolRegistry = input?.toolRegistry ?? createInMemoryToolRegistry();

  return {
    sessionLoader: input?.sessionLoader ?? getGlwSession,
    repository,
    capabilityRegistry,
    toolRegistry,
    runtimeService: input?.runtimeService ?? createAgentRuntimeService({ repository, capabilityRegistry, toolRegistry }),
  };
}

type Authorized =
  | { error: NextResponse }
  | { actorId: string; role: string; allowedActions: string[]; workspaceId: string };

async function authorize(input: {
  request: Request;
  actionId: GeaAction;
  route: string;
  dependencies?: GeaApiDependencies;
}): Promise<Authorized> {
  const d = deps(input.dependencies);
  const workspaceId = workspaceFromUrl(new URL(input.request.url));
  const session = await d.sessionLoader();
  if (!session) {
    return { error: json({ error: "GLW session is required." }, 401) };
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId,
    moduleId: DEFAULT_MODULE_ID,
    action: createActionReference(input.actionId, "route_access"),
    resource: {
      workspaceId,
      moduleId: DEFAULT_MODULE_ID,
      route: input.route,
    },
  });

  if (!decision.allowed) {
    return { error: json({ error: decision.reason }, 403) };
  }

  return {
    actorId: subject.actorId,
    role: subject.role,
    allowedActions: subject.permissions,
    workspaceId,
  };
}

function parseReferences(value: unknown): AgentMemoryReference[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const ref = entry as Record<string, unknown>;
      if (typeof ref.referenceType !== "string" || typeof ref.referenceId !== "string") return null;

      return {
        memoryReferenceId: typeof ref.memoryReferenceId === "string" ? ref.memoryReferenceId : geaId("geamem"),
        referenceType: ref.referenceType as AgentMemoryReference["referenceType"],
        referenceId: ref.referenceId,
        referenceVersion: typeof ref.referenceVersion === "string" ? ref.referenceVersion : "v1",
        metadata: typeof ref.metadata === "object" && ref.metadata ? ref.metadata as Record<string, unknown> : undefined,
      };
    })
    .filter((entry): entry is AgentMemoryReference => Boolean(entry));
}

export async function handleListAgents(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:view", route: "/api/gea/agents", dependencies });
  if ("error" in access) return access.error;

  const agents = await deps(dependencies).runtimeService.listAgents(access.workspaceId);
  return json({ agents });
}

export async function handleCreateAgent(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:execute", route: "/api/gea/agents", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string") {
    return json({ error: "name is required." }, 400);
  }

  const agent = createSeedAgent({
    agentId: geaId("geaagent"),
    workspaceId: access.workspaceId,
    organizationId: typeof body.organizationId === "string" ? body.organizationId : "genesis",
    name: body.name,
    description: typeof body.description === "string" ? body.description : undefined,
    identity: {
      workspaceId: access.workspaceId,
      organizationId: typeof body.organizationId === "string" ? body.organizationId : "genesis",
      actorId: access.actorId,
      role: access.role,
    },
    capabilities: Array.isArray(body.capabilities)
      ? body.capabilities
        .filter((entry): entry is string => typeof entry === "string")
        .sort()
        .map((capabilityKey) => ({
          capabilityId: geaId("geacapbind"),
          capabilityKey,
          capabilityVersion: "gea-capability/v1",
          enabled: true,
        }))
      : [],
    permissions: access.allowedActions,
    currentVersion: {
      agentVersionId: geaId("geaver"),
      agentId: geaId("geaagentref"),
      versionTag: "v1",
      planVersion: "gea-plan/v1",
      contextVersion: "gea-context/v1",
      toolsetVersion: "gea-tool/v1",
      createdAt: nowIso(),
    },
  });

  const saved = await deps(dependencies).runtimeService.registerAgent(agent);
  return json({ agent: saved }, 201);
}

export async function handleGetAgent(request: Request, agentId: string, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:view", route: "/api/gea/agents/[id]", dependencies });
  if ("error" in access) return access.error;

  const agent = await deps(dependencies).runtimeService.getAgent(agentId);
  if (!agent || agent.workspaceId !== access.workspaceId) {
    return json({ error: "Agent not found." }, 404);
  }

  return json({ agent });
}

export async function handleCreatePlan(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:manage_context", route: "/api/gea/planning", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.agentId !== "string" || typeof body.objective !== "string") {
    return json({ error: "agentId and objective are required." }, 400);
  }

  const plan = await deps(dependencies).runtimeService.createPlan({
    agentId: body.agentId,
    workspaceId: access.workspaceId,
    objective: body.objective,
    actorId: access.actorId,
    references: parseReferences(body.references),
  });

  return json({ plan }, 201);
}

export async function handleCreateExecution(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:execute", route: "/api/gea/executions", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.agentId !== "string" || typeof body.planId !== "string") {
    return json({ error: "agentId and planId are required." }, 400);
  }

  const execution = await deps(dependencies).runtimeService.executePlan({
    agentId: body.agentId,
    workspaceId: access.workspaceId,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    planId: body.planId,
    actorId: access.actorId,
    role: access.role,
    allowedActions: access.allowedActions,
  });

  return json({ execution }, 201);
}

export async function handleListExecutions(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:view", route: "/api/gea/executions", dependencies });
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const executions = await deps(dependencies).runtimeService.listExecutions(access.workspaceId, agentId);
  return json({ executions });
}

export async function handleExecutionTimeline(request: Request, executionId: string, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:view_audit", route: "/api/gea/executions/[executionId]/timeline", dependencies });
  if ("error" in access) return access.error;

  const timeline = await deps(dependencies).runtimeService.getTimeline(executionId);
  const audit = await deps(dependencies).runtimeService.listAudits(executionId);
  return json({ timeline, audit });
}

export async function handleReplayExecution(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:replay", route: "/api/gea/replay", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.executionId !== "string") {
    return json({ error: "executionId is required." }, 400);
  }

  const replay = await deps(dependencies).runtimeService.replayExecution(body.executionId, access.actorId);
  return json({ replay }, 201);
}

export async function handleCapabilities(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:manage_capabilities", route: "/api/gea/capabilities", dependencies });
  if ("error" in access) return access.error;

  const registry = deps(dependencies).capabilityRegistry;
  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.capabilityKey !== "string") {
      return json({ error: "capabilityKey is required." }, 400);
    }

    const definition = registry.upsert({
      capabilityKey: body.capabilityKey,
      capabilityVersion: typeof body.capabilityVersion === "string" ? body.capabilityVersion : "gea-capability/v1",
      description: typeof body.description === "string" ? body.description : `${body.capabilityKey} capability`,
      toolKeys: Array.isArray(body.toolKeys) ? body.toolKeys.filter((entry): entry is string => typeof entry === "string") : [],
      enabled: body.enabled !== false,
    });

    return json({ capability: definition }, 201);
  }

  return json({ capabilities: registry.list() });
}

export async function handleTools(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:manage_tools", route: "/api/gea/tools", dependencies });
  if ("error" in access) return access.error;

  const registry = deps(dependencies).toolRegistry;
  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.toolKey !== "string" || typeof body.capabilityKey !== "string") {
      return json({ error: "toolKey and capabilityKey are required." }, 400);
    }

    const tool = registry.upsert({
      toolKey: body.toolKey,
      toolVersion: typeof body.toolVersion === "string" ? body.toolVersion : "gea-tool/v1",
      capabilityKey: body.capabilityKey,
      riskLevel: body.riskLevel === "HIGH" || body.riskLevel === "MEDIUM" ? body.riskLevel : "LOW",
      enabled: body.enabled !== false,
    });

    return json({ tool }, 201);
  }

  return json({ tools: registry.list() });
}

export async function handleApprovals(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:approve_plans", route: "/api/gea/approvals", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.executionId !== "string" || typeof body.taskId !== "string" || typeof body.decision !== "string") {
    return json({ error: "executionId, taskId, and decision are required." }, 400);
  }

  if (body.decision === "APPROVE") {
    await deps(dependencies).runtimeService.approveTask(body.executionId, body.taskId, access.actorId);
  } else if (body.decision === "REJECT") {
    await deps(dependencies).runtimeService.rejectTask(body.executionId, body.taskId, access.actorId, typeof body.reason === "string" ? body.reason : "Rejected by operator.");
  } else {
    return json({ error: "decision must be APPROVE or REJECT." }, 400);
  }

  const approvals = await deps(dependencies).runtimeService.listApprovals(body.executionId);
  return json({ approvals });
}

export async function handleAudit(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:view_audit", route: "/api/gea/audit", dependencies });
  if ("error" in access) return access.error;

  const executionId = new URL(request.url).searchParams.get("executionId");
  if (!executionId) {
    return json({ error: "executionId is required." }, 400);
  }

  const records = await deps(dependencies).runtimeService.listAudits(executionId);
  const replays = await deps(dependencies).runtimeService.listReplays(executionId);
  return json({ records, replays });
}

export async function handleMemoryReferences(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:view_memory", route: "/api/gea/memory", dependencies });
  if ("error" in access) return access.error;

  const agentId = new URL(request.url).searchParams.get("agentId");
  if (!agentId) return json({ error: "agentId is required." }, 400);

  const references = await deps(dependencies).runtimeService.listMemoryReferences(agentId);
  return json({ references });
}

export async function handleContextPreview(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:manage_context", route: "/api/gea/context/preview", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.agentId !== "string") {
    return json({ error: "agentId is required." }, 400);
  }

  const references = parseReferences(body.references);
  const preview = {
    workspaceId: access.workspaceId,
    agentId: body.agentId,
    references,
    contextVersion: "gea-context/v1",
    checksum: stableChecksum({ workspaceId: access.workspaceId, references }),
    reproducible: true,
  };

  return json({ preview });
}

export async function handleHealth(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:view_health", route: "/api/gea/health", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const agents = await d.runtimeService.listAgents(access.workspaceId);
  const executions = await d.runtimeService.listExecutions(access.workspaceId);

  return json({
    status: "HEALTHY",
    frameworkVersion: "gea-runtime/v1",
    workspaceId: access.workspaceId,
    totals: {
      agents: agents.length,
      executions: executions.length,
      activeExecutions: executions.filter((entry) => entry.state === "RUNNING" || entry.state === "WAITING_APPROVAL" || entry.state === "PAUSED").length,
    },
  });
}

export async function handleExecutionControl(request: Request, dependencies?: GeaApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:agents:execute", route: "/api/gea/executions/control", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.executionId !== "string" || typeof body.command !== "string") {
    return json({ error: "executionId and command are required." }, 400);
  }

  const runtime = deps(dependencies).runtimeService;

  if (body.command === "PAUSE") {
    const execution = await runtime.pauseExecution(body.executionId, access.actorId);
    return json({ execution });
  }

  if (body.command === "RESUME") {
    const execution = await runtime.resumeExecution(body.executionId, access.actorId, access.allowedActions);
    return json({ execution });
  }

  if (body.command === "CANCEL") {
    const execution = await runtime.cancelExecution(body.executionId, access.actorId);
    return json({ execution });
  }

  return json({ error: "command must be PAUSE, RESUME, or CANCEL." }, 400);
}
