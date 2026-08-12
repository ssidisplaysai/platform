import { NextResponse } from "next/server";
import { getMissionControlService } from "@/platform/gmc";
import type { ApplicationSearchQuery } from "@/platform/gmc";

function toQuery(request: Request): ApplicationSearchQuery {
  const params = new URL(request.url, "http://localhost").searchParams;

  const compatibilityRaw = params.get("compatibility");
  const compatibility = compatibilityRaw === "compatible" || compatibilityRaw === "incompatible"
    ? compatibilityRaw
    : undefined;

  return {
    q: params.get("q") ?? undefined,
    company: params.get("company") ?? undefined,
    category: params.get("category") ?? undefined,
    health: params.get("health") ?? undefined,
    availability: params.get("availability") ?? undefined,
    compatibility,
    capability: params.get("capability") ?? undefined,
    status: params.get("status") ?? undefined,
  };
}

export async function handleWorkspace(): Promise<NextResponse> {
  const workspace = await (await getMissionControlService()).assembleWorkspace();
  return NextResponse.json({ workspace }, { status: 200 });
}

export async function handleApplications(request: Request): Promise<NextResponse> {
  const applications = await (await getMissionControlService()).listApplications(toQuery(request));
  return NextResponse.json({ applications }, { status: 200 });
}

export async function handleNavigation(): Promise<NextResponse> {
  const navigation = await (await getMissionControlService()).getNavigation();
  return NextResponse.json({ navigation }, { status: 200 });
}

export async function handleDashboard(): Promise<NextResponse> {
  const dashboard = await (await getMissionControlService()).getDashboard();
  return NextResponse.json({ dashboard }, { status: 200 });
}

export async function handleLaunchMetadata(applicationId: string): Promise<NextResponse> {
  const launchMetadata = await (await getMissionControlService()).getLaunchMetadata(applicationId);
  if (!launchMetadata) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  if (!launchMetadata.launchAllowed) {
    return NextResponse.json(
      {
        error: "Launch blocked by policy.",
        launchMetadata,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ launchMetadata }, { status: 200 });
}

export async function handleSearch(request: Request): Promise<NextResponse> {
  const query = new URL(request.url, "http://localhost").searchParams.get("q") ?? "";
  const results = await (await getMissionControlService()).searchApplications(query);
  return NextResponse.json({ results }, { status: 200 });
}

export async function handleHealthSummary(): Promise<NextResponse> {
  const healthSummary = await (await getMissionControlService()).getHealthSummary();
  return NextResponse.json({ healthSummary }, { status: 200 });
}

export async function handleFilters(): Promise<NextResponse> {
  const filters = await (await getMissionControlService()).getFilters();
  return NextResponse.json({ filters }, { status: 200 });
}
