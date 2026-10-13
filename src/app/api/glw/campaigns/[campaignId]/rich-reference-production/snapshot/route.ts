import { createHash } from "node:crypto";
import { load } from "cheerio";
import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { verifyGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { nativeTitlePolicyMatches, resolveSharedRichPageProductionProfile, richPageHostIntegrationCss } from "@/modules/foundation/shared-rich-page-production-authority";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { resolveTargetParameterizedRichReferenceProduction } from "@/modules/glw/target-parameterized-rich-reference-production";

export const dynamic = "force-dynamic";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sha256(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

export async function GET(request: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  const signedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!verifyGovernedSnapshotPath(signedPath, request.headers.get("x-genesis-render-capture"))) return new NextResponse("Forbidden", { status: 403 });
  try {
    const { campaignId } = await context.params;
    const targetId = request.nextUrl.searchParams.get("targetId")?.trim() ?? "";
    const wordpressObjectId = request.nextUrl.searchParams.get("wordpressObjectId")?.trim() ?? "";
    const expectedContentSha = request.nextUrl.searchParams.get("contentSha")?.trim() ?? "";
    if (!targetId || !/^[1-9]\d*$/.test(wordpressObjectId) || !/^[0-9a-f]{64}$/.test(expectedContentSha)) return new NextResponse("Snapshot identity invalid", { status: 400 });

    const readiness = await resolveTargetParameterizedRichReferenceProduction({ campaignId, targetId });
    const site = getSiteById(readiness.identity.siteId);
    const profile = resolveSharedRichPageProductionProfile({ organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, productId: readiness.identity.productId, pageType: "LOCATION_SERVICE" });
    const credential = site ? resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference) : null;
    if (!site?.integrations.wordpressApiBaseUrl || !site.domain || !profile || !credential) return new NextResponse("Snapshot authority unavailable", { status: 409 });
    const reader = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
    const readback = await reader.getJson({ path: `/pages/${wordpressObjectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,title,content,featured_media,meta" }) });
    if (!readback.ok || !readback.body || typeof readback.body !== "object" || Array.isArray(readback.body)) return new NextResponse("Draft unavailable", { status: 409 });
    const page = readback.body as Record<string, unknown>;
    const content = page.content && typeof page.content === "object" && !Array.isArray(page.content) ? page.content as Record<string, unknown> : {};
    const title = page.title && typeof page.title === "object" && !Array.isArray(page.title) ? page.title as Record<string, unknown> : {};
    const meta = page.meta && typeof page.meta === "object" && !Array.isArray(page.meta) ? page.meta as Record<string, unknown> : {};
    const settings = meta._elementor_page_settings && typeof meta._elementor_page_settings === "object" && !Array.isArray(meta._elementor_page_settings) ? meta._elementor_page_settings as Record<string, unknown> : {};
    const raw = text(content.raw);
    const rendered = text(content.rendered) || raw;
    if (String(page.id ?? "") !== wordpressObjectId || text(page.status) !== "draft" || text(page.slug) !== readiness.identity.canonicalSlug || String(page.parent ?? "") !== readiness.identity.wordpressParentId || sha256(raw) !== expectedContentSha || !nativeTitlePolicyMatches(profile.host, settings.hide_title)) return new NextResponse("Draft identity stale", { status: 409 });

    const origin = new URL(`https://${site.domain.replace(/^www\./, "")}`).origin;
    const shellResponse = await fetch(`${origin}/`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!shellResponse.ok) return new NextResponse("Theme shell unavailable", { status: 502 });
    const $ = load(await shellResponse.text());
    $("base").remove();
    $("head").prepend(`<base href="${origin}/">`);
    const header = $("header").first();
    const footer = $("footer").last();
    if (!header.length || !footer.length) return new NextResponse("Theme shell malformed", { status: 502 });
    let cursor = header.next();
    while (cursor.length && !cursor.is(footer)) { const next = cursor.next(); cursor.remove(); cursor = next; }
    footer.before(`<article id="post-${wordpressObjectId}" class="post-${wordpressObjectId} page type-page status-draft"><div data-native-wordpress-equivalent="${wordpressObjectId}">${rendered}</div></article>`);
    $("body").addClass("genesis-rich-page-host");
    $("title").text(`${text(title.raw) || text(title.rendered)} - WordPress draft review`);
    $("link[rel=canonical]").remove();
    $("head").append(`<meta name="robots" content="noindex,nofollow"><style>${richPageHostIntegrationCss(profile)}</style>`);
    $("iframe").remove();
    return new NextResponse($.html(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex,nofollow", "content-security-policy": `default-src 'none'; img-src ${origin} data:; style-src 'unsafe-inline' ${origin} https://fonts.googleapis.com; font-src ${origin} https://fonts.gstatic.com data:; connect-src ${origin}; script-src 'unsafe-inline' ${origin}; frame-src 'none'` } });
  } catch {
    return new NextResponse("Snapshot authority unavailable", { status: 409 });
  }
}
