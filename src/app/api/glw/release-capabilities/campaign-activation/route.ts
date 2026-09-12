import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import {
  enableGlwCampaignActivationReleaseCapability,
  resolveGlwCampaignActivationReleaseCapability,
} from "@/modules/glw/campaign-release-capability";

export const dynamic = "force-dynamic";
const EXACT_RELEASE_PATTERN = /^[0-9a-f]{40}$/;

function runningReleaseSha(): string | null {
  const value = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
  return EXACT_RELEASE_PATTERN.test(value) ? value : null;
}

function scoped(request: NextRequest) {
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope) || !scope.siteId) {
    return { error: NextResponse.json({ error: "Exact organization and site scope are required." }, { status: 403 }) };
  }
  return { organizationId: scope.organizationId, siteId: scope.siteId };
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "schedules:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = scoped(request);
  if ("error" in scope) return scope.error;
  const releaseSha = runningReleaseSha();
  const capability = resolveGlwCampaignActivationReleaseCapability({
    ...scope,
    runningReleaseSha: releaseSha ?? "",
  });
  return NextResponse.json({ operation: "GLW_CAMPAIGN_ACTIVATION", runningReleaseSha: releaseSha, capability, mutationPerformed: false });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.roles.includes("platform_admin")) return NextResponse.json({ error: "Release capability enablement requires platform_admin." }, { status: 403 });
  const scope = scoped(request);
  if ("error" in scope) return scope.error;
  const body = await request.json().catch(() => null) as { operation?: string; capabilityOperation?: string; releaseSha?: string } | null;
  if (body?.operation !== "ENABLE_RELEASE_CAPABILITY" || body.capabilityOperation !== "GLW_CAMPAIGN_ACTIVATION") {
    return NextResponse.json({ error: "Explicit GLW_CAMPAIGN_ACTIVATION capability enablement is required." }, { status: 400 });
  }
  const releaseSha = runningReleaseSha();
  if (!releaseSha || body.releaseSha?.trim().toLowerCase() !== releaseSha) {
    return NextResponse.json({ error: "Capability must target the exact running release SHA." }, { status: 409 });
  }
  const capability = enableGlwCampaignActivationReleaseCapability({
    ...scope,
    releaseSha,
    enabledBy: "platform_admin",
  });
  return NextResponse.json({ capability, ownerAuthorizationCreated: false, publicationAuthorized: false, activationPerformed: false }, { status: 201 });
}
