import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createSeedAgent, createInMemoryGeaRepository } from "./agent-repository";
import { createAgentRuntimeService, type AgentRuntimeService } from "./agent-runtime";
import { geaId, nowIso } from "./agent-models";
import type { WorkflowDefinition, WorkflowStep } from "./orchestration-models";
import { createInMemoryOrchestrationRepository, createPrismaOrchestrationRepository, type OrchestrationRepository } from "./orchestration-repository";
import { createOrchestrationRuntimeService, type OrchestrationRuntimeService } from "./orchestration-runtime";
import { createGeaRuntimeRegistryAuthority } from "./runtime-registry-authority";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";
const DEFAULT_MODULE_ID = "gea.orchestration";

type GeaOrchestrationAction =
  | "gea:orchestration:view_workflows"
  | "gea:orchestration:execute_workflows"
  | "gea:orchestration:cancel_workflows"
  | "gea:orchestration:pause_workflows"
  | "gea:orchestration:resume_workflows"
  | "gea:orchestration:replay_workflows"
  | "gea:orchestration:manage_workflow_definitions"
  | "gea:orchestration:view_timeline"
  | "gea:orchestration:view_health"
  | "gea:orchestration:approve_workflow_stages";

export type GeaOrchestrationApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: OrchestrationRepository;
  runtime?: OrchestrationRuntimeService;
  agentRuntime?: AgentRuntimeService;
};

type Authorized =
  | { error: NextResponse }
  | { actorId: string; role: string; workspaceId: string; organizationId: string; permissions: string[] };

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

function organizationFromUrl(url: URL): string {
  return url.searchParams.get("organizationId") ?? DEFAULT_ORGANIZATION_ID;
}

function buildDependencies(input?: GeaOrchestrationApiDependencies) {
  const repository = input?.repository ?? createPrismaOrchestrationRepository();

  const { capabilityRegistry, toolRegistry } = createGeaRuntimeRegistryAuthority();
  const geaRepository = createInMemoryGeaRepository();
  const seedAgent = createSeedAgent({
    agentId: "gea-orchestrator-agent",
    workspaceId: DEFAULT_WORKSPACE_ID,
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "Orchestration Runtime Agent",
    identity: { workspaceId: DEFAULT_WORKSPACE_ID, organizationId: DEFAULT_ORGANIZATION_ID, actorId: "system", role: "SYSTEM" },
    capabilities: [{ capabilityId: geaId("geacap"), capabilityKey: "workflow", capabilityVersion: "gea-capability/v1", enabled: true }],
    permissions: ["gea:agents:execute", "gea:tools:execute"],
    currentVersion: {
      agentVersionId: geaId("geaver"),
      agentId: "gea-orchestrator-agent",
      versionTag: "v1",
      planVersion: "gea-plan/v1",
      contextVersion: "gea-context/v1",
      toolsetVersion: "gea-tool/v1",
      createdAt: nowIso(),
    },
  });
  geaRepository.upsertAgent(seedAgent).catch(() => undefined);

  const agentRuntime = input?.agentRuntime ?? createAgentRuntimeService({ repository: geaRepository, capabilityRegistry, toolRegistry });
  const runtime = input?.runtime ?? createOrchestrationRuntimeService({ repository, agentRuntime });

  return {
    sessionLoader: input?.sessionLoader ?? getGlwSession,
    repository,
    runtime,
    agentRuntime,
  };
}

async function authorize(input: {
  request: Request;
  actionId: GeaOrchestrationAction;
  route: string;
  dependencies: ReturnType<typeof buildDependencies>;
}): Promise<Authorized> {
  const deps = input.dependencies;
  const url = new URL(input.request.url);
  const workspaceId = workspaceFromUrl(url);
  const organizationId = organizationFromUrl(url);

  const session = await deps.sessionLoader();
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
    workspaceId,
    organizationId,
    permissions: subject.permissions,
  };
}

