import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import {
  listIntegrationProfileAssignments,
  listIntegrationProfiles,
  validateProfileAssignmentIntegrity,
} from "@/modules/foundation/integration-profile-repository";
import { validateNewIntegrationProfileInput } from "@/modules/foundation/integration-profile-validation";
import type { NewIntegrationProfileInput } from "@/modules/foundation/types";

export async function POST(request: NextRequest) {
  if (!isAuthorized(request, "profiles:validate")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    profile?: NewIntegrationProfileInput;
  };

  const profileValidation = body.profile
    ? validateNewIntegrationProfileInput(body.profile)
    : { valid: true, issues: [] };

  const assignmentValidation = validateProfileAssignmentIntegrity();

  return NextResponse.json({
    profileValidation,
    assignmentValidation,
    profileCount: listIntegrationProfiles().length,
    assignmentCount: listIntegrationProfileAssignments().length,
  });
}
