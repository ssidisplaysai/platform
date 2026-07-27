import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createInMemoryToolFrameworkRepository, createPrismaToolFrameworkRepository, type ToolFrameworkRepository } from "./tool-repository";
import { createToolRegistryService, type ToolRegistryService } from "./tool-registry-service";
import { createExecutionCoordinator, type ExecutionCoordinator } from "./tool-execution-engine";
import { createToolAuthorizationEngine } from "./tool-authorization";
import type { ToolCategory, ToolRegistrationInput } from "./tool-models";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_MODULE_ID = "gea.tools";

type GeaToolAction =
  | "gea:tools:view"
  | "gea:tools:execute"
  | "gea:tools:replay"
  | "gea:tools:view_audit"
  | "gea:tools:manage_registry"
  | "gea:tools:manage_versions"
  | "gea:tools:view_health"
  | "gea:tools:validate";

export type GeaToolApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: ToolFrameworkRepository;
  registry?: ToolRegistryService;
  execution?: ExecutionCoordinator;
};

type RequiredDeps = Required<GeaToolApiDependencies>;

type Authorized =
  | { error: NextResponse }
  | {
    actorId: string;
    role: string;
    workspaceId: string;
    permissions: string[];
  };

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

function buildDeps(input?: GeaToolApiDependencies): RequiredDeps {
  const repository = input?.repository ?? createPrismaToolFrameworkRepository();
  const registry = input?.registry ?? createToolRegistryService(repository);
  const execution = input?.execution ?? createExecutionCoordinator({
    repository,
    registry,
    authorizationEngine: createToolAuthorizationEngine(),
  });

  return {
    sessionLoader: input?.sessionLoader ?? getGlwSession,
    repository,
    registry,
    execution,
  };
}

async function authorize(input: {
  request: Request;
  actionId: GeaToolAction;
  route: string;
  dependencies?: GeaToolApiDependencies;
}): Promise<Authorized> {
  const deps = buildDeps(input.dependencies);
  const workspaceId = workspaceFromUrl(new URL(input.request.url));
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
    permissions: subject.permissions,
  };
}

function parseRegistration(body: Record<string, unknown>, workspaceId: string, actorId: string): ToolRegistrationInput {
  if (
    typeof body.toolKey !== "string"
    || typeof body.name !== "string"
    || typeof body.description !== "string"
    || typeof body.category !== "string"
    || typeof body.owner !== "string"
  ) {
    throw new Error("toolKey, name, description, category, and owner are required.");
  }

  const capabilityRequirements = Array.isArray(body.capabilityRequirements)
    ? body.capabilityRequirements.filter((entry): entry is string => typeof entry === "string")
    : [];
  const permissionRequirements = Array.isArray(body.permissionRequirements)
    ? body.permissionRequirements.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    workspaceId,
    organizationId: typeof body.organizationId === "string" ? body.organizationId : "genesis",
    toolKey: body.toolKey,
    name: body.name,
    description: body.description,
    category: body.category as ToolCategory,
    owner: body.owner,
    executionMode: body.executionMode === "ASYNCHRONOUS" ? "ASYNCHRONOUS" : "SYNCHRONOUS",
    capabilityRequirements,
    permissionRequirements,
    inputSchema: typeof body.inputSchema === "object" && body.inputSchema ? body.inputSchema as Record<string, unknown> : {},
    outputSchema: typeof body.outputSchema === "object" && body.outputSchema ? body.outputSchema as Record<string, unknown> : {},
    validationRules: Array.isArray(body.validationRules) ? body.validationRules.filter((entry): entry is string => typeof entry === "string") : [],
    errorTypes: Array.isArray(body.errorTypes) ? body.errorTypes.filter((entry): entry is string => typeof entry === "string") : [],
    timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : 30000,
    retryLimit: typeof body.retryLimit === "number" ? body.retryLimit : 0,
    replaySupported: body.replaySupported !== false,
    deterministic: body.deterministic !== false,
    compatibilityPolicy: body.compatibilityPolicy === "BACKWARD" ? "BACKWARD" : "STRICT",
    versionTag: typeof body.versionTag === "string" ? body.versionTag : "v1",
    actorId,
  };
}

export async function handleListTools(request: Request, dependencies?: GeaToolApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:tools:view", route: "/api/gea/tools", dependencies });
  if ("error" in access) return access.error;

  const deps = buildDeps(dependencies);
  if (request.method === "POST") {
    const manageAccess = await authorize({ request, actionId: "gea:tools:manage_registry", route: "/api/gea/tools", dependencies });
    if ("error" in manageAccess) return manageAccess.error;

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ error: "Request body is required." }, 400);

    const registration = parseRegistration(body, access.workspaceId, access.actorId);
    const created = await deps.registry.registerTool(registration);
    return json({ tool: created }, 201);
  }

  const tools = await deps.registry.listTools(access.workspaceId);
  return json({ tools });
}