function parseSteps(value: unknown): WorkflowStep[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index): WorkflowStep | null => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      if (typeof item.stepKey !== "string" || typeof item.title !== "string" || typeof item.agentId !== "string") return null;

      return {
        stepId: typeof item.stepId === "string" ? item.stepId : geaId("geawfstep"),
        stepKey: item.stepKey,
        title: item.title,
        description: typeof item.description === "string" ? item.description : undefined,
        stepType: item.stepType === "PARALLEL" || item.stepType === "CONDITIONAL" || item.stepType === "FAN_OUT" || item.stepType === "FAN_IN" || item.stepType === "BARRIER" ? item.stepType : "SEQUENTIAL",
        order: typeof item.order === "number" ? item.order : index + 1,
        condition: typeof item.condition === "string" ? item.condition : undefined,
        requiresApproval: item.requiresApproval === true,
        highRisk: item.highRisk === true,
        assignment: {
          assignmentId: geaId("geaassign"),
          stepId: typeof item.stepId === "string" ? item.stepId : geaId("geawfstepref"),
          agentId: item.agentId,
          agentVersion: typeof item.agentVersion === "string" ? item.agentVersion : "v1",
          requiredCapabilities: Array.isArray(item.requiredCapabilities)
            ? item.requiredCapabilities.filter((cap): cap is string => typeof cap === "string")
            : ["workflow"],
          roleConstraint: typeof item.roleConstraint === "string" ? item.roleConstraint : undefined,
        },
        retryPolicy: {
          maxRetries: typeof item.maxRetries === "number" ? item.maxRetries : 1,
          backoffMs: typeof item.backoffMs === "number" ? item.backoffMs : 1000,
          strategy: item.strategy === "EXPONENTIAL" || item.strategy === "LINEAR" ? item.strategy : "FIXED",
          retryOnStates: ["FAILED"],
        },
        compensation: {
          reversible: item.reversible === true,
          actionType: item.reversible === true ? "ROLLBACK" : "NONE",
        },
        input: typeof item.input === "object" && item.input ? item.input as Record<string, unknown> : {},
      } satisfies WorkflowStep;
    })
    .filter((entry): entry is WorkflowStep => entry !== null);
}

export async function handleOrchestrations(request: Request, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:view_workflows", route: "/api/gea/orchestrations", dependencies: d });
  if ("error" in access) return access.error;

  const runtime = d.runtime;
  const orchestrations = await runtime.listOrchestrations(access.workspaceId);
  const executions = await runtime.listExecutions(access.workspaceId);

  return json({ orchestrations, executions });
}

export async function handleGetOrchestration(request: Request, orchestrationId: string, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:view_workflows", route: "/api/gea/orchestrations/[id]", dependencies: d });
  if ("error" in access) return access.error;

  const orchestration = await d.runtime.getOrchestration(orchestrationId);
  if (!orchestration || orchestration.workspaceId !== access.workspaceId) {
    return json({ error: "Orchestration not found." }, 404);
  }

  return json({ orchestration });
}

export async function handleStartOrchestration(request: Request, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:execute_workflows", route: "/api/gea/orchestrations/start", dependencies: d });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.steps) || typeof body.workflowKey !== "string") {
    return json({ error: "workflowKey and steps are required." }, 400);
  }

  const runtime = d.runtime;
  const compiled = await runtime.workflowCompiler.compile({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    orchestrationName: typeof body.orchestrationName === "string" ? body.orchestrationName : `${body.workflowKey} orchestration`,
    orchestrationDescription: typeof body.orchestrationDescription === "string" ? body.orchestrationDescription : "Multi-agent orchestration workflow.",
    workflowKey: body.workflowKey,
    workflowName: typeof body.workflowName === "string" ? body.workflowName : body.workflowKey,
    workflowDescription: typeof body.workflowDescription === "string" ? body.workflowDescription : `${body.workflowKey} workflow`,
    steps: parseSteps(body.steps),
    scheduling: typeof body.scheduling === "object" && body.scheduling ? body.scheduling as WorkflowDefinition["scheduling"] : undefined,
    actorId: access.actorId,
  });

  const execution = await runtime.executionManager.start({
    orchestrationId: compiled.orchestration.orchestrationId,
    workflowId: compiled.workflow.workflowId,
    contextPackageId: typeof body.contextPackageId === "string" ? body.contextPackageId : undefined,
    actorId: access.actorId,
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
  });

  return json({ orchestration: compiled.orchestration, workflow: compiled.workflow, execution }, 201);
}

export async function handleCancelOrchestration(request: Request, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:cancel_workflows", route: "/api/gea/orchestrations/cancel", dependencies: d });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.executionId !== "string") {
    return json({ error: "executionId is required." }, 400);
  }

  const execution = await d.runtime.executionManager.cancel(body.executionId, access.actorId);
  return json({ execution }, 201);
}

