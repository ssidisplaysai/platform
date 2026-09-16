import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";

import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { repairEligibleRichPageNativeTitle } from "@/modules/foundation/eligible-rich-page-host-title-repair";
import { OPERATOR_SESSION_COOKIE } from "@/modules/foundation/operator-session";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { EXACT_WORDPRESS_PUBLICATION, listExactPublicationRollbackReceipts } from "@/modules/glw/exact-publication-rollback-authority";
import { assertActualPublicHostCertification, certifyExactPublicRichReference, verifyExactPublicCanonical } from "@/modules/glw/exact-publication-rollback-service";
import { beginRichReferenceHostRepair, updateRichReferenceHostRepair } from "@/modules/glw/rich-reference-host-repair-repository";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ campaignId: string }> };

function authorize(request: NextRequest, permission: "sites:read" | "sites:update") {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, permission);
  const scope = resolveRequestScope(request);
  if (!request.cookies.get(OPERATOR_SESSION_COOKIE)?.value || !principal.ok || !auth.ok || !auth.roles.includes("platform_admin") || !hasOrganizationScope(scope) || !scope.siteId) throw new Error("HOST_REPAIR_AUTHENTICATED_PLATFORM_ADMIN_REQUIRED");
  return { principal: principal.principal, scope };
}