export async function handleGetTool(request: Request, toolId: string, dependencies?: GeaToolApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:tools:view", route: "/api/gea/tools/[id]", dependencies });
  if ("error" in access) return access.error;

  const tool = await buildDeps(dependencies).registry.getTool(toolId);
  if (!tool || tool.definition.workspaceId !== access.workspaceId) {
    return json({ error: "Tool not found." }, 404);
  }
  return json({ tool });
}

export async function handleToolCatalog(request: Request, dependencies?: GeaToolApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:tools:view", route: "/api/gea/tools/catalog", dependencies });
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;
  const category = (url.searchParams.get("category") ?? undefined) as ToolCategory | undefined;

  const catalog = await buildDeps(dependencies).registry.discoverTools(access.workspaceId, query, category);
  return json({ catalog });
}

export async function handleToolHealth(request: Request, dependencies?: GeaToolApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:tools:view_health", route: "/api/gea/tools/health", dependencies });
  if ("error" in access) return access.error;

  const health = await buildDeps(dependencies).execution.listHealth();
  return json({ health: health.filter((entry) => entry.toolId) });
}

export async function handleToolCategories(request: Request, dependencies?: GeaToolApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:tools:view", route: "/api/gea/tools/categories", dependencies });
  if ("error" in access) return access.error;

  return json({ categories: buildDeps(dependencies).registry.listCategories() });
}

export async function handleToolExecute(request: Request, dependencies?: GeaToolApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:tools:execute", route: "/api/gea/tools/execute", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.toolIdentifier !== "string" || typeof body.agentId !== "string") {
    return json({ error: "toolIdentifier and agentId are required." }, 400);
  }

  const execution = await buildDeps(dependencies).execution.executeTool({
    workspaceId: access.workspaceId,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    organizationId: typeof body.organizationId === "string" ? body.organizationId : undefined,
    actorId: access.actorId,
    role: access.role,
    agentId: body.agentId,
    agentVersion: typeof body.agentVersion === "string" ? body.agentVersion : "v1",
    toolIdentifier: body.toolIdentifier,
    input: typeof body.input === "object" && body.input ? body.input as Record<string, unknown> : {},
    runtimeState: typeof body.runtimeState === "string" ? body.runtimeState : "RUNNING",
    capabilityPermissions: Array.isArray(body.capabilityPermissions)
      ? body.capabilityPermissions.filter((entry): entry is string => typeof entry === "string")
      : access.permissions.filter((entry) => entry.startsWith("capability:")),
    permissionActions: access.permissions,
    mode: body.mode === "ASYNCHRONOUS" ? "ASYNCHRONOUS" : "SYNCHRONOUS",
    timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
    retryLimit: typeof body.retryLimit === "number" ? body.retryLimit : undefined,
  });

  return json({ execution }, 201);
}

export async function handleToolReplay(request: Request, dependencies?: GeaToolApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:tools:replay", route: "/api/gea/tools/replay", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.executionId !== "string") {
    return json({ error: "executionId is required." }, 400);
  }

  const replay = await buildDeps(dependencies).execution.replayExecution(
    body.executionId,
    access.actorId,
    typeof body.agentVersion === "string" ? body.agentVersion : "v1",
  );
  return json({ replay }, 201);
}

export async function handleToolExecutions(request: Request, dependencies?: GeaToolApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:tools:view", route: "/api/gea/tools/executions", dependencies });
  if ("error" in access) return access.error;

  const executions = await buildDeps(dependencies).execution.listExecutions(access.workspaceId);
  return json({ executions });
}

export async function handleToolExecutionDetail(request: Request, executionId: string, dependencies?: GeaToolApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:tools:view", route: "/api/gea/tools/executions/[id]", dependencies });
  if ("error" in access) return access.error;

  const execution = await buildDeps(dependencies).execution.getExecution(executionId);
  if (!execution || execution.workspaceId !== access.workspaceId) {
    return json({ error: "Execution not found." }, 404);
  }

  const replays = await buildDeps(dependencies).execution.listReplays(executionId);
  return json({ execution, replays });
}

export function createInMemoryToolApiDependencies(): GeaToolApiDependencies {
  const repository = createInMemoryToolFrameworkRepository();
  const registry = createToolRegistryService(repository);
  const execution = createExecutionCoordinator({
    repository,
    registry,
    authorizationEngine: createToolAuthorizationEngine(),
  });
  return { repository, registry, execution };
}
