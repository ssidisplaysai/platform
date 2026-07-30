import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createIntegrationProfile,
  listIntegrationProfiles,
} from "@/modules/foundation/integration-profile-repository";
import type {
  IntegrationProfileType,
  NewIntegrationProfileInput,
} from "@/modules/foundation/types";

function parseProfileType(value: string | null): IntegrationProfileType | undefined {
  if (!value) {
    return undefined;
  }

  const profileTypes: readonly IntegrationProfileType[] = [
    "publishing",
    "wordpress",
    "workflow",
    "prompt",
    "image",
    "seo",
    "brand",
    "analytics",
  ];

  return profileTypes.includes(value as IntegrationProfileType)
    ? (value as IntegrationProfileType)
    : undefined;
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "profiles:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedOrganizationId = searchParams.get("organizationId");
  if (requestedOrganizationId && requestedOrganizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedSiteId = searchParams.get("siteId");
  if (scope.siteId && requestedSiteId && requestedSiteId !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profiles = listIntegrationProfiles({
    organizationId: scope.organizationId ?? undefined,
    profileType: parseProfileType(searchParams.get("profileType")),
    query: searchParams.get("query") ?? undefined,
    enabled: searchParams.get("enabled") === "true"
      ? true
      : searchParams.get("enabled") === "false"
        ? false
        : undefined,
    siteId: scope.siteId ?? requestedSiteId ?? undefined,
  });

  return NextResponse.json({ profiles });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "profiles:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as NewIntegrationProfileInput;
  const result = createIntegrationProfile(body);

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.profile) {
    return NextResponse.json({ error: "Unable to create profile." }, { status: 400 });
  }

  return NextResponse.json({ profile: result.profile }, { status: 201 });
}
