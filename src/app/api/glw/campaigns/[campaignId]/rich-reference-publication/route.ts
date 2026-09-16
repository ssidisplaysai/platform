import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { OPERATOR_SESSION_COOKIE } from "@/modules/foundation/operator-session";
import { certifyExactPublicRichReference, executeAuthorizedExactWordPressOperation, issueVerifiedExactOperationGrant, issueVerifiedExactOperationPreflight, verifyExactPublicCanonical } from "@/modules/glw/exact-publication-rollback-service";
import { EXACT_WORDPRESS_PUBLICATION, EXACT_WORDPRESS_ROLLBACK, resolveExactPublicationRollbackLiveAuthority } from "@/modules/glw/exact-publication-rollback-live-authority";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ campaignId: string }> };
type Action = "RUN_PREFLIGHT" | "AUTHORIZE" | "EXECUTE";

function operation(value: unknown) {
  if (value === EXACT_WORDPRESS_PUBLICATION || value === EXACT_WORDPRESS_ROLLBACK) return value;
  throw new Error("EXACT_OPERATION_INVALID");
}

async function resolveLive(request: NextRequest, context: Context, input: { targetId: string; operation: unknown; visualCertificationId?: string | null; sourcePublicationReceiptId?: string | null }) {
  const { campaignId } = await context.params;
  return resolveExactPublicationRollbackLiveAuthority({ campaignId, targetId: input.targetId, operation: operation(input.operation), visualCertificationId: input.visualCertificationId, sourcePublicationReceiptId: input.sourcePublicationReceiptId, runtimeSha: process.env.GIT_COMMIT?.trim().toLowerCase() ?? "" });
}

export async function GET(request: NextRequest, route: Context) {
  if (!request.cookies.get(OPERATOR_SESSION_COOKIE)?.value) return NextResponse.json({ error: "A server-verified operator session is required.", callerSuppliedRoleHeadersAuthorize: false, callerSuppliedEmailHeadersAuthorize: false }, { status: 401 });
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:read");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) return NextResponse.json({ error: "A server-verified operator session is required.", callerSuppliedRoleHeadersAuthorize: false, callerSuppliedEmailHeadersAuthorize: false }, { status: 401 });
  try {
    const live = await resolveLive(request, route, { targetId: request.nextUrl.searchParams.get("targetId") ?? "", operation: request.nextUrl.searchParams.get("operation"), visualCertificationId: request.nextUrl.searchParams.get("visualCertificationId"), sourcePublicationReceiptId: request.nextUrl.searchParams.get("sourcePublicationReceiptId") });
    if (live.context.organizationId !== scope.organizationId || live.context.siteId !== scope.siteId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ context: live.context, wordpressAuthority: { ...live.snapshot, rawPostContent: undefined }, certification: { certificationId: live.draftCertification.certificationId, overallState: live.draftCertification.overallState, identity: live.draftCertification.identity }, publicationMutation: false, rollbackMutation: false, callerSuppliedRoleHeadersAuthorize: false, callerSuppliedEmailHeadersAuthorize: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "EXACT_OPERATION_PREFLIGHT_FAILED", publicationMutation: false, rollbackMutation: false }, { status: 409 });
  }
}

export async function POST(request: NextRequest, route: Context) {
  if (!request.cookies.get(OPERATOR_SESSION_COOKIE)?.value) return NextResponse.json({ error: "A server-verified operator session is required.", callerSuppliedRoleHeadersAuthorize: false, callerSuppliedEmailHeadersAuthorize: false }, { status: 401 });
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) return NextResponse.json({ error: "A server-verified operator session is required.", callerSuppliedRoleHeadersAuthorize: false, callerSuppliedEmailHeadersAuthorize: false }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: Action; targetId?: string; operation?: unknown; visualCertificationId?: string | null; sourcePublicationReceiptId?: string | null; preflightId?: string; grantId?: string } | null;
  if (!body?.action || !body.targetId) return NextResponse.json({ error: "Exact operation action and target are required." }, { status: 400 });
  try {
    const live = await resolveLive(request, route, { targetId: body.targetId, operation: body.operation, visualCertificationId: body.visualCertificationId, sourcePublicationReceiptId: body.sourcePublicationReceiptId });
    if (live.context.organizationId !== scope.organizationId || live.context.siteId !== scope.siteId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (body.action === "RUN_PREFLIGHT") {
      const preflight = issueVerifiedExactOperationPreflight({ context: live.context, principal: principal.principal, snapshot: live.snapshot, draftCertification: live.context.operation === EXACT_WORDPRESS_PUBLICATION ? live.draftCertification : undefined, publicationReceipt: live.sourceReceipt ? { receiptId: live.sourceReceipt.receiptId, wordpressObjectId: live.sourceReceipt.wordpressObjectId, afterContentSha: live.sourceReceipt.afterContentSha, afterStatus: live.sourceReceipt.afterStatus } : undefined });
      return NextResponse.json({ preflight, publicationMutation: false, rollbackMutation: false });
    }
    if (!body.preflightId) return NextResponse.json({ error: "Exact preflight is required." }, { status: 400 });
    if (body.action === "AUTHORIZE") {
      const grant = issueVerifiedExactOperationGrant({ preflightId: body.preflightId, context: live.context, principal: principal.principal });
      return NextResponse.json({ grant, publicationMutation: false, rollbackMutation: false });
    }
    if (!body.grantId) return NextResponse.json({ error: "Exact single-use grant is required." }, { status: 400 });
    const receipt = await executeAuthorizedExactWordPressOperation({ context: live.context, principal: principal.principal, preflightId: body.preflightId, grantId: body.grantId, site: live.site, adapters: { readExactWordPressAuthority: live.readExactWordPressAuthority, verifyPublicCanonical: live.context.operation === EXACT_WORDPRESS_PUBLICATION ? () => verifyExactPublicCanonical({ context: live.context, site: live.site }) : undefined, certifyActualPublicHost: live.context.operation === EXACT_WORDPRESS_PUBLICATION ? () => certifyExactPublicRichReference({ context: live.context, site: live.site, principal: principal.principal }) : undefined } });
    return NextResponse.json({ receipt, publicationMutation: live.context.operation === EXACT_WORDPRESS_PUBLICATION, rollbackMutation: live.context.operation === EXACT_WORDPRESS_ROLLBACK, generationAttempted: false, n8nExecutionCreated: false, mcpExecuteWorkflowInvoked: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "EXACT_OPERATION_FAILED", publicationMutation: false, rollbackMutation: false, automaticRollbackPerformed: false, generationAttempted: false, n8nExecutionCreated: false, mcpExecuteWorkflowInvoked: false }, { status: 409 });
  }
}
