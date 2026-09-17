import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { OPERATOR_SESSION_COOKIE } from "@/modules/foundation/operator-session";
import {
  executeUnauthorizedPublicationIncidentRollback,
  INCIDENT_OWNER_AUTHORIZATION_CONFIRMATION,
  runUnauthorizedPublicationIncidentRollbackPreflight,
  type UnauthorizedPublicationIncidentOwnerAuthorization,
} from "@/modules/glw/unauthorized-publication-incident-rollback";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ campaignId: string }> };
type Action = "RUN_PREFLIGHT" | "EXECUTE";

function runtimeSha(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.GIT_COMMIT?.trim().toLowerCase() ?? "";
}

export async function GET(request: NextRequest, route: Context) {
  if (!request.cookies.get(OPERATOR_SESSION_COOKIE)?.value) {
    return NextResponse.json({ error: "A server-verified operator session is required.", callerSuppliedRoleHeadersAuthorize: false, callerSuppliedEmailHeadersAuthorize: false }, { status: 401 });
  }
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:read");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) {
    return NextResponse.json({ error: "A server-verified operator session is required.", callerSuppliedRoleHeadersAuthorize: false, callerSuppliedEmailHeadersAuthorize: false }, { status: 401 });
  }

  const { campaignId } = await route.params;
  const targetId = request.nextUrl.searchParams.get("targetId") ?? "";
  const jobId = request.nextUrl.searchParams.get("jobId") ?? "";
  const executionId = request.nextUrl.searchParams.get("executionId") ?? "";
  const wordpressObjectId = request.nextUrl.searchParams.get("wordpressObjectId") ?? "";

  try {
    const preflight = await runUnauthorizedPublicationIncidentRollbackPreflight({
      campaignId,
      targetId,
      jobId,
      executionId,
      wordpressObjectId,
      runtimeSha: runtimeSha(),
    });
    if (preflight.identity.organizationId !== scope.organizationId || preflight.identity.siteId !== scope.siteId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({
      preflight,
      publicationMutation: false,
      rollbackMutation: false,
      generationAttempted: false,
      imageGenerationAttempted: false,
      n8nExecutionCreated: false,
      dispatchAttempted: false,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "INCIDENT_ROLLBACK_PREFLIGHT_FAILED",
      publicationMutation: false,
      rollbackMutation: false,
      generationAttempted: false,
      imageGenerationAttempted: false,
      n8nExecutionCreated: false,
      dispatchAttempted: false,
    }, { status: 409 });
  }
}

export async function POST(request: NextRequest, route: Context) {
  if (!request.cookies.get(OPERATOR_SESSION_COOKIE)?.value) {
    return NextResponse.json({ error: "A server-verified operator session is required.", callerSuppliedRoleHeadersAuthorize: false, callerSuppliedEmailHeadersAuthorize: false }, { status: 401 });
  }
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) {
    return NextResponse.json({ error: "A server-verified operator session is required.", callerSuppliedRoleHeadersAuthorize: false, callerSuppliedEmailHeadersAuthorize: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    action?: Action;
    targetId?: string;
    jobId?: string;
    executionId?: string;
    wordpressObjectId?: string;
    preflightContextFingerprint?: string;
    ownerAuthorization?: UnauthorizedPublicationIncidentOwnerAuthorization;
  } | null;

  if (!body?.action || !body.targetId || !body.jobId || !body.executionId || !body.wordpressObjectId) {
    return NextResponse.json({ error: "Incident rollback action and exact identity are required." }, { status: 400 });
  }

  const { campaignId } = await route.params;

  try {
    const preflight = await runUnauthorizedPublicationIncidentRollbackPreflight({
      campaignId,
      targetId: body.targetId,
      jobId: body.jobId,
      executionId: body.executionId,
      wordpressObjectId: body.wordpressObjectId,
      runtimeSha: runtimeSha(),
    });

    if (preflight.identity.organizationId !== scope.organizationId || preflight.identity.siteId !== scope.siteId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (body.action === "RUN_PREFLIGHT") {
      return NextResponse.json({
        preflight,
        requiredOwnerAuthorization: {
          confirm: INCIDENT_OWNER_AUTHORIZATION_CONFIRMATION,
          ownerPrincipalId: principal.principal.principalId,
        },
        publicationMutation: false,
        rollbackMutation: false,
        generationAttempted: false,
        imageGenerationAttempted: false,
        n8nExecutionCreated: false,
        dispatchAttempted: false,
      });
    }

    if (!body.ownerAuthorization || !body.preflightContextFingerprint || body.preflightContextFingerprint !== preflight.contextFingerprint) {
      return NextResponse.json({ error: "Current incident preflight fingerprint and explicit owner authorization are required." }, { status: 400 });
    }

    const receipt = await executeUnauthorizedPublicationIncidentRollback({
      preflight,
      principal: principal.principal,
      ownerAuthorization: body.ownerAuthorization,
    });

    return NextResponse.json({
      receipt,
      publicationMutation: false,
      rollbackMutation: true,
      generationAttempted: false,
      imageGenerationAttempted: false,
      n8nExecutionCreated: false,
      dispatchAttempted: false,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "INCIDENT_ROLLBACK_FAILED",
      publicationMutation: false,
      rollbackMutation: false,
      generationAttempted: false,
      imageGenerationAttempted: false,
      n8nExecutionCreated: false,
      dispatchAttempted: false,
    }, { status: 409 });
  }
}
