import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createInMemoryManufacturingRepository, createPrismaManufacturingRepository, type ManufacturingRepository } from "./manufacturing-repository";
import { createManufacturingRuntimeService } from "./manufacturing-runtime";
import type { ManufacturingMachine, ManufacturingProductionOrder, ManufacturingQualityEvent } from "./manufacturing-models";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";
const DEFAULT_MODULE_ID = "gba.manufacturing";

type ManufacturingAction =
  | "gba:manufacturing:view_dashboard"
  | "gba:manufacturing:view_boms"
  | "gba:manufacturing:view_routings"
  | "gba:manufacturing:view_production_orders"
  | "gba:manufacturing:manage_production_orders"
  | "gba:manufacturing:view_machines"
  | "gba:manufacturing:manage_machines"
  | "gba:manufacturing:view_labor"
  | "gba:manufacturing:view_materials"
  | "gba:manufacturing:view_quality"
  | "gba:manufacturing:manage_quality"
  | "gba:manufacturing:view_costing"
  | "gba:manufacturing:view_kpis"
  | "gba:manufacturing:view_recommendations"
  | "gba:manufacturing:review_recommendations"
  | "gba:manufacturing:view_health";

export type GbaManufacturingApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  repository?: ManufacturingRepository;
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

function runtimeFromDeps(input?: GbaManufacturingApiDependencies) {
  const repository = input?.repository ?? createPrismaManufacturingRepository();
  return createManufacturingRuntimeService(repository);
}

async function authorize(input: {
  request: Request;
  actionId: ManufacturingAction;
  route: string;
  dependencies?: GbaManufacturingApiDependencies;
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

export async function handleManufacturingDashboard(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_dashboard", route: "/api/gba/manufacturing/dashboard", dependencies });
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const dashboard = await runtimeFromDeps(dependencies).getDashboard(access.workspaceId, access.organizationId, {
    facility: url.searchParams.get("facility") ?? undefined,
    line: url.searchParams.get("line") ?? undefined,
    shift: url.searchParams.get("shift") ?? undefined,
    period: url.searchParams.get("period") ?? undefined,
    sku: url.searchParams.get("sku") ?? undefined,
  });

  return json({ dashboard });
}

export async function handleManufacturingBoms(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_boms", route: "/api/gba/manufacturing/boms", dependencies });
  if ("error" in access) return access.error;

  const boms = await runtimeFromDeps(dependencies).listBoms(access.workspaceId);
  return json({ boms });
}

export async function handleManufacturingRoutings(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_routings", route: "/api/gba/manufacturing/routings", dependencies });
  if ("error" in access) return access.error;

  const routings = await runtimeFromDeps(dependencies).listRoutings(access.workspaceId);
  return json({ routings });
}

export async function handleManufacturingProductionOrders(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_production_orders", route: "/api/gba/manufacturing/production-orders", dependencies });
  if ("error" in access) return access.error;

  const productionOrders = await runtimeFromDeps(dependencies).listProductionOrders(access.workspaceId);
  return json({ productionOrders });
}

export async function handleCreateManufacturingProductionOrder(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:manage_production_orders", route: "/api/gba/manufacturing/production-orders", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.title !== "string" || typeof body.sku !== "string" || typeof body.priority !== "string" || typeof body.quantityPlanned !== "number" || typeof body.scheduledStartAt !== "string" || typeof body.scheduledEndAt !== "string") {
    return json({ error: "title, sku, priority, quantityPlanned, scheduledStartAt, and scheduledEndAt are required." }, 400);
  }

  if (!["P1", "P2", "P3", "P4"].includes(body.priority)) {
    return json({ error: "priority must be one of P1, P2, P3, P4." }, 400);
  }

  const productionOrder = await runtimeFromDeps(dependencies).createProductionOrder({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actorId: access.actorId,
    title: body.title,
    sku: body.sku,
    priority: body.priority as ManufacturingProductionOrder["priority"],
    quantityPlanned: body.quantityPlanned,
    scheduledStartAt: body.scheduledStartAt,
    scheduledEndAt: body.scheduledEndAt,
    operationsWorkOrderId: typeof body.operationsWorkOrderId === "string" ? body.operationsWorkOrderId : undefined,
  });

  return json({ productionOrder }, 201);
}

export async function handleManufacturingMachines(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_machines", route: "/api/gba/manufacturing/machines", dependencies });
  if ("error" in access) return access.error;

  const machines = await runtimeFromDeps(dependencies).listMachines(access.workspaceId);
  return json({ machines });
}

export async function handleUpdateManufacturingMachineStatus(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:manage_machines", route: "/api/gba/manufacturing/machines", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.machineId !== "string" || typeof body.status !== "string" || typeof body.note !== "string") {
    return json({ error: "machineId, status, and note are required." }, 400);
  }
  if (!["IDLE", "IN_PROGRESS", "BLOCKED", "AT_RISK", "MAINTENANCE"].includes(body.status)) {
    return json({ error: "status must be IDLE|IN_PROGRESS|BLOCKED|AT_RISK|MAINTENANCE." }, 400);
  }

  const machine = await runtimeFromDeps(dependencies).updateMachineStatus({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actorId: access.actorId,
    machineId: body.machineId,
    status: body.status as ManufacturingMachine["status"],
    note: body.note,
  });

  return json({ machine }, 201);
}

