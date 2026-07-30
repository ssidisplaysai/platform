import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
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
  if (!isAuthorized(request, "profiles:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const profiles = listIntegrationProfiles({
    organizationId: searchParams.get("organizationId") ?? undefined,
    profileType: parseProfileType(searchParams.get("profileType")),
    query: searchParams.get("query") ?? undefined,
    enabled: searchParams.get("enabled") === "true"
      ? true
      : searchParams.get("enabled") === "false"
        ? false
        : undefined,
    siteId: searchParams.get("siteId") ?? undefined,
  });

  return NextResponse.json({ profiles });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request, "profiles:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
