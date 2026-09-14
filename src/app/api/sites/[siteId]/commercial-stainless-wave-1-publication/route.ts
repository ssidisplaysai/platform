import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import {
  certifyCommercialStainlessWordPressPublishedPage,
  COMMERCIAL_STAINLESS_PAGE24_CANARY_REPAIR_SHA,
  COMMERCIAL_STAINLESS_PUBLICATION_IMPLEMENTATION_SHA,
  listCommercialStainlessWordPressPublicationReceipts,
  publishCommercialStainlessPage24Canary,
  publishCommercialStainlessWordPressWave1Page,
  summarizeCommercialStainlessWordPressPublicationReceipt,
  type CommercialStainlessPublicVisualCertification,
} from "@/modules/foundation/commercial-stainless-wordpress-publication";
import { getSiteById } from "@/modules/foundation/site-repository";

type Context = { params: Promise<{ siteId: string }> };

async function scoped(request: NextRequest, context: Context) {
  const scope = resolveRequestScope(request);
  const { siteId } = await context.params;
  const site = getSiteById(siteId);
  return hasOrganizationScope(scope) && site && isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope }) ? site : null;
}

const summaries = () => listCommercialStainlessWordPressPublicationReceipts().map(summarizeCommercialStainlessWordPressPublicationReceipt);

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  return NextResponse.json({ ownerPublicationAuthorization: true, implementationSha: COMMERCIAL_STAINLESS_PUBLICATION_IMPLEMENTATION_SHA, receipts: summaries(), mutationPerformed: false });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:manage_integrations");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { confirm?: string; implementationSha?: string; wordpressObjectId?: number; receiptId?: string; visual?: CommercialStainlessPublicVisualCertification } | null;
  const canary = body?.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY" || body?.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_PUBLIC_RENDER";
  const expectedSha = canary ? COMMERCIAL_STAINLESS_PAGE24_CANARY_REPAIR_SHA : COMMERCIAL_STAINLESS_PUBLICATION_IMPLEMENTATION_SHA;
  if (!body || body.implementationSha !== expectedSha) return NextResponse.json({ error: "Exact authorized implementation SHA is required." }, { status: 400 });
  try {
    if (body.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY") {
      if (Number(body.wordpressObjectId) !== 24) return NextResponse.json({ error: "Page 24 is the only authorized canary target." }, { status: 403 });
      const receipt = await publishCommercialStainlessPage24Canary(site);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: true, publicationMutation: true });
    }
    if (body.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_PUBLIC_RENDER" && body.visual) {
      if (Number(body.wordpressObjectId) !== 24 || body.receiptId !== "csc-page24-canary-publication-retry-v1-24-88") return NextResponse.json({ error: "Exact Page 24 canary receipt is required." }, { status: 403 });
      const receipt = await certifyCommercialStainlessWordPressPublishedPage(site, 24, body.visual, body.receiptId);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: false, publicationMutation: false });
    }
    if (body.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_WAVE_1_REVISION") {
      const receipt = await publishCommercialStainlessWordPressWave1Page(site, Number(body.wordpressObjectId));
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: true, publicationMutation: true });
    }
    if (body.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_WAVE_1_PUBLIC_RENDER" && body.visual) {
      const receipt = await certifyCommercialStainlessWordPressPublishedPage(site, Number(body.wordpressObjectId), body.visual);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: false, publicationMutation: false });
    }
    return NextResponse.json({ error: "Explicit exact-revision publication or public-render certification confirmation is required." }, { status: 400 });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "COMMERCIAL_STAINLESS_WAVE_1_PUBLICATION_FAILED", receipts: summaries() }, { status: 409 });
  }
}