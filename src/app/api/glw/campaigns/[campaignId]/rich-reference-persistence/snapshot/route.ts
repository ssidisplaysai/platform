import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";
import { verifyGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { inspectIndianaWordPressDraft } from "@/modules/glw/indiana-rich-reference-persistence";

export const dynamic = "force-dynamic";
const CAMPAIGN_ID = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview";
const THEME_SHELL_CACHE_MS = 60_000;
let themeShellCache: { html: string; fetchedAt: number } | null = null;

async function loadThemeShell(): Promise<string> {
  if (themeShellCache && Date.now() - themeShellCache.fetchedAt < THEME_SHELL_CACHE_MS) return themeShellCache.html;
  const response = await fetch("https://leddisplaywarehouse.com/", { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("THEME_SHELL_UNAVAILABLE");
  const html = await response.text();
  themeShellCache = { html, fetchedAt: Date.now() };
  return html;
}

export async function GET(request: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  const signedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!verifyGovernedSnapshotPath(signedPath, request.headers.get("x-genesis-render-capture"))) return new NextResponse("Forbidden", { status: 403 });
  const { campaignId } = await context.params;
  if (campaignId !== CAMPAIGN_ID || request.nextUrl.searchParams.get("organizationId") !== "led-display-warehouse" || request.nextUrl.searchParams.get("siteId") !== "site-led-display-warehouse-production") return new NextResponse("Not found", { status: 404 });
  const draft = await inspectIndianaWordPressDraft();
  if (draft.objectId !== "20115" || draft.status !== "draft" || draft.slug !== "indiana" || draft.parent !== 20114 || draft.contentSha !== request.nextUrl.searchParams.get("contentSha")) return new NextResponse("Draft identity stale", { status: 409 });
  let shellHtml: string;
  try { shellHtml = await loadThemeShell(); } catch { return new NextResponse("Theme shell unavailable", { status: 502 }); }
  const $ = load(shellHtml); $("base").remove(); $("head").prepend('<base href="https://leddisplaywarehouse.com/">');
  const header = $("header").first(); const footer = $("footer").last(); if (!header.length || !footer.length) return new NextResponse("Theme shell malformed", { status: 502 });
  let cursor = header.next(); while (cursor.length && !cursor.is(footer)) { const next = cursor.next(); cursor.remove(); cursor = next; }
  footer.before(`<article id="post-20115" class="post-20115 page type-page status-draft"><div data-native-wordpress-equivalent="20115">${draft.rendered}</div></article>`);
  $("title").text("Outdoor Digital Sphere in Indiana — WordPress draft review"); $("link[rel=canonical]").remove(); $("head").append('<meta name="robots" content="noindex,nofollow">'); $("script,iframe").remove();
  return new NextResponse($.html(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex,nofollow", "content-security-policy": "default-src 'none'; img-src https://leddisplaywarehouse.com data:; style-src 'unsafe-inline' https://leddisplaywarehouse.com https://fonts.googleapis.com; font-src https://leddisplaywarehouse.com https://fonts.gstatic.com data:; connect-src https://leddisplaywarehouse.com; script-src 'unsafe-inline' https://leddisplaywarehouse.com; frame-src 'none'" } });
}
