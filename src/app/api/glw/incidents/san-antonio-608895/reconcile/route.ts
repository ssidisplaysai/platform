import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestPrincipal, resolveRequestScope } from "@/modules/foundation/api-auth";
import { createSanAntonio608895ReconciliationService, SAN_ANTONIO_608895_IDENTITY } from "@/modules/glw/san-antonio-608895-reconciliation";

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok || !auth.roles.includes("platform_admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const principal = resolveRequestPrincipal(request);
  const scope = resolveRequestScope(request);
  if (!principal || scope.organizationId !== SAN_ANTONIO_608895_IDENTITY.organizationId || scope.siteId !== SAN_ANTONIO_608895_IDENTITY.siteId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || body.confirm !== "SAN_ANTONIO_608895_OWNER_AUTHORIZED_RECONCILIATION_V1" || body.campaignId !== SAN_ANTONIO_608895_IDENTITY.campaignId || body.targetId !== SAN_ANTONIO_608895_IDENTITY.targetId || body.jobId !== SAN_ANTONIO_608895_IDENTITY.jobId || body.leaseId !== SAN_ANTONIO_608895_IDENTITY.leaseId || body.externalExecutionId !== SAN_ANTONIO_608895_IDENTITY.externalExecutionId) return NextResponse.json({ error: "Exact incident identity and owner confirmation are required." }, { status: 400 });
  const runtimeSha = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
  try {
    const result = await createSanAntonio608895ReconciliationService()(principal, runtimeSha);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reconciliation failed." }, { status: 409 });
  }
}