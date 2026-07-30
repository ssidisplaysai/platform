import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createOperationFromProductionJob } from "@/modules/foundation/operation-repository";
import { getProductionJobById } from "@/modules/foundation/production-job-repository";

type RouteContext = {
  params: Promise<{ productionJobId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "operations:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { productionJobId } = await context.params;
  const productionJob = getProductionJobById(productionJobId);
  if (!productionJob) {
    return NextResponse.json({ error: "Production job not found" }, { status: 404 });
  }

  if (productionJob.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && productionJob.siteReference && scope.siteId !== productionJob.siteReference) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    referenceNumber?: string | null;
    operationType?: string;
    sequenceNumber?: number;
    operationName?: string;
    description?: string | null;
    requiredCapability?: string | null;
    estimatedDurationMinutes?: number | null;
    requiredWorkCenterReference?: string | null;
    requiredMachineTypeReference?: string | null;
    requiredSkill?: string | null;
    predecessorOperationIds?: readonly string[];
    successorOperationIds?: readonly string[];
    referenceDocuments?: readonly string[];
    engineeringNotes?: string | null;
    correlationId?: string | null;
    causationId?: string | null;
  };

  const result = createOperationFromProductionJob({
    payload: {
      productionJobId,
      referenceNumber: body.referenceNumber ?? null,
      operationType: body.operationType ?? "assembly",
      sequenceNumber: body.sequenceNumber ?? 1,
      operationName: body.operationName ?? "Operation",
      description: body.description ?? null,
      requiredCapability: body.requiredCapability ?? null,
      estimatedDurationMinutes: body.estimatedDurationMinutes ?? null,
      requiredWorkCenterReference: body.requiredWorkCenterReference ?? null,
      requiredMachineTypeReference: body.requiredMachineTypeReference ?? null,
      requiredSkill: body.requiredSkill ?? null,
      predecessorOperationIds: body.predecessorOperationIds ?? [],
      successorOperationIds: body.successorOperationIds ?? [],
      referenceDocuments: body.referenceDocuments ?? [],
      engineeringNotes: body.engineeringNotes ?? null,
      correlationId: body.correlationId ?? request.headers.get("x-gcp-correlation-id"),
      causationId: body.causationId ?? request.headers.get("x-gcp-causation-id"),
    },
    actor: actorFromRequest(request),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.operation) {
    return NextResponse.json({ error: "Unable to create operation from production job." }, { status: 400 });
  }

  return NextResponse.json({ operation: result.operation }, { status: 201 });
}