export async function handleManufacturingLabor(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_labor", route: "/api/gba/manufacturing/labor", dependencies });
  if ("error" in access) return access.error;

  const labor = await runtimeFromDeps(dependencies).listLabor(access.workspaceId);
  return json({ labor });
}

export async function handleManufacturingMaterials(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_materials", route: "/api/gba/manufacturing/materials", dependencies });
  if ("error" in access) return access.error;

  const materials = await runtimeFromDeps(dependencies).listMaterials(access.workspaceId);
  return json({ materials });
}

export async function handleManufacturingQuality(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_quality", route: "/api/gba/manufacturing/quality", dependencies });
  if ("error" in access) return access.error;

  const quality = await runtimeFromDeps(dependencies).listQuality(access.workspaceId);
  return json({ quality });
}

export async function handleRecordManufacturingQualityEvent(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:manage_quality", route: "/api/gba/manufacturing/quality", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.productionOrderId !== "string" || typeof body.eventType !== "string" || typeof body.severity !== "string" || typeof body.defectCategory !== "string" || typeof body.note !== "string" || typeof body.firstPassYieldPercent !== "number") {
    return json({ error: "productionOrderId, eventType, severity, defectCategory, note, and firstPassYieldPercent are required." }, 400);
  }

  if (!["INCOMING_INSPECTION", "IN_PROCESS_INSPECTION", "FINAL_INSPECTION", "DEFECT", "REWORK"].includes(body.eventType)) {
    return json({ error: "eventType must be INCOMING_INSPECTION|IN_PROCESS_INSPECTION|FINAL_INSPECTION|DEFECT|REWORK." }, 400);
  }
  if (!["LOW", "MEDIUM", "HIGH"].includes(body.severity)) {
    return json({ error: "severity must be LOW|MEDIUM|HIGH." }, 400);
  }

  const qualityEvent = await runtimeFromDeps(dependencies).recordQualityEvent({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actorId: access.actorId,
    productionOrderId: body.productionOrderId,
    eventType: body.eventType as ManufacturingQualityEvent["eventType"],
    severity: body.severity as ManufacturingQualityEvent["severity"],
    defectCategory: body.defectCategory,
    note: body.note,
    firstPassYieldPercent: body.firstPassYieldPercent,
    rootCauseReference: typeof body.rootCauseReference === "string" ? body.rootCauseReference : undefined,
  });

  return json({ qualityEvent }, 201);
}

export async function handleManufacturingCosting(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_costing", route: "/api/gba/manufacturing/costing", dependencies });
  if ("error" in access) return access.error;

  const costing = await runtimeFromDeps(dependencies).listCosting(access.workspaceId);
  return json({ costing });
}

export async function handleManufacturingKpis(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_kpis", route: "/api/gba/manufacturing/kpis", dependencies });
  if ("error" in access) return access.error;

  const kpis = await runtimeFromDeps(dependencies).listKpis(access.workspaceId);
  return json({ kpis });
}

export async function handleManufacturingRecommendations(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_recommendations", route: "/api/gba/manufacturing/recommendations", dependencies });
  if ("error" in access) return access.error;

  const recommendations = await runtimeFromDeps(dependencies).listRecommendations(access.workspaceId);
  return json({ recommendations });
}

export async function handleReviewManufacturingRecommendation(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:review_recommendations", route: "/api/gba/manufacturing/recommendations/review", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.manufacturingRecommendationId !== "string" || (body.decision !== "APPROVED" && body.decision !== "REJECTED")) {
    return json({ error: "manufacturingRecommendationId and decision(APPROVED|REJECTED) are required." }, 400);
  }

  const review = await runtimeFromDeps(dependencies).reviewRecommendation({
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    actorId: access.actorId,
    manufacturingRecommendationId: body.manufacturingRecommendationId,
    decision: body.decision,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  return json({ review }, 201);
}

export async function handleManufacturingHealth(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_health", route: "/api/gba/manufacturing/health", dependencies });
  if ("error" in access) return access.error;

  const health = await runtimeFromDeps(dependencies).listHealth(access.workspaceId);
  return json({ health });
}

export async function handleManufacturingTimeline(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_dashboard", route: "/api/gba/manufacturing/timeline", dependencies });
  if ("error" in access) return access.error;

  const timeline = await runtimeFromDeps(dependencies).listTimeline(access.workspaceId);
  return json({ timeline });
}

export async function handleManufacturingExecutiveReports(request: Request, dependencies?: GbaManufacturingApiDependencies): Promise<NextResponse> {
  const access = await authorize({ request, actionId: "gba:manufacturing:view_dashboard", route: "/api/gba/manufacturing/executive-reports", dependencies });
  if ("error" in access) return access.error;

  const reports = await runtimeFromDeps(dependencies).listExecutiveReports(access.workspaceId);
  return json({ reports });
}

export function createInMemoryManufacturingApiDependencies(): GbaManufacturingApiDependencies {
  return {
    repository: createInMemoryManufacturingRepository(),
  };
}