async function live(request: NextRequest, route: Context) {
  const { campaignId } = await route.params;
  const targetId = request.nextUrl.searchParams.get("targetId") ?? "";
  const receipt = listExactPublicationRollbackReceipts().findLast((item) => item.operation === EXACT_WORDPRESS_PUBLICATION && item.campaignId === campaignId && item.targetId === targetId && item.afterStatus === "publish" && item.lifecycleState === "PUBLIC_CERTIFICATION_FAILED") ?? null;
  if (!receipt) throw new Error("HOST_REPAIR_FAILED_PUBLICATION_RECEIPT_REQUIRED");
  const site = getSiteById(receipt.siteId);
  if (!site || !site.integrations.wordpressApiBaseUrl) throw new Error("HOST_REPAIR_SITE_AUTHORITY_REQUIRED");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential) throw new Error("HOST_REPAIR_WORDPRESS_CREDENTIAL_REQUIRED");
  const reader = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
  const readPage = async (objectId: string) => reader.getJson({ path: `/pages/${objectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,status,parent,slug,title,content,featured_media,meta,link" }) });
  const child = await readPage(receipt.wordpressObjectId);
  if (!child.ok || !child.body || typeof child.body !== "object" || Array.isArray(child.body)) throw new Error("HOST_REPAIR_CHILD_READ_FAILED");
  const parent = await readPage(receipt.parentObjectId);
  const parentStatus = parent.ok && parent.body && typeof parent.body === "object" && !Array.isArray(parent.body) ? String((parent.body as Record<string, unknown>).status ?? "") : null;
  return { receipt, site, child: child.body as Record<string, unknown>, parentStatus };
}

function identityFrom(receipt: ReturnType<typeof listExactPublicationRollbackReceipts>[number]) {
  return { organizationId: receipt.organizationId, siteId: receipt.siteId, productId: receipt.productId, pageType: "LOCATION_SERVICE" as const, wordpressObjectId: receipt.wordpressObjectId, parentObjectId: receipt.parentObjectId, slug: receipt.slug, title: receipt.expectedTitle, featuredMediaId: receipt.featuredMediaId, storedPostContentSha: receipt.storedPostContentSha };
}

export async function GET(request: NextRequest, route: Context) {
  try {
    const { scope } = authorize(request, "sites:read");
    const resolved = await live(request, route);
    if (resolved.receipt.organizationId !== scope.organizationId || resolved.receipt.siteId !== scope.siteId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const content = resolved.child.content && typeof resolved.child.content === "object" && !Array.isArray(resolved.child.content) ? resolved.child.content as Record<string, unknown> : {};
    return NextResponse.json({ sourcePublicationReceiptId: resolved.receipt.receiptId, identity: identityFrom(resolved.receipt), wordpress: { id: resolved.child.id, status: resolved.child.status, parent: resolved.child.parent, slug: resolved.child.slug, title: resolved.child.title, featuredMediaId: resolved.child.featured_media, contentPresent: typeof content.raw === "string", meta: resolved.child.meta, parentStatus: resolved.parentStatus }, hostPresentationMutation: false, postContentMutation: false, publicationTransaction: false, rollback: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "HOST_REPAIR_PREFLIGHT_FAILED", hostPresentationMutation: false, postContentMutation: false, publicationTransaction: false, rollback: false }, { status: 409 });
  }
}

export async function POST(request: NextRequest, route: Context) {
  let repairReceiptId: string | null = null;
  let hostPresentationMutationPerformed = false;
  try {
    const { principal, scope } = authorize(request, "sites:update");
    const body = await request.json().catch(() => null) as { action?: string; sourcePublicationReceiptId?: string; wordpressObjectId?: string; storedPostContentSha?: string } | null;
    if (body?.action !== "REPAIR_AND_CERTIFY" || !body.sourcePublicationReceiptId || !body.wordpressObjectId || !body.storedPostContentSha) return NextResponse.json({ error: "HOST_REPAIR_EXACT_BINDING_REQUIRED" }, { status: 400 });
    const resolved = await live(request, route);
    if (resolved.receipt.organizationId !== scope.organizationId || resolved.receipt.siteId !== scope.siteId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (body.sourcePublicationReceiptId !== resolved.receipt.receiptId || body.wordpressObjectId !== resolved.receipt.wordpressObjectId || body.storedPostContentSha !== resolved.receipt.storedPostContentSha) throw new Error("HOST_REPAIR_EXACT_BINDING_MISMATCH");
    const startedAt = Date.now();
    const durableIntent = beginRichReferenceHostRepair({ sourcePublicationReceiptId: resolved.receipt.receiptId, organizationId: resolved.receipt.organizationId, siteId: resolved.receipt.siteId, campaignId: resolved.receipt.campaignId, targetId: resolved.receipt.targetId, wordpressObjectId: resolved.receipt.wordpressObjectId, storedPostContentSha: resolved.receipt.storedPostContentSha, principalId: principal.principalId });
    repairReceiptId = durableIntent.repairReceiptId;
    if (durableIntent.lifecycleState === "PUBLIC_CERTIFIED") throw new Error("HOST_REPAIR_ALREADY_PUBLIC_CERTIFIED");
    const repair = await repairEligibleRichPageNativeTitle({ site: resolved.site, identity: identityFrom(resolved.receipt) });
    hostPresentationMutationPerformed = repair.hostPresentationRepairPerformed;
    updateRichReferenceHostRepair({ repairReceiptId, lifecycleState: "HOST_REPAIRED_AWAITING_CERTIFICATION", hostPresentationMutationPerformed });
    const context = { ...resolved.receipt, operation: EXACT_WORDPRESS_PUBLICATION };
    const canonical = await verifyExactPublicCanonical({ context, site: resolved.site });
    if (!resolved.site.canonicalUrl) throw new Error("HOST_REPAIR_CANONICAL_AUTHORITY_REQUIRED");
    const expectedUrl = new URL(context.canonicalPath, resolved.site.canonicalUrl).toString();
    if (canonical.status !== 200 || canonical.finalUrl !== expectedUrl || canonical.canonicalUrl !== expectedUrl) throw new Error("HOST_REPAIR_CANONICAL_VERIFICATION_FAILED");
    const publicResponse = await fetch(expectedUrl, { cache: "no-store", headers: { "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" }, signal: AbortSignal.timeout(30_000) });
    const $ = load(await publicResponse.text());
    const h1Texts = $("h1").map((_, element) => $(element).text().replace(/\s+/g, " ").trim()).get();
    if (publicResponse.status !== 200 || h1Texts.length !== 1 || h1Texts[0] !== context.expectedH1) throw new Error("EXACT_PUBLIC_HOST_H1_MISMATCH");
    const evidence = await certifyExactPublicRichReference({ context, site: resolved.site, principal });
    assertActualPublicHostCertification({ context, evidence });
    const durableReceipt = updateRichReferenceHostRepair({ repairReceiptId, lifecycleState: "PUBLIC_CERTIFIED", hostPresentationMutationPerformed, publicCertificationId: evidence.certification.certificationId });
    const captures = evidence.certification.captures;
    const desktop = captures.find((item) => item.viewportClass === "DESKTOP" && item.viewportWidth === 1440 && item.viewportHeight === 1000);
    const mobile = captures.find((item) => item.viewportClass === "MOBILE" && item.viewportWidth === 375 && item.viewportHeight === 812);
    return NextResponse.json({ durableReceipt, repair, parentStatus: resolved.parentStatus, publicReadback: { status: publicResponse.status, h1Count: h1Texts.length, h1Texts, canonical: canonical.canonicalUrl }, certification: { certificationId: evidence.certification.certificationId, lifecycleState: "PUBLIC_CERTIFIED", desktop: desktop ? "PASS" : "FAIL", mobile: mobile ? "PASS" : "FAIL", heroRendered: captures.every((item) => item.hero.present), supportingMediaRendered: captures.every((item) => item.media.some((media) => media.semanticRole !== "PRODUCT_AUTHORITY" && media.rendered)), brokenImages: evidence.brokenImages, blankImageContainers: captures.reduce((sum, item) => sum + item.hostIntegration.blankImageContainers, 0), horizontalOverflow: captures.reduce((sum, item) => sum + item.horizontalOverflow, 0), clippedHeadings: evidence.clippedHeadings, headerOverlap: captures.some((item) => item.hostIntegration.headerOverlap), footerOverlap: captures.some((item) => item.hostIntegration.footerOverlap), ctaVisible: captures.every((item) => Boolean(item.hero.primaryCtaBounds)), mobileReadability: Boolean(mobile && mobile.horizontalOverflow === 0 && mobile.hero.present && mobile.hero.headingBounds && mobile.hero.primaryCtaBounds && !mobile.hostIntegration.headerOverlap && !mobile.hostIntegration.footerOverlap), internalGovernanceLanguage: evidence.internalGovernanceLanguage, previewOrDevelopmentLinks: evidence.previewOrDevLinks, unexpectedStateContamination: evidence.unexpectedStateContamination, unsupportedFactualRegression: evidence.unsupportedFactualRegression, canonicalCorrect: true }, economics: { engineeringInterventionCount: 1, n8nExecutionsUsed: 0, generationExecutionsUsed: 0, imageGenerationsUsed: 0, publicationTransactionsAdded: 0, repairElapsedTimeMinutes: Number(((Date.now() - startedAt) / 60_000).toFixed(3)), repairComputeOrApiCost: null, repairCostDataAvailable: false }, campaignContinuation: false, alaskaGeneration: false, n8nExecutionCreated: false, mcpExecuteWorkflowInvoked: false, imageGenerationAttempted: false, publicationTransactionPerformed: false, rollbackPerformed: false });
  } catch (error) {
    const failureCode = error instanceof Error ? error.message : "HOST_REPAIR_FAILED";
    if (repairReceiptId) {
      try { updateRichReferenceHostRepair({ repairReceiptId, lifecycleState: "PUBLIC_CERTIFICATION_FAILED", hostPresentationMutationPerformed, failureCode }); } catch { /* Preserve the original failure. */ }
    }
    return NextResponse.json({ error: failureCode, repairReceiptId, hostPresentationMutationPerformed, publicationTransactionPerformed: false, rollbackPerformed: false, n8nExecutionCreated: false, mcpExecuteWorkflowInvoked: false, imageGenerationAttempted: false, campaignContinuation: false, alaskaGeneration: false }, { status: 409 });
  }
}
