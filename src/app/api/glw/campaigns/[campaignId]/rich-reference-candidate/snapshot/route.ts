import { NextRequest, NextResponse } from "next/server";
import { verifyGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { candidateMediaDataUrls, getIndianaRichReferenceCandidate, renderIndianaRichReferenceCandidate } from "@/modules/glw/indiana-rich-reference-candidate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  const signedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!verifyGovernedSnapshotPath(signedPath, request.headers.get("x-genesis-render-capture"))) return new NextResponse("Forbidden", { status: 403 });
  const { campaignId } = await context.params;
  if (campaignId !== "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview"
    || request.nextUrl.searchParams.get("organizationId") !== "led-display-warehouse"
    || request.nextUrl.searchParams.get("siteId") !== "site-led-display-warehouse-production") return new NextResponse("Not found", { status: 404 });
  const candidate = getIndianaRichReferenceCandidate(request.nextUrl.searchParams.get("candidateId"));
  if (!candidate) return new NextResponse("Candidate not found", { status: 404 });
  const html = renderIndianaRichReferenceCandidate(candidate, candidateMediaDataUrls(candidate));
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "content-security-policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-src 'none'; form-action 'none'; base-uri 'none'" } });
}
