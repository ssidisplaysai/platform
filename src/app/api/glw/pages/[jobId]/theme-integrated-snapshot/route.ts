import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";
import { verifyGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { inspectDallasWordPressAuthority } from "@/modules/glw/dallas-wordpress-authority-inspector";
import {
  DALLAS_APPROVED_BODY_HASH,
  DALLAS_THEME_TEMPLATE,
} from "@/modules/glw/dallas-public-theme-integration";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const signedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (
    !verifyGovernedSnapshotPath(
      signedPath,
      request.headers.get("x-genesis-render-capture"),
    )
  )
    return new NextResponse("Forbidden", { status: 403 });
  const { jobId } = await context.params;
  if (
    jobId !== "2ca74016-252b-4587-bf3c-ec9b7eb839c9" ||
    request.nextUrl.searchParams.get("organizationId") !== "ssi" ||
    request.nextUrl.searchParams.get("siteId") !== "site-ssi-projectorenclosure"
  )
    return new NextResponse("Not found", { status: 404 });
  const current = await inspectDallasWordPressAuthority("draft");
  if (
    current.identity.template !== DALLAS_THEME_TEMPLATE ||
    current.body.contentHash !== DALLAS_APPROVED_BODY_HASH
  )
    return new NextResponse("Theme repair identity stale", { status: 409 });
  const shellResponse = await fetch(
    "https://projectorenclosure.com/fan-cooled-projector-enclosures/",
    { cache: "no-store", signal: AbortSignal.timeout(30_000) },
  );
  if (!shellResponse.ok)
    return new NextResponse("Theme shell unavailable", { status: 502 });
  const $ = load(await shellResponse.text());
  $("base").remove();
  $("head").prepend('<base href="https://projectorenclosure.com/">');
  const body = $("body");
  body.attr(
    "class",
    (body.attr("class") ?? "")
      .replace(/page-id-\d+/g, "page-id-13084")
      .concat(" page-id-13084 page-template-elementor_header_footer"),
  );
  const header = $("header#cafe-site-header").first();
  const footer = $("footer#cafe-site-footer").first();
  if (!header.length || !footer.length)
    return new NextResponse("Theme shell malformed", { status: 502 });
  let cursor = header.next();
  while (cursor.length && !cursor.is(footer)) {
    const next = cursor.next();
    cursor.remove();
    cursor = next;
  }
  footer.before(
    `<div class="elementor elementor-13084" data-theme-integrated-draft="13084">${current.body.rendered}</div>`,
  );
  $("title").text(
    "Fan Cooled Projector Enclosures in Dallas — Theme-integrated draft",
  );
  $("link[rel=canonical]").remove();
  $("head").append(
    '<meta name="robots" content="noindex,nofollow">',
  );
  $(
    ".cafe-canvas-cart-content,.cafe-wrap-menu,.cafe-search-form,.cafe-hamburger-mask,.cafe-search-mask,.cafe-canvas-cart-mask",
  ).remove();
  $("iframe").remove();
  $("body").append(
    '<style id="genesis-theme-integration-marker">.ssi-header *{box-sizing:border-box!important}body.page-id-13084 .page-title.the-title,body.page-id-13084 .post-media.single-image{display:none!important}</style>',
  );
  return new NextResponse($.html(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
      "content-security-policy":
        "default-src 'none'; img-src https://projectorenclosure.com data:; style-src 'unsafe-inline' https://projectorenclosure.com https://fonts.googleapis.com; font-src https://projectorenclosure.com https://fonts.gstatic.com data:; connect-src https://projectorenclosure.com; script-src 'unsafe-inline' https://projectorenclosure.com; frame-src 'none'",
    },
  });
}
