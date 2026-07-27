import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createInMemoryOperationsRepository, createPrismaOperationsRepository, type OperationsRepository } from "./operations-repository";
import { createOperationsRuntimeService } from "./operations-runtime";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";
const DEFAULT_MODULE_ID = "gba.operations";

type OperationsAction =
  | "gba:operations:view_dashboard"
  | "gba:operations:view_work_orders"
  | "gba:operations:manage_work_orders"
  | "gba:operations:view_inventory"
  | "gba:operations:manage_inventory"
  | "gba:operations:view_purchasing"
  | "gba:operations:manage_purchasing"
  | "gba:operations:view_warehouse"
  | "gba:operations:manage_warehouse"
  | "gba:operations:view_shipping"
  | "gba:operations:manage_shipping"
  | "gba:operations:view_capacity"
  | "gba:operations:view_kpis"
  | "gba:operations:view_recommendations"
  | "gba:operations:review_recommendations"
  | "gba:operations:view_health";

export type GbaOperationsApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: OperationsRepository;
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

function runtimeFromDeps(input?: GbaOperationsApiDependencies) {
  const repository = input?.repository ?? createPrismaOperationsRepository();
  return createOperationsRuntimeService(repository);
}

async function authorize(input: {
  request: Request;
  actionId: OperationsAction;
  route: string;
  dependencies?: GbaOperationsApiDependencies;
}): Promise<Authorized> {
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

export async function handleOperationsDashboard(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:view_dashboard", route: "/api/gba/operations/dashboard", dependencies });
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const dashboard = await runtimeFromDeps(dependencies).getDashboard(access.workspaceId, access.organizationId, {
    facility: url.searchParams.get("facility") ?? undefined,
    region: url.searchParams.get("region") ?? undefined,
    shift: url.searchParams.get("shift") ?? undefined,
    period: url.searchParams.get("period") ?? undefined,
    projectId: url.searchParams.get("projectId") ?? undefined,
  });

  return json({ dashboard });
}

export async function handleOperationsWorkOrders(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:view_work_orders", route: "/api/gba/operations/work-orders", dependencies });
  if ("error" in access) return access.error;

  const workOrders = await runtimeFromDeps(dependencies).listWorkOrders(access.workspaceId);
  return json({ workOrders });
}

export async function handleCreateOperationsWorkOrder(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:manage_work_orders", route: "/api/gba/operations/work-orders", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.title !== "string" || typeof body.priority !== "string" || typeof body.dueDate !== "string") {
    return json({ error: "title, priority, and dueDate are required." }, 400);
  }

  if (!["P1", "P2", "P3", "P4"].includes(body.priority)) {
    return json({ error: "priority must be one of P1, P2, P3, P4." }, 400);
  }

  const workOrder = await runtimeFromDeps(dependencies).createWorkOrder({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actorId: access.actorId,
    title: body.title,
    priority: body.priority as "P1" | "P2" | "P3" | "P4",
    dueDate: body.dueDate,
    dependencies: Array.isArray(body.dependencies) ? body.dependencies.filter((entry): entry is string => typeof entry === "string") : undefined,
    assignedResources: Array.isArray(body.assignedResources) ? body.assignedResources.filter((entry): entry is string => typeof entry === "string") : undefined,
    estimatedLaborHours: typeof body.estimatedLaborHours === "number" ? body.estimatedLaborHours : undefined,
  });

  return json({ workOrder }, 201);
}

export async function handleOperationsInventory(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:view_inventory", route: "/api/gba/operations/inventory", dependencies });
  if ("error" in access) return access.error;

  const inventory = await runtimeFromDeps(dependencies).listInventory(access.workspaceId);
  return json({ inventory });
}

export async function handleOperationsPurchasing(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:view_purchasing", route: "/api/gba/operations/purchasing", dependencies });
  if ("error" in access) return access.error;

  const purchasing = await runtimeFromDeps(dependencies).listPurchasing(access.workspaceId);
  return json({ purchasing });
}

export async function handleOperationsWarehouse(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:view_warehouse", route: "/api/gba/operations/warehouse", dependencies });
  if ("error" in access) return access.error;

  const warehouse = await runtimeFromDeps(dependencies).listWarehouseOperations(access.workspaceId);
  return json({ warehouse });
}

export async function handleOperationsShipping(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:view_shipping", route: "/api/gba/operations/shipping", dependencies });
  if ("error" in access) return access.error;

  const shipping = await runtimeFromDeps(dependencies).listShipping(access.workspaceId);
  return json({ shipping });
}

export async function handleOperationsCapacity(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:view_capacity", route: "/api/gba/operations/capacity", dependencies });
  if ("error" in access) return access.error;

  const capacity = await runtimeFromDeps(dependencies).listCapacity(access.workspaceId);
  return json({ capacity });
}

export async function handleOperationsKpis(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:view_kpis", route: "/api/gba/operations/kpis", dependencies });
  if ("error" in access) return access.error;

  const kpis = await runtimeFromDeps(dependencies).listOperationsKpis(access.workspaceId);
  return json({ kpis });
}

export async function handleOperationsRecommendations(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:view_recommendations", route: "/api/gba/operations/recommendations", dependencies });
  if ("error" in access) return access.error;

  const recommendations = await runtimeFromDeps(dependencies).listRecommendations(access.workspaceId);
  return json({ recommendations });
}

export async function handleReviewOperationsRecommendation(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:review_recommendations", route: "/api/gba/operations/recommendations/review", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.operationsRecommendationId !== "string" || (body.decision !== "APPROVED" && body.decision !== "REJECTED")) {
    return json({ error: "operationsRecommendationId and decision(APPROVED|REJECTED) are required." }, 400);
  }

  const review = await runtimeFromDeps(dependencies).reviewRecommendation({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actorId: access.actorId,
    operationsRecommendationId: body.operationsRecommendationId,
    decision: body.decision,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  return json({ review }, 201);
}

export async function handleOperationsHealth(request: Request, dependencies?: GbaOperationsApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:operations:view_health", route: "/api/gba/operations/health", dependencies });
  if ("error" in access) return access.error;

  const health = await runtimeFromDeps(dependencies).listHealth(access.workspaceId);
  return json({ health });
}

export function createInMemoryOperationsApiDependencies(): GbaOperationsApiDependencies {
  return {
    repository: createInMemoryOperationsRepository(),
  };
}
