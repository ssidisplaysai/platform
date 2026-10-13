import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestPrincipal,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createGlwCampaign,
  listGlwCampaigns,
} from "@/modules/glw/campaign-repository";
import type { NewGlwCampaignInput } from "@/modules/glw/campaign-types";

type ScopeRejectionCode =
  | "AUTH_SCOPE_MISSING_ORG"
  | "AUTH_SCOPE_ORG_MISMATCH"
  | "AUTH_SCOPE_SITE_MISMATCH"
  | "AUTH_MUTATION_VALIDATION_FAILED";

function forbiddenScope(input: {
  request: NextRequest;
  code: ScopeRejectionCode;
  resolvedOrganizationId: string | null;
  resolvedSiteId: string | null;
  payloadOrganizationId?: string | null;
  payloadSiteId?: string | null;
}): NextResponse {
  const principal = resolveRequestPrincipal(input.request);
  console.warn("[glw.campaigns.create.rejected]", {
    route: `${input.request.method.toUpperCase()} /api/glw/campaigns`,
    principalId: principal?.principalId ?? null,
    resolvedOrganizationId: input.resolvedOrganizationId,
    resolvedSiteId: input.resolvedSiteId,
    payloadOrganizationId: input.payloadOrganizationId ?? null,
    payloadSiteId: input.payloadSiteId ?? null,
    rejectionCode: input.code,
  });

  return NextResponse.json(
    { error: "Forbidden", code: input.code },
    { status: 403 },
  );
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "schedules:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaigns = listGlwCampaigns().filter(
    (campaign) =>
      campaign.organizationId === scope.organizationId &&
      (!scope.siteId || campaign.siteId === scope.siteId),
  );

  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) {
    if (auth.status === 403) {
      const scope = resolveRequestScope(request);
      return forbiddenScope({
        request,
        code: "AUTH_MUTATION_VALIDATION_FAILED",
        resolvedOrganizationId: scope.organizationId,
        resolvedSiteId: scope.siteId,
      });
    }
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return forbiddenScope({
      request,
      code: "AUTH_SCOPE_MISSING_ORG",
      resolvedOrganizationId: scope.organizationId,
      resolvedSiteId: scope.siteId,
    });
  }

  const body = (await request.json()) as NewGlwCampaignInput;
  if (body.organizationId !== scope.organizationId) {
    return forbiddenScope({
      request,
      code: "AUTH_SCOPE_ORG_MISMATCH",
      resolvedOrganizationId: scope.organizationId,
      resolvedSiteId: scope.siteId,
      payloadOrganizationId: body.organizationId,
      payloadSiteId: body.siteId,
    });
  }
  if (scope.siteId && body.siteId !== scope.siteId) {
    return forbiddenScope({
      request,
      code: "AUTH_SCOPE_SITE_MISMATCH",
      resolvedOrganizationId: scope.organizationId,
      resolvedSiteId: scope.siteId,
      payloadOrganizationId: body.organizationId,
      payloadSiteId: body.siteId,
    });
  }

  const result = createGlwCampaign(body);
  if (!result.campaign) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  return NextResponse.json({ campaign: result.campaign }, { status: 201 });
}
