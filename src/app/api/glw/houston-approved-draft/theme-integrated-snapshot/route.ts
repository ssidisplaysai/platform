import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";

import { verifyGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { HOUSTON_THEME_TEMPLATE, HOUSTON_TITLE } from "@/modules/glw/houston-approved-preview-draft";
import { getHoustonDraftState } from "@/modules/glw/houston-approved-preview-draft-repository";
import { inspectHoustonWordPressAuthority } from "@/modules/glw/houston-approved-preview-draft-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const signedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!verifyGovernedSnapshotPath(signedPath, request.headers.get("x-genesis-render-capture"))) return new NextResponse("Forbidden", { status: 403 });
  if (request.nextUrl.searchParams.get("organizationId") !== "ssi" || request.nextUrl.searchParams.get("siteId") !== "site-ssi-projectorenclosure") return new NextResponse("Not found", { status: 404 });
  const receipt = getHoustonDraftState().receipts.at(-1); if (!receipt) return new NextResponse("Houston draft receipt missing", { status: 409 });
  const current = await inspectHoustonWordPressAuthority(receipt.wordpressObjectId);
  const settings = current.meta._elementor_page_settings as { hide_title?: string } | undefined;
  if (current.body.hash !== receipt.bodyHash || current.identity.template !== HOUSTON_THEME_TEMPLATE || settings?.hide_title !== "yes") return new NextResponse("Houston draft identity stale", { status: 409 });
  const shellResponse = await fetch("https://projectorenclosure.com/fan-cooled-projector-enclosures/", { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!shellResponse.ok) return new NextResponse("Theme shell unavailable", { status: 502 });
  const $ = load(await shellResponse.text()); $("base").remove(); $("head").prepend('<base href="https://projectorenclosure.com/">');
  const body = $("body"); body.attr("class", (body.attr("class") ?? "").replace(/page-id-\d+/g, `page-id-${receipt.wordpressObjectId}`).concat(` page-id-${receipt.wordpressObjectId} page-template-elementor_header_footer`));
  const header = $("header#cafe-site-header").first(); const footer = $("footer#cafe-site-footer").first(); if (!header.length || !footer.length) return new NextResponse("Theme shell malformed", { status: 502 });
  let cursor = header.next(); while (cursor.length && !cursor.is(footer)) { const next = cursor.next(); cursor.remove(); cursor = next; }
  footer.before(`<div class="elementor elementor-${receipt.wordpressObjectId}" data-theme-integrated-draft="${receipt.wordpressObjectId}">${current.body.rendered}</div>`);
  $("title").text(`${HOUSTON_TITLE} - Theme-integrated draft`); $("link[rel=canonical]").remove(); $("head").append('<meta name="robots" content="noindex,nofollow">');
  $(".cafe-canvas-cart-content,.cafe-wrap-menu,.cafe-search-form,.cafe-hamburger-mask,.cafe-search-mask,.cafe-canvas-cart-mask").remove(); $("iframe").remove();
  $("body").append(`<style id="genesis-theme-integration-marker">.ssi-header *{box-sizing:border-box!important}body.page-id-${receipt.wordpressObjectId} .page-title.the-title,body.page-id-${receipt.wordpressObjectId} .post-media.single-image{display:none!important}</style>`);
  return new NextResponse($.html(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "content-security-policy": "default-src 'none'; img-src https://projectorenclosure.com data:; style-src 'unsafe-inline' https://projectorenclosure.com https://fonts.googleapis.com; font-src https://projectorenclosure.com https://fonts.gstatic.com data:; connect-src https://projectorenclosure.com; script-src 'unsafe-inline' https://projectorenclosure.com; frame-src 'none'" } });
}
