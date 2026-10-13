import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";
import { verifyGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { inspectSanAntonioWordPressDraft } from "@/modules/glw/san-antonio-wordpress-staging-service";
import { getSanAntonioNativeRepairState } from "@/modules/glw/san-antonio-native-wordpress-render-repair-service";
import { getSanAntonioHeroContrastState } from "@/modules/glw/san-antonio-hero-contrast-repair-service";
import { getSanAntonioBackgroundAwareContrastState } from "@/modules/glw/san-antonio-background-aware-contrast-update-service";
import { getSanAntonioDurableHeadingContrastState } from "@/modules/glw/san-antonio-durable-heading-contrast-update-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const signedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!verifyGovernedSnapshotPath(signedPath, request.headers.get("x-genesis-render-capture"))) return new NextResponse("Forbidden", { status: 403 });
  const { jobId } = await context.params;
  if (jobId !== "f518ffb7-9216-4866-a93c-7f4793e74038" || request.nextUrl.searchParams.get("organizationId") !== "ssi" || request.nextUrl.searchParams.get("siteId") !== "site-ssi-projectorenclosure") return new NextResponse("Not found", { status: 404 });
  const receipt = getSanAntonioNativeRepairState().receipts.at(-1); if (!receipt) return new NextResponse("Repair receipt required", { status: 409 });
  const heroReceipt = getSanAntonioHeroContrastState().receipts.at(-1); const systemicReceipt = getSanAntonioBackgroundAwareContrastState().receipts.at(-1); const durableHeadingReceipt = getSanAntonioDurableHeadingContrastState().receipts.at(-1); const expectedHash = durableHeadingReceipt?.afterHash ?? systemicReceipt?.afterHash ?? heroReceipt?.afterHash ?? receipt.afterHash; const current = await inspectSanAntonioWordPressDraft("13103"); if (current.identity.status !== "draft" || current.identity.template !== "elementor_header_footer" || current.featuredMediaId !== 10757 || current.hash !== expectedHash || current.authority !== "POST_CONTENT") return new NextResponse("Repair identity stale", { status: 409 });
  const shellResponse = await fetch("https://projectorenclosure.com/fan-cooled-projector-enclosures/", { cache: "no-store", signal: AbortSignal.timeout(30_000) }); if (!shellResponse.ok) return new NextResponse("Theme shell unavailable", { status: 502 });
  const $ = load(await shellResponse.text()); $("base").remove(); $("head").prepend('<base href="https://projectorenclosure.com/">'); const body = $("body"); body.attr("class", (body.attr("class") ?? "").replace(/page-id-\d+/g, "page-id-13103").concat(" page-id-13103 page-template-elementor_header_footer"));
  const header = $("header#cafe-site-header").first(); const footer = $("footer#cafe-site-footer").first(); if (!header.length || !footer.length) return new NextResponse("Theme shell malformed", { status: 502 });
  const breadcrumb = $(".breadcrumb,.breadcrumbs,.woocommerce-breadcrumb,.cafe-breadcrumb").first().clone(); let cursor = header.next(); while (cursor.length && !cursor.is(footer)) { const next = cursor.next(); cursor.remove(); cursor = next; }
  const breadcrumbHtml = breadcrumb.length ? $.html(breadcrumb) : '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="https://projectorenclosure.com/">Home</a> / <a href="https://projectorenclosure.com/fan-cooled-projector-enclosures/">Fan Cooled Projector Enclosures</a> / San Antonio</nav>';
  footer.before(`${breadcrumbHtml}<article id="post-13103" class="post-13103 page type-page status-draft"><header class="page-title the-title"><h1>Fan Cooled Projector Enclosures in San Antonio</h1></header><div class="post-media single-image"><img src="https://projectorenclosure.com/wp-content/uploads/2024/03/Integrator-scaled-1.webp" alt="Fan cooled projector enclosure"></div><div class="elementor elementor-13103" data-native-wordpress-equivalent="13103">${current.rendered}</div></article>`);
  $("title").text("San Antonio native WordPress repair — deterministic owner gate"); $("link[rel=canonical]").remove(); $("head").append('<meta name="robots" content="noindex,nofollow">'); $(".cafe-canvas-cart-content,.cafe-wrap-menu,.cafe-search-form,.cafe-hamburger-mask,.cafe-search-mask,.cafe-canvas-cart-mask").remove(); $("iframe").remove();
  return new NextResponse($.html(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "content-security-policy": "default-src 'none'; img-src https://projectorenclosure.com data:; style-src 'unsafe-inline' https://projectorenclosure.com https://fonts.googleapis.com; font-src https://projectorenclosure.com https://fonts.gstatic.com data:; connect-src https://projectorenclosure.com; script-src 'unsafe-inline' https://projectorenclosure.com; frame-src 'none'" } });
}