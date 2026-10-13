import { NextRequest, NextResponse } from "next/server";
import { verifyGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { buildGeneratedPageReviewModel } from "@/modules/glw/generated-page-review-read-model";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const signedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!verifyGovernedSnapshotPath(signedPath, request.headers.get("x-genesis-render-capture"))) return new NextResponse("Forbidden", { status: 403 });
  const { jobId } = await context.params;
  const organizationId = request.nextUrl.searchParams.get("organizationId"); const siteId = request.nextUrl.searchParams.get("siteId");
  if (!organizationId || !siteId) return new NextResponse("Exact scope required", { status: 400 });
  const model = await buildGeneratedPageReviewModel({ jobId, organizationId, siteId });
  if (!model || !model.wordpress.verified || !model.wordpress.previewHtml) return new NextResponse("Exact authenticated draft unavailable", { status: 409 });
  const base = model.wordpress.sourceUrl ? new URL(model.wordpress.sourceUrl).origin : `https://${model.identity.domain}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#fff;color:#171717;font-family:Arial,sans-serif}*{box-sizing:border-box}main{width:min(928px,calc(100% - 40px));margin:0 auto;padding:48px 0 80px}img{max-width:100%;height:auto}h1{font-size:clamp(32px,5vw,58px);line-height:1.05}h2{margin-top:48px;font-size:28px;line-height:1.15}p,li{font-size:17px;line-height:1.65}table{display:block;max-width:100%;overflow:auto}@media(max-width:560px){main{width:calc(100% - 28px);padding-top:28px}h1{font-size:36px}h2{font-size:25px}}</style></head><body><main data-genesis-primary-content><article>${model.wordpress.previewHtml}</article></main></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": `default-src 'none'; img-src ${base}; style-src 'unsafe-inline'; font-src 'none'; connect-src 'none'; frame-src 'none'`, "x-robots-tag": "noindex, nofollow" } });
}