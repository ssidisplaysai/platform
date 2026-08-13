import { NextResponse } from "next/server";
import { authorizeBgeAction, type BgeAuthorizationDependencies } from "@/platform/gop/bge-authorization";
import type {
  ApprovalResponse,
  CreateApprovalRequest,
  CreateEvidenceRequest,
  CreateProposalRequest,
  EvidenceResponse,
  ObjectResponse,
  ProposalResponse,
  RelationshipResponse,
  TimelineResponse,
} from "./contracts";
import { getBgeRuntime } from "./runtime";

export type BgeApiDependencies = BgeAuthorizationDependencies;

function json<T>(payload: T, status = 200): NextResponse<T> {
  return NextResponse.json(payload, { status });
}

function errorJson(message: string, status = 400): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status });
}

export async function handlePostEvidence(request: Request, dependencies?: BgeApiDependencies): Promise<NextResponse<EvidenceResponse | { error: string }>> {
  try {
    const body = (await request.json()) as CreateEvidenceRequest;

    if (!body?.tenant_id || !body?.source || !body?.actor || !body?.evidence_payload) {
      return errorJson("tenant_id, source, actor, and evidence_payload are required.", 400);
    }

    const access = await authorizeBgeAction({
      request,
      actionId: "bge:evidence:create",
      route: "/api/bge/evidence",
      tenantId: body.tenant_id,
      dependencies,
    });
    if ("error" in access) {
      return access.error as NextResponse<{ error: string }>;
    }

    const runtime = getBgeRuntime();
    const evidence = await runtime.evidence.createEvidence(body);
    return json({ evidence }, 201);
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "Unable to create evidence.", 400);
  }
}

export async function handleGetObject(request: Request, objectId: string, tenantId?: string, dependencies?: BgeApiDependencies): Promise<NextResponse<ObjectResponse | { error: string }>> {
  const access = await authorizeBgeAction({
    request,
    actionId: "bge:object:view",
    route: "/api/bge/objects/[id]",
    tenantId,
    dependencies,
  });
  if ("error" in access) {
    return access.error as NextResponse<{ error: string }>;
  }

  const runtime = getBgeRuntime();
  const object = await runtime.objects.getObject(objectId, tenantId);
  if (!object) {
    return errorJson("Object not found.", 404);
  }

  return json({ object });
}

export async function handlePostProposal(request: Request, dependencies?: BgeApiDependencies): Promise<NextResponse<ProposalResponse | { error: string }>> {
  try {
    const body = (await request.json()) as CreateProposalRequest;

    if (!body?.tenant_id || !body?.object_type || !body?.operation || !body?.initiator || !body?.reason) {
      return errorJson("tenant_id, object_type, operation, initiator, and reason are required.", 400);
    }

    const access = await authorizeBgeAction({
      request,
      actionId: "bge:proposal:create",
      route: "/api/bge/proposals",
      tenantId: body.tenant_id,
      dependencies,
    });
    if ("error" in access) {
      return access.error as NextResponse<{ error: string }>;
    }

    const runtime = getBgeRuntime();
    const proposal = await runtime.proposals.createProposal(body);
    return json({ proposal }, 201);
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "Unable to create proposal.", 400);
  }
}

export async function handlePostApproval(request: Request, dependencies?: BgeApiDependencies): Promise<NextResponse<ApprovalResponse | { error: string }>> {
  try {
    const body = (await request.json()) as CreateApprovalRequest;

    if (!body?.tenant_id || !body?.proposal_id || !body?.decision || !body?.approver || !body?.reason) {
      return errorJson("tenant_id, proposal_id, decision, approver, and reason are required.", 400);
    }

    const access = await authorizeBgeAction({
      request,
      actionId: "bge:approval:decide",
      route: "/api/bge/approvals",
      tenantId: body.tenant_id,
      dependencies,
    });
    if ("error" in access) {
      return access.error as NextResponse<{ error: string }>;
    }

    const runtime = getBgeRuntime();
    const result = await runtime.approvals.decide(body);
    return json(result, 201);
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "Unable to process approval.", 400);
  }
}

export async function handleGetTimeline(request: Request, objectId: string, tenantId: string, dependencies?: BgeApiDependencies): Promise<NextResponse<TimelineResponse | { error: string }>> {
  const access = await authorizeBgeAction({
    request,
    actionId: "bge:timeline:view",
    route: "/api/bge/timeline/[id]",
    tenantId,
    dependencies,
  });
  if ("error" in access) {
    return access.error as NextResponse<{ error: string }>;
  }

  const runtime = getBgeRuntime();
  const timeline = await runtime.timeline.getTimeline(objectId, tenantId);
  return json({ timeline });
}

export async function handleGetRelationship(request: Request, relationshipId: string, tenantId?: string, dependencies?: BgeApiDependencies): Promise<NextResponse<RelationshipResponse | { error: string }>> {
  const access = await authorizeBgeAction({
    request,
    actionId: "bge:relationship:view",
    route: "/api/bge/relationships/[id]",
    tenantId,
    dependencies,
  });
  if ("error" in access) {
    return access.error as NextResponse<{ error: string }>;
  }

  const runtime = getBgeRuntime();
  const relationship = await runtime.relationships.getRelationship(relationshipId, tenantId);
  if (!relationship) {
    return errorJson("Relationship not found.", 404);
  }

  return json({ relationship });
}
