import { NextResponse } from "next/server";
import { getEnterpriseRegistryService } from "@/platform/ear";
import type {
  ApplicationLifecycleState,
  CompatibilityValidationInput,
  RegisterApplicationInput,
  RegistrationSearchQuery,
  UpdateRegistrationInput,
} from "@/platform/ear";

function readUrl(url: string): URL {
  return new URL(url, "http://localhost");
}

function toSearchQuery(url: string): RegistrationSearchQuery {
  const params = readUrl(url).searchParams;
  const lifecycleState = params.get("lifecycleState") as ApplicationLifecycleState | null;
  const capability = params.get("capability") ?? undefined;
  const ownerOrganization = params.get("ownerOrganization") ?? undefined;
  const q = params.get("q") ?? undefined;
  const limitRaw = params.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  return {
    lifecycleState: lifecycleState ?? undefined,
    capability,
    ownerOrganization,
    q,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

export async function handleRegisterApplication(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as RegisterApplicationInput | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const result = await getEnterpriseRegistryService().registerApplication(body);
  if (!result.validation.valid) {
    return NextResponse.json({ validation: result.validation }, { status: 400 });
  }

  return NextResponse.json({ application: result.application }, { status: 201 });
}

export async function handleUpdateApplication(request: Request, applicationId: string): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as UpdateRegistrationInput | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const result = await getEnterpriseRegistryService().updateRegistration(applicationId, body);
  if (result.notFound) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  if (!result.validation.valid) {
    return NextResponse.json({ validation: result.validation }, { status: 400 });
  }

  return NextResponse.json({ application: result.application }, { status: 200 });
}

export async function handleDeactivateApplication(request: Request, applicationId: string): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as { reason?: string } | null;
  const result = await getEnterpriseRegistryService().deactivateApplication(applicationId, body?.reason);

  if (result.notFound) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  if (!result.validation.valid) {
    return NextResponse.json({ validation: result.validation }, { status: 400 });
  }

  return NextResponse.json({ application: result.application }, { status: 200 });
}

export async function handleLookupApplication(applicationId: string): Promise<NextResponse> {
  const application = await getEnterpriseRegistryService().retrieveApplication(applicationId);
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  return NextResponse.json({ application }, { status: 200 });
}

export async function handleListApplications(request: Request): Promise<NextResponse> {
  const query = toSearchQuery(request.url);
  const applications = await getEnterpriseRegistryService().enumerateApplications(query);
  return NextResponse.json({ applications }, { status: 200 });
}

export async function handleValidateRegistration(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as RegisterApplicationInput | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const validation = await getEnterpriseRegistryService().validateRegistration(body);
  return NextResponse.json({ validation }, { status: validation.valid ? 200 : 400 });
}

export async function handleValidateCompatibility(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as CompatibilityValidationInput | null;
  if (!body?.applicationId || !body.registryContractVersion) {
    return NextResponse.json({ error: "applicationId and registryContractVersion are required." }, { status: 400 });
  }

  const validation = await getEnterpriseRegistryService().validateCompatibility(body);
  return NextResponse.json({ validation }, { status: validation.valid ? 200 : 400 });
}

export async function handleValidateLifecycleTransition(request: Request, applicationId: string): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as { nextState?: ApplicationLifecycleState } | null;
  if (!body?.nextState) {
    return NextResponse.json({ error: "nextState is required." }, { status: 400 });
  }

  const result = await getEnterpriseRegistryService().validateLifecycleTransition(applicationId, body.nextState);
  if (result.notFound) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  return NextResponse.json({ validation: result.validation }, { status: result.validation.valid ? 200 : 400 });
}

export async function handleLookupHealthReference(applicationId: string): Promise<NextResponse> {
  const healthReference = await getEnterpriseRegistryService().lookupHealthReference(applicationId);
  if (!healthReference) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  return NextResponse.json({ healthReference }, { status: 200 });
}

export async function handleLookupCapabilities(applicationId: string): Promise<NextResponse> {
  const capabilities = await getEnterpriseRegistryService().lookupCapabilities(applicationId);
  if (!capabilities) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  return NextResponse.json({ capabilities }, { status: 200 });
}
