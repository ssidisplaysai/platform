import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { runGovernedRenderCapture, signGovernedSnapshotPath, type CaptureAuthority } from "@/modules/foundation/governed-render-capture-orchestrator";
import { candidateVisualSummary } from "@/modules/glw/indiana-rich-reference-candidate";
import { authorizeIndianaPersistence, createIndianaPersistencePreflight, evaluateIndianaStoredDraft, getIndianaPersistenceState, inspectIndianaWordPressDraft, persistIndianaCandidate } from "@/modules/glw/indiana-rich-reference-persistence";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ campaignId: string }> };
const CAMPAIGN_ID = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview";
const PAGE_ID = "outdoor-digital-sphere-indiana-wordpress-draft";

async function auth(request: NextRequest, context: Context) {
  const principal = resolveGlwTrustedOperatorPrincipal(request); const authorized = authorizeRequest(request, "sites:update"); const scope = resolveRequestScope(request); const { campaignId } = await context.params;
  if (!principal.ok || !authorized.ok || !hasOrganizationScope(scope) || scope.organizationId !== "led-display-warehouse" || scope.siteId !== "site-led-display-warehouse-production" || campaignId !== CAMPAIGN_ID) throw new Error("INDIANA_PERSISTENCE_UNAUTHORIZED");
  return principal.principal;
}
export async function GET(request: NextRequest, context: Context) {
  try { await auth(request, context); const wordpress = await inspectIndianaWordPressDraft(); return NextResponse.json({ state: getIndianaPersistenceState(), wordpress, storedQa: evaluateIndianaStoredDraft({ candidateId: "indiana-rich-reference-candidate-85ab1787c55ef4f97c8f2956", candidateSha: "85ab1787c55ef4f97c8f29561493e6e67da60b7bd2d3062a4b8ea713e4efc62c", html: wordpress.raw || wordpress.rendered }), callerSuppliedRoleHeadersAuthorize: false }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "INDIANA_PERSISTENCE_FAILED", callerSuppliedRoleHeadersAuthorize: false }, { status: 401 }); }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const principal = await auth(request, context); const runtimeSha = process.env.GIT_COMMIT?.trim().toLowerCase() ?? ""; const body = await request.json().catch(() => null) as { action?: "RUN_PREFLIGHT" | "AUTHORIZE" | "PERSIST" | "CERTIFY"; preflightId?: string; grantId?: string } | null;
    if (body?.action === "RUN_PREFLIGHT") { const result = await createIndianaPersistencePreflight({ principal, runtimeSha }); return NextResponse.json({ preflight: result.preflight, before: result.before, wordpressMutation: false }); }
    if (body?.action === "AUTHORIZE" && body.preflightId) { const result = await authorizeIndianaPersistence({ principal, runtimeSha, preflightId: body.preflightId }); return NextResponse.json({ grant: result.grant, wordpressMutation: false }); }
    if (body?.action === "PERSIST" && body.preflightId && body.grantId) { const result = await persistIndianaCandidate({ principal, runtimeSha, preflightId: body.preflightId, grantId: body.grantId }); return NextResponse.json({ receipt: result.receipt, storedQa: evaluateIndianaStoredDraft({ candidateId: result.candidate.candidateId, candidateSha: result.candidate.candidateSha, html: result.receipt.after.raw || result.receipt.after.rendered }), candidateId: result.candidate.candidateId, candidateSha: result.candidate.candidateSha, wordpressMutation: true, publicationMutation: false, wordpressObjectCreated: false }); }
    if (body?.action === "CERTIFY") {
      const draft = await inspectIndianaWordPressDraft(); const receipt = getIndianaPersistenceState().receipts.at(-1); if (!receipt || receipt.after.contentSha !== draft.contentSha) throw new Error("INDIANA_PERSISTENCE_RECEIPT_REQUIRED");
      const query = new URLSearchParams({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", contentSha: draft.contentSha }); const pathname = `/api/glw/campaigns/${CAMPAIGN_ID}/rich-reference-persistence/snapshot`; const signedPath = `${pathname}?${query.toString()}`; const origin = request.nextUrl.origin;
      const authority: CaptureAuthority = { identity: { organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", pageId: PAGE_ID, pageRevisionIdentity: `wordpress:20115:${draft.modified}`, canonicalPath: "/outdoor-digital-sphere/indiana/", contentHash: draft.contentSha, renderedContentHash: null, campaignId: CAMPAIGN_ID, targetId: null, jobId: null, externalExecutionId: null, wordpressObjectId: "20115", wordpressStatus: "draft" }, targetUrl: `${origin}${signedPath}`, allowedOrigins: [origin, "https://leddisplaywarehouse.com"], internalGenesisOrigin: origin, internalAuthorization: { header: "x-genesis-render-capture", value: signGovernedSnapshotPath(signedPath) }, layoutClass: "FULL_WIDTH_MARKETING_PAGE", mediaAssignments: [] };
      const capture = await runGovernedRenderCapture({ authority, mode: "FORCE", actor: principal.principalId }); return NextResponse.json({ certification: capture.certification, visualSummary: candidateVisualSummary(capture.certification), wordpressMutation: false, publicationMutation: false });
    }
    throw new Error("INDIANA_PERSISTENCE_ACTION_INVALID");
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "INDIANA_PERSISTENCE_FAILED", wordpressMutation: false, publicationMutation: false }, { status: 409 }); }
}
