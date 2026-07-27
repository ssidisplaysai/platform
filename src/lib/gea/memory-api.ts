import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createContextBuilderService } from "./context-framework";
import { createMemoryCatalog, createMemoryRegistryService, createMemoryResolver } from "./memory-registry";
import { createInMemoryMemoryRepository, createPrismaMemoryRepository, type MemoryRepository } from "./memory-repository";
import type { MemoryReference } from "./memory-models";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";
const DEFAULT_MODULE_ID = "gea.memory";

type GeaMemoryAction =
  | "gea:memory:view"
  | "gea:context:build"
  | "gea:context:replay"
  | "gea:context:view_provenance"
  | "gea:memory:manage_registry"
  | "gea:context:view_cache"
  | "gea:context:validate"
  | "gea:context:view_health";

export type GeaMemoryApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: MemoryRepository;
};

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

function organizationFromUrl(url: URL): string {
  return url.searchParams.get("organizationId") ?? DEFAULT_ORGANIZATION_ID;
}

function deps(input?: GeaMemoryApiDependencies) {
  const repository = input?.repository ?? createPrismaMemoryRepository();
  const registry = createMemoryRegistryService(repository);
  const resolver = createMemoryResolver();
  const catalog = createMemoryCatalog(repository);
  const context = createContextBuilderService({ repository, registry, resolver });

  return {
    sessionLoader: input?.sessionLoader ?? getGlwSession,
    repository,
    registry,
    resolver,
    catalog,
    context,
  };
}

type Authorized =
  | { error: NextResponse }
  | { actorId: string; role: string; workspaceId: string; organizationId: string; permissions: string[] };

async function authorize(input: {
  request: Request;
  actionId: GeaMemoryAction;
  route: string;
  dependencies?: GeaMemoryApiDependencies;
}): Promise<Authorized> {
  const d = deps(input.dependencies);
  const url = new URL(input.request.url);
  const workspaceId = workspaceFromUrl(url);
  const organizationId = organizationFromUrl(url);

  const session = await d.sessionLoader();
  if (!session) return { error: json({ error: "GLW session is required." }, 401) };

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

function parseRegistration(body: Record<string, unknown>): {
  referenceType: MemoryReference["referenceType"];
  referenceId: string;
  referenceVersion: string;
  sourceType: MemoryReference["source"]["sourceType"];
  sourceId: string;
  sourceVersion: string;
  authoritative: boolean;
  registryIdentity: string;
  capabilityKey?: string;
  permissionAction?: string;
  projectId?: string;
  authorityState: MemoryReference["authorityState"];
  immutable: boolean;
  metadata?: Record<string, unknown>;
} {
  if (
    typeof body.referenceType !== "string"
    || typeof body.referenceId !== "string"
    || typeof body.referenceVersion !== "string"
    || typeof body.sourceType !== "string"
    || typeof body.sourceId !== "string"
    || typeof body.sourceVersion !== "string"
    || typeof body.registryIdentity !== "string"
  ) {
    throw new Error("referenceType, referenceId, referenceVersion, sourceType, sourceId, sourceVersion, and registryIdentity are required.");
  }

  return {
    referenceType: body.referenceType as MemoryReference["referenceType"],
    referenceId: body.referenceId,
    referenceVersion: body.referenceVersion,
    sourceType: body.sourceType as MemoryReference["source"]["sourceType"],
    sourceId: body.sourceId,
    sourceVersion: body.sourceVersion,
    authoritative: body.authoritative !== false,
    registryIdentity: body.registryIdentity,
    capabilityKey: typeof body.capabilityKey === "string" ? body.capabilityKey : undefined,
    permissionAction: typeof body.permissionAction === "string" ? body.permissionAction : undefined,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    authorityState: body.authorityState === "UNVERIFIED" ? "UNVERIFIED" : body.authorityState === "VERIFIED" ? "VERIFIED" : "CERTIFIED",
    immutable: body.immutable !== false,
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata as Record<string, unknown> : undefined,
  };
}

export async function handleMemory(request: Request, dependencies?: GeaMemoryApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:memory:view", route: "/api/gea/memory", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  if (request.method === "POST") {
    const manage = await authorize({ request, actionId: "gea:memory:manage_registry", route: "/api/gea/memory", dependencies });
    if ("error" in manage) return manage.error;

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ error: "Request body is required." }, 400);

    const parsed = parseRegistration(body);
    const reference = await d.registry.registerReference({
      workspaceId: access.workspaceId,
      organizationId: access.organizationId,
      projectId: parsed.projectId,
      registryIdentity: parsed.registryIdentity,
      referenceType: parsed.referenceType,
      referenceId: parsed.referenceId,
      referenceVersion: parsed.referenceVersion,
      source: {
        sourceType: parsed.sourceType,
        sourceId: parsed.sourceId,
        sourceVersion: parsed.sourceVersion,
        authoritative: parsed.authoritative,
      },
      capabilityKey: parsed.capabilityKey,
      permissionAction: parsed.permissionAction,
      authorityState: parsed.authorityState,
      immutable: parsed.immutable,
      metadata: parsed.metadata,
    });

    return json({ reference }, 201);
  }

  const query = new URL(request.url).searchParams.get("q") ?? undefined;
  const references = query
    ? await d.catalog.search(access.workspaceId, query)
    : await d.registry.listReferences(access.workspaceId);

  return json({ references });
}

