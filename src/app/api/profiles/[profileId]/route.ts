import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getIntegrationProfileById,
  updateIntegrationProfile,
} from "@/modules/foundation/integration-profile-repository";
import type { UpdateIntegrationProfileInput } from "@/modules/foundation/types";

type RouteContext = {
  params: Promise<{
    profileId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "profiles:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { profileId } = await context.params;
  const profile = getIntegrationProfileById(profileId);

  if (!profile || profile.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (scope.siteId && !profile.assignedSiteIds.includes(scope.siteId)) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "profiles:update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { profileId } = await context.params;
  const patch = (await request.json()) as UpdateIntegrationProfileInput;
  const result = updateIntegrationProfile(profileId, patch);

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ profile: result.profile });
}
