import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { inspectGlwReferenceParentInventory } from "@/modules/glw/reference-parent-inventory";
import {
  consumeGlwReferenceParentCreationGrant,
  GlwReferenceParentCreationAuthorityError,
  GLW_REFERENCE_PARENT_CREATION_OPERATION,
  issueGlwReferenceParentCreationGrant,
  issueGlwReferenceParentCreationPreflight,
  type GlwReferenceParentCreationContext,
} from "@/modules/glw/reference-parent-creation-authority";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ campaignId: string }> };
const TITLE = "Outdoor Digital Sphere";
const SLUG = "outdoor-digital-sphere";
const CANONICAL_PATH = "/outdoor-digital-sphere/";

async function live(input: { campaignId: string; organizationId: string; siteId: string }) {
  const campaign = listGlwCampaigns().find((candidate) => candidate.campaignId === input.campaignId && candidate.organizationId === input.organizationId && candidate.siteId === input.siteId);
  const site = getSiteById(input.siteId);
  if (!campaign || !site || campaign.status !== "draft") throw new Error("PARENT_CAMPAIGN_OR_SITE_INVALID");
  const apiBaseUrl = site.integrations.wordpressApiBaseUrl;
  const reference = site.integrations.wordpressCredentialReference;
  const credential = resolveWordPressCredentialReference(reference);
  if (!apiBaseUrl || !reference || !credential) throw new Error("WORDPRESS_AUTHORITY_UNAVAILABLE");
  const reader = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
  const inventory = await inspectGlwReferenceParentInventory(reader);
  const context: Omit<GlwReferenceParentCreationContext, "principalId" | "principalSessionId"> = {
    operationType: GLW_REFERENCE_PARENT_CREATION_OPERATION,
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    campaignId: campaign.campaignId,
    exactRuntime: process.env.GIT_COMMIT?.trim().toLowerCase() ?? "",
    title: TITLE,
    slug: SLUG,
    parentId: "0",
    wordpressStatus: "draft",
    inventoryFingerprint: inventory.fingerprint,
    canonicalProductPath: CANONICAL_PATH,
    authorityClassification: "MISSING_PARENT_REQUIRES_CREATION",
  };
  return { campaign, site, reader, inventory, context };
}
function authorize(request: NextRequest) {
  const principal = resolveGlwTrustedOperatorPrincipal(request);
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  return { principal, auth, scope };
}
export async function GET(request: NextRequest, routeContext: Context) {
  const { principal, auth, scope } = authorize(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) return NextResponse.json({ error: "Unauthorized", callerSuppliedRoleHeadersAuthorize: false }, { status: 401 });
  try {
    const { campaignId } = await routeContext.params;
    const resolved = await live({ campaignId, organizationId: scope.organizationId, siteId: scope.siteId });
    return NextResponse.json({ operation: GLW_REFERENCE_PARENT_CREATION_OPERATION, inventory: resolved.inventory, intendedParent: { title: TITLE, slug: SLUG, parentId: 0, status: "draft", canonicalPath: CANONICAL_PATH, contentCertificationRequired: true }, callerSuppliedRoleHeadersAuthorize: false, wordpressMutation: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PARENT_FORENSIC_FAILED", wordpressMutation: false }, { status: 409 });
  }
}
export async function POST(request: NextRequest, routeContext: Context) {
  const { principal, auth, scope } = authorize(request);
  if (!principal.ok || !auth.ok || !hasOrganizationScope(scope) || !scope.siteId) return NextResponse.json({ error: "Unauthorized", callerSuppliedRoleHeadersAuthorize: false }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: "RUN_PREFLIGHT" | "AUTHORIZE" | "CREATE"; preflightId?: string; grantId?: string } | null;
  if (!body?.action) return NextResponse.json({ error: "Exact parent authority action is required." }, { status: 400 });
  try {
    const { campaignId } = await routeContext.params;
    const resolved = await live({ campaignId, organizationId: scope.organizationId, siteId: scope.siteId });
    if (!resolved.inventory.complete || resolved.inventory.classification !== "MISSING_PARENT_REQUIRES_CREATION" || resolved.inventory.exactSlugMatches.length || resolved.inventory.equivalentMatches.length) throw new Error("PARENT_CREATION_PREFLIGHT_BLOCKED");
    if (body.action === "RUN_PREFLIGHT") {
      const preflight = issueGlwReferenceParentCreationPreflight({ principal: principal.principal, context: resolved.context });
      return NextResponse.json({ preflight, inventory: resolved.inventory, wordpressMutation: false });
    }
    if (!body.preflightId) return NextResponse.json({ error: "Parent preflight is required." }, { status: 400 });
    if (body.action === "AUTHORIZE") {
      const grant = issueGlwReferenceParentCreationGrant({ principal: principal.principal, preflightId: body.preflightId, liveContext: resolved.context });
      return NextResponse.json({ grant, wordpressMutation: false });
    }
    if (!body.grantId) return NextResponse.json({ error: "Parent grant is required." }, { status: 400 });
    const duplicateRecheck = await inspectGlwReferenceParentInventory(resolved.reader);
    if (!duplicateRecheck.complete || duplicateRecheck.classification !== "MISSING_PARENT_REQUIRES_CREATION" || duplicateRecheck.fingerprint !== resolved.context.inventoryFingerprint) throw new Error("PARENT_INVENTORY_CHANGED");
    const claim = consumeGlwReferenceParentCreationGrant({ principal: principal.principal, preflightId: body.preflightId, grantId: body.grantId, liveContext: resolved.context });
    const write = await writeGenesisWordPressDraft({ operation: "CREATE", site: resolved.site, artifact: { title: TITLE, slug: SLUG, parentId: null, excerpt: "Draft hierarchy authority for the Outdoor Digital Sphere product family. Content certification is required before publication.", contentHtml: "<p>This draft establishes the Outdoor Digital Sphere hierarchy for owner review. Product-page content has not been certified and publication is not authorized.</p>" } });
    if (!write.ok) return NextResponse.json({ error: write.message, code: `WORDPRESS_${write.state.toUpperCase()}`, grantConsumed: true, wordpressMutation: false }, { status: 409 });
    const readback = await resolved.reader.getJson({ path: `/pages/${write.wordpressObjectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,title,slug,status,parent,link,featured_media,content" }) });
    if (!readback.ok || !readback.body || typeof readback.body !== "object" || Array.isArray(readback.body)) throw new Error("PARENT_READBACK_FAILED");
    const page = readback.body as Record<string, unknown>;
    const title = page.title && typeof page.title === "object" && !Array.isArray(page.title) ? page.title as Record<string, unknown> : {};
    if (String(page.id) !== write.wordpressObjectId || String(page.slug) !== SLUG || String(page.status) !== "draft" || Number(page.parent) !== 0 || String(title.raw ?? title.rendered ?? "").replace(/<[^>]+>/g, "").trim() !== TITLE) throw new Error("PARENT_READBACK_IDENTITY_MISMATCH");
    const after = await inspectGlwReferenceParentInventory(resolved.reader);
    if (!after.complete || after.exactSlugMatches.length !== 1 || String(after.exactSlugMatches[0].objectId) !== write.wordpressObjectId) throw new Error("PARENT_EXACT_COUNT_INVALID");
    return NextResponse.json({ operation: GLW_REFERENCE_PARENT_CREATION_OPERATION, claimId: claim.claimId, duplicateRecheckImmediatelyBeforeMutation: true, createdObjectCount: 1, parent: { wordpressObjectId: write.wordpressObjectId, title: TITLE, slug: SLUG, status: "draft", parentId: 0, path: CANONICAL_PATH, url: write.wordpressUrl, featuredImageId: Number(page.featured_media ?? 0) || null, contentCertificationRequired: true }, exactSlugObjectCountAfter: after.exactSlugMatches.length, parentReadbackPassed: true, wordpressMutation: true, publicationMutation: false });
  } catch (error) {
    const code = error instanceof GlwReferenceParentCreationAuthorityError ? error.code : error instanceof Error ? error.message : "PARENT_CREATION_FAILED";
    return NextResponse.json({ error: "Reference parent authority failed closed.", code, wordpressMutation: false, publicationMutation: false }, { status: 409 });
  }
}