export async function handleGetMemory(request: Request, id: string, dependencies?: GeaMemoryApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:memory:view", route: "/api/gea/memory/[id]", dependencies });
  if ("error" in access) return access.error;

  const reference = await deps(dependencies).registry.getReference(id);
  if (!reference || reference.workspaceId !== access.workspaceId) {
    return json({ error: "Memory reference not found." }, 404);
  }

  return json({ reference });
}

export async function handleContext(request: Request, dependencies?: GeaMemoryApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:memory:view", route: "/api/gea/context", dependencies });
  if ("error" in access) return access.error;

  const packages = await deps(dependencies).context.listContextPackages(access.workspaceId);
  return json({ contextPackages: packages });
}

export async function handleContextBuild(request: Request, dependencies?: GeaMemoryApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:context:build", route: "/api/gea/context/build", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.referenceIds)) {
    return json({ error: "referenceIds array is required." }, 400);
  }

  const referenceIds = body.referenceIds.filter((entry): entry is string => typeof entry === "string");
  const result = await deps(dependencies).context.buildContext({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    agentId: typeof body.agentId === "string" ? body.agentId : undefined,
    actorId: access.actorId,
    referenceIds,
    capabilityPermissions: Array.isArray(body.capabilityPermissions)
      ? body.capabilityPermissions.filter((entry): entry is string => typeof entry === "string")
      : access.permissions.filter((entry) => entry.startsWith("capability:")),
    permissionActions: access.permissions,
    genomeVersion: typeof body.genomeVersion === "string" ? body.genomeVersion : undefined,
    toolVersions: typeof body.toolVersions === "object" && body.toolVersions ? body.toolVersions as Record<string, string> : undefined,
    maxReferences: typeof body.maxReferences === "number" ? body.maxReferences : undefined,
  });

  return json(result, 201);
}

export async function handleContextReplay(request: Request, dependencies?: GeaMemoryApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:context:replay", route: "/api/gea/context/replay", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.contextPackageId !== "string") {
    return json({ error: "contextPackageId is required." }, 400);
  }

  const replay = await deps(dependencies).context.replayContext(body.contextPackageId);
  return json(replay, 201);
}

export async function handleContextHealth(request: Request, dependencies?: GeaMemoryApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:context:view_health", route: "/api/gea/context/health", dependencies });
  if ("error" in access) return access.error;

  const health = await deps(dependencies).context.listHealth(access.workspaceId);
  return json({ health });
}

export async function handleContextVersions(request: Request, dependencies?: GeaMemoryApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:memory:view", route: "/api/gea/context/versions", dependencies });
  if ("error" in access) return access.error;

  const packages = await deps(dependencies).context.listContextPackages(access.workspaceId);
  const versions = packages.map((entry) => ({
    contextPackageId: entry.contextPackageId,
    contextVersion: entry.contextVersion,
    assemblyVersion: entry.assembly.assemblyVersion,
    runtimeVersion: entry.assembly.runtimeVersion,
    genomeVersion: entry.assembly.genomeVersion,
    toolVersions: entry.assembly.toolVersions,
    sourceVersions: entry.assembly.sourceVersions,
    createdAt: entry.createdAt,
  }));

  return json({ versions });
}

export async function handleContextProvenance(request: Request, dependencies?: GeaMemoryApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:context:view_provenance", route: "/api/gea/context/provenance", dependencies });
  if ("error" in access) return access.error;

  const contextPackageId = new URL(request.url).searchParams.get("contextPackageId") ?? undefined;
  const packages = await deps(dependencies).context.listContextPackages(access.workspaceId);
  const scoped = contextPackageId ? packages.filter((entry) => entry.contextPackageId === contextPackageId) : packages;

  const provenance = scoped.map((entry) => ({
    contextPackageId: entry.contextPackageId,
    sections: entry.sections.map((section) => ({
      sectionId: section.sectionId,
      sourceType: section.sourceType,
      references: section.references.map((reference) => reference.provenance),
    })),
  }));

  return json({ provenance });
}

export async function handleContextCache(request: Request, dependencies?: GeaMemoryApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:context:view_cache", route: "/api/gea/context/cache", dependencies });
  if ("error" in access) return access.error;

  const cache = await deps(dependencies).context.listCache(access.workspaceId);
  return json({ cache });
}

export async function handleContextValidation(request: Request, dependencies?: GeaMemoryApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gea:context:validate", route: "/api/gea/context/validation", dependencies });
  if ("error" in access) return access.error;

  const contextPackageId = new URL(request.url).searchParams.get("contextPackageId") ?? undefined;
  const validations = await deps(dependencies).context.listValidations(contextPackageId);
  return json({ validations });
}

export function createInMemoryMemoryApiDependencies(): GeaMemoryApiDependencies {
  const repository = createInMemoryMemoryRepository();
  return { repository };
}
