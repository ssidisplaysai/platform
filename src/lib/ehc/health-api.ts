import { NextResponse } from "next/server";
import { getEnterpriseHealthService } from "@/platform/ehc";
import type { EvaluateHealthInput, ReadinessStatus, LivenessStatus, ValidateCompatibilityInput } from "@/platform/ehc";

export async function handleCurrentHealth(): Promise<NextResponse> {
  const service = await getEnterpriseHealthService();
  const summary = await service.generateEnterpriseHealthSummary();
  return NextResponse.json({ summary }, { status: 200 });
}

export async function handleEnterpriseHealth(): Promise<NextResponse> {
  const service = await getEnterpriseHealthService();
  const aggregation = await service.aggregateHealth();
  return NextResponse.json({ aggregation }, { status: 200 });
}

export async function handleEvaluateApplicationHealth(request: Request, applicationId: string): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as {
    readiness?: ReadinessStatus;
    liveness?: LivenessStatus;
    availableCapabilities?: string[];
    requiredHealthContractVersion?: string;
    requiredCapabilityContractVersion?: string;
    source?: "SIMULATED" | "INTEGRATION" | "MANUAL";
  } | null;

  const service = await getEnterpriseHealthService();
  const record = await service.evaluateHealth({
    applicationId,
    readiness: body?.readiness,
    liveness: body?.liveness,
    availableCapabilities: body?.availableCapabilities,
    requiredHealthContractVersion: body?.requiredHealthContractVersion,
    requiredCapabilityContractVersion: body?.requiredCapabilityContractVersion,
    source: body?.source ?? "MANUAL",
  });

  if (!record) {
    return NextResponse.json({ error: "Application not found in certified registry." }, { status: 404 });
  }

  return NextResponse.json({ record }, { status: 200 });
}

export async function handleApplicationHealth(applicationId: string): Promise<NextResponse> {
  const service = await getEnterpriseHealthService();
  const record = await service.retrieveHealth(applicationId);

  if (!record) {
    return NextResponse.json({ error: "Health record not found." }, { status: 404 });
  }

  return NextResponse.json({ record }, { status: 200 });
}

export async function handleApplicationHealthHistory(request: Request, applicationId: string): Promise<NextResponse> {
  const params = new URL(request.url, "http://localhost").searchParams;
  const limitRaw = params.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 100;

  const service = await getEnterpriseHealthService();
  const history = await service.retrieveHealthHistory(applicationId, limit);

  return NextResponse.json({ history }, { status: 200 });
}

export async function handleCapabilityStatus(applicationId: string): Promise<NextResponse> {
  const service = await getEnterpriseHealthService();
  const capabilities = await service.retrieveCapabilityInformation(applicationId);

  if (!capabilities) {
    return NextResponse.json({ error: "Health record not found." }, { status: 404 });
  }

  return NextResponse.json({ capabilities }, { status: 200 });
}

export async function handleCompatibilityEvaluation(request: Request, applicationId: string): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as Omit<ValidateCompatibilityInput, "applicationId"> | null;
  const service = await getEnterpriseHealthService();
  const compatibility = await service.validateCompatibility({
    applicationId,
    requiredHealthContractVersion: body?.requiredHealthContractVersion,
    requiredCapabilityContractVersion: body?.requiredCapabilityContractVersion,
  });

  if (!compatibility) {
    return NextResponse.json({ error: "Application not found in certified registry." }, { status: 404 });
  }

  return NextResponse.json({ compatibility }, { status: compatibility.compatible ? 200 : 400 });
}

export async function handleReadiness(applicationId: string): Promise<NextResponse> {
  const service = await getEnterpriseHealthService();
  const readiness = await service.retrieveReadiness(applicationId);

  if (!readiness) {
    return NextResponse.json({ error: "Health record not found." }, { status: 404 });
  }

  return NextResponse.json({ readiness }, { status: 200 });
}

export async function handleLiveness(applicationId: string): Promise<NextResponse> {
  const service = await getEnterpriseHealthService();
  const liveness = await service.retrieveLiveness(applicationId);

  if (!liveness) {
    return NextResponse.json({ error: "Health record not found." }, { status: 404 });
  }

  return NextResponse.json({ liveness }, { status: 200 });
}

export async function handleRecordHealth(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as EvaluateHealthInput | null;
  if (!body?.applicationId) {
    return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
  }

  const service = await getEnterpriseHealthService();
  const record = await service.evaluateHealth(body);

  if (!record) {
    return NextResponse.json({ error: "Application not found in certified registry." }, { status: 404 });
  }

  return NextResponse.json({ record }, { status: 201 });
}
