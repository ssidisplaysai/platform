import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getIntegrationProfileById,
  evaluateAllProfileReadiness,
  evaluateProfileReadiness,
} from "@/modules/foundation/integration-profile-repository";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "profiles:evaluate_readiness");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profileId = request.nextUrl.searchParams.get("profileId");

  if (profileId) {
    const profile = getIntegrationProfileById(profileId);
    if (!profile || profile.organizationId !== scope.organizationId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (scope.siteId && !profile.assignedSiteIds.includes(scope.siteId)) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const readiness = evaluateProfileReadiness(profileId);
    if (!readiness) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ readiness });
  }

  return NextResponse.json({
    readiness: evaluateAllProfileReadiness({
      organizationId: scope.organizationId ?? undefined,
      siteId: scope.siteId ?? undefined,
    }),
  });
}
