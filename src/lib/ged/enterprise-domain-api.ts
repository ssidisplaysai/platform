import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createInMemoryEnterpriseDomainRepository, createPrismaEnterpriseDomainRepository, type EnterpriseDomainRepository } from "./enterprise-domain-repository";
import { createEnterpriseDomainRuntimeService } from "./enterprise-domain-runtime";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";
const DEFAULT_MODULE_ID = "ged.domain";

type GedAction =
  | "ged:domain:view_metadata"
  | "ged:domain:view_relationships"
  | "ged:domain:view_versions"
  | "ged:domain:run_validation"
  | "ged:domain:view_health"
  | "ged:domain:view_audit";

type Authorized = { error: NextResponse } | { actorId: string; workspaceId: string; organizationId: string };

export type GedApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: EnterpriseDomainRepository;
};

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function runtimeFromDeps(input?: GedApiDependencies) {
  return createEnterpriseDomainRuntimeService(input?.repository ?? createPrismaEnterpriseDomainRepository());
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

function organizationFromUrl(url: URL): string {
  return url.searchParams.get("organizationId") ?? DEFAULT_ORGANIZATION_ID;
}

function entityFromUrl(url: URL): string | undefined {
  return url.searchParams.get("entityKey") ?? undefined;
}

async function authorize(input: { request: Request; actionId: GedAction; route: string; dependencies?: GedApiDependencies }): Promise<Authorized> {
  const sessionLoader = input.dependencies?.sessionLoader ?? getGlwSession;
  const url = new URL(input.request.url);
  const workspaceId = workspaceFromUrl(url);
  const organizationId = organizationFromUrl(url);
  const session = await sessionLoader();

  if (!session) {
    return { error: json({ error: "GLW session is required." }, 401) };
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId,
    moduleId: DEFAULT_MODULE_ID,
    action: createActionReference(input.actionId, "route_access"),
    resource: { workspaceId, moduleId: DEFAULT_MODULE_ID, route: input.route },
  });

  if (!decision.allowed) {
    return { error: json({ error: decision.reason }, 403) };
  }

  return { actorId: subject.actorId, workspaceId, organizationId };
}

export async function handleEnterpriseEntities(request: Request, dependencies?: GedApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "ged:domain:view_metadata", route: "/api/ged/entities", dependencies });
  if ("error" in access) {
    return access.error;
  }
  return json({ entities: await runtimeFromDeps(dependencies).listEntities() });
}

export async function handleEnterpriseEntity(request: Request, dependencies?: GedApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "ged:domain:view_metadata", route: "/api/ged/entities/[entityKey]", dependencies });
  if ("error" in access) {
    return access.error;
  }
  const entityKey = entityFromUrl(new URL(request.url));
  if (!entityKey) {
    return json({ error: "entityKey is required." }, 400);
  }
  return json({ entity: await runtimeFromDeps(dependencies).getEntity(entityKey as never) });
}

export async function handleEnterpriseRelationships(request: Request, dependencies?: GedApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "ged:domain:view_relationships", route: "/api/ged/relationships", dependencies });
  if ("error" in access) {
    return access.error;
  }
  return json({ relationships: await runtimeFromDeps(dependencies).listRelationships(entityFromUrl(new URL(request.url)) as never) });
}

export async function handleEnterpriseVersions(request: Request, dependencies?: GedApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "ged:domain:view_versions", route: "/api/ged/versions", dependencies });
  if ("error" in access) {
    return access.error;
  }
  return json({ versions: await runtimeFromDeps(dependencies).listVersionHistory(entityFromUrl(new URL(request.url)) as never) });
}

export async function handleEnterpriseValidation(request: Request, dependencies?: GedApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "ged:domain:run_validation", route: "/api/ged/validation", dependencies });
  if ("error" in access) {
    return access.error;
  }
  return json({ validation: await runtimeFromDeps(dependencies).validateDomain() });
}

export async function handleEnterpriseHealth(request: Request, dependencies?: GedApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "ged:domain:view_health", route: "/api/ged/health", dependencies });
  if ("error" in access) {
    return access.error;
  }
  return json({ health: await runtimeFromDeps(dependencies).listHealth() });
}

export async function handleEnterpriseAudit(request: Request, dependencies?: GedApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "ged:domain:view_audit", route: "/api/ged/audit", dependencies });
  if ("error" in access) {
    return access.error;
  }
  return json({ audit: await runtimeFromDeps(dependencies).listAuditLineage(entityFromUrl(new URL(request.url)) as never) });
}

export function createInMemoryEnterpriseDomainApiDependencies(): GedApiDependencies {
  return {
    repository: createInMemoryEnterpriseDomainRepository(),
    sessionLoader: getGlwSession,
  };
}