export async function handlePauseOrchestration(request: Request, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:pause_workflows", route: "/api/gea/orchestrations/pause", dependencies: d });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.executionId !== "string") {
    return json({ error: "executionId is required." }, 400);
  }

  const execution = await d.runtime.executionManager.pause(body.executionId, access.actorId);
  return json({ execution }, 201);
}

export async function handleResumeOrchestration(request: Request, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:resume_workflows", route: "/api/gea/orchestrations/resume", dependencies: d });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.executionId !== "string") {
    return json({ error: "executionId is required." }, 400);
  }

  const execution = await d.runtime.executionManager.resume(body.executionId, access.actorId);
  return json({ execution }, 201);
}

export async function handleReplayOrchestration(request: Request, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:replay_workflows", route: "/api/gea/orchestrations/replay", dependencies: d });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.executionId !== "string") {
    return json({ error: "executionId is required." }, 400);
  }

  const replay = await d.runtime.executionManager.replay(body.executionId);
  return json({ replay }, 201);
}

export async function handleWorkflows(request: Request, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:view_workflows", route: "/api/gea/workflows", dependencies: d });
  if ("error" in access) return access.error;

  const workflows = await d.runtime.listWorkflows(access.workspaceId);
  return json({ workflows });
}

export async function handleGetWorkflow(request: Request, workflowId: string, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:view_workflows", route: "/api/gea/workflows/[id]", dependencies: d });
  if ("error" in access) return access.error;

  const workflow = await d.runtime.getWorkflow(workflowId);
  if (!workflow || workflow.workspaceId !== access.workspaceId) {
    return json({ error: "Workflow not found." }, 404);
  }

  return json({ workflow });
}

export async function handleOrchestrationHealth(request: Request, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:view_health", route: "/api/gea/orchestrations/health", dependencies: d });
  if ("error" in access) return access.error;

  const health = await d.runtime.listHealth(access.workspaceId);
  return json({ health });
}

export async function handleOrchestrationTimeline(request: Request, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:view_timeline", route: "/api/gea/orchestrations/timeline", dependencies: d });
  if ("error" in access) return access.error;

  const executionId = new URL(request.url).searchParams.get("executionId") ?? undefined;
  const timeline = await d.runtime.listTimeline(access.workspaceId, executionId);
  return json({ timeline });
}

export async function handleOrchestrationApprovals(request: Request, dependencies?: GeaOrchestrationApiDependencies): Promise<NextResponse> {
  const d = buildDependencies(dependencies);
  const access = await authorize({ request, actionId: "gea:orchestration:approve_workflow_stages", route: "/api/gea/orchestrations/approvals", dependencies: d });
  if ("error" in access) return access.error;

  const executionId = new URL(request.url).searchParams.get("executionId") ?? undefined;
  const approvals = await d.runtime.listApprovals(access.workspaceId, executionId);
  return json({ approvals });
}

export function createInMemoryOrchestrationApiDependencies(): GeaOrchestrationApiDependencies {
  const repository = createInMemoryOrchestrationRepository();
  const { capabilityRegistry, toolRegistry } = createGeaRuntimeRegistryAuthority();
  const geaRepository = createInMemoryGeaRepository();

  const seedAgent = createSeedAgent({
    agentId: "gea-orchestrator-agent",
    workspaceId: DEFAULT_WORKSPACE_ID,
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "Orchestration Runtime Agent",
    identity: { workspaceId: DEFAULT_WORKSPACE_ID, organizationId: DEFAULT_ORGANIZATION_ID, actorId: "system", role: "SYSTEM" },
    capabilities: [{ capabilityId: geaId("geacap"), capabilityKey: "workflow", capabilityVersion: "gea-capability/v1", enabled: true }],
    permissions: ["gea:agents:execute", "gea:tools:execute"],
    currentVersion: {
      agentVersionId: geaId("geaver"),
      agentId: "gea-orchestrator-agent",
      versionTag: "v1",
      planVersion: "gea-plan/v1",
      contextVersion: "gea-context/v1",
      toolsetVersion: "gea-tool/v1",
      createdAt: nowIso(),
    },
  });
  geaRepository.upsertAgent(seedAgent).catch(() => undefined);

  const agentRuntime = createAgentRuntimeService({ repository: geaRepository, capabilityRegistry, toolRegistry });
  const runtime = createOrchestrationRuntimeService({ repository, agentRuntime });
  return { repository, runtime, agentRuntime };
}
