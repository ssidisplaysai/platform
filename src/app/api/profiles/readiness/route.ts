import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import {
  evaluateAllProfileReadiness,
  evaluateProfileReadiness,
} from "@/modules/foundation/integration-profile-repository";

export async function GET(request: NextRequest) {
  if (!isAuthorized(request, "profiles:evaluate_readiness")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profileId = request.nextUrl.searchParams.get("profileId");

  if (profileId) {
    const readiness = evaluateProfileReadiness(profileId);
    if (!readiness) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ readiness });
  }

  return NextResponse.json({ readiness: evaluateAllProfileReadiness() });
}
