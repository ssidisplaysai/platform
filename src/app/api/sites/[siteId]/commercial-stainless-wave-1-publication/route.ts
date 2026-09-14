import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import {
  certifyCommercialStainlessWordPressPublishedPage,
  COMMERCIAL_STAINLESS_PAGE24_CANARY_REPAIR_SHA,
  COMMERCIAL_STAINLESS_PAGE24_CANARY_V2_RENDER_REPAIR_SHA,
  COMMERCIAL_STAINLESS_PAGE24_CANARY_V3_HOST_SPACING_SHA,
  COMMERCIAL_STAINLESS_WAVE1_REMAINING_AUTHORITY_SHA,
  COMMERCIAL_STAINLESS_PAGE17_RETRY_AUTHORITY_SHA,
  COMMERCIAL_STAINLESS_PAGE23_FINAL_AUTHORITY_SHA,
  COMMERCIAL_STAINLESS_PUBLICATION_IMPLEMENTATION_SHA,
  listCommercialStainlessWordPressPublicationReceipts,
  publishCommercialStainlessPage24Canary,
  publishCommercialStainlessPage24CanaryV2,
  publishCommercialStainlessPage24CanaryV3,
  publishCommercialStainlessPage17RetryV1,
  publishCommercialStainlessPage23FinalV1,
  publishCommercialStainlessRemainingWave1Page,
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
  const canaryV1 = body?.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY" || body?.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_PUBLIC_RENDER";
  const canaryV2 = body?.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_V2" || body?.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_V2_PUBLIC_RENDER";
  const canaryV3 = body?.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_V3" || body?.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_V3_PUBLIC_RENDER";
  const remaining = body?.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_WAVE1_REMAINING_PAGE" || body?.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_WAVE1_REMAINING_PUBLIC_RENDER";
  const page17Retry = body?.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE17_RETRY_V1" || body?.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_PAGE17_RETRY_V1_PUBLIC_RENDER";
  const page23Final = body?.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE23_FINAL_V1" || body?.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_PAGE23_FINAL_V1_PUBLIC_RENDER";
  const expectedSha = page23Final ? COMMERCIAL_STAINLESS_PAGE23_FINAL_AUTHORITY_SHA : page17Retry ? COMMERCIAL_STAINLESS_PAGE17_RETRY_AUTHORITY_SHA : remaining ? COMMERCIAL_STAINLESS_WAVE1_REMAINING_AUTHORITY_SHA : canaryV3 ? COMMERCIAL_STAINLESS_PAGE24_CANARY_V3_HOST_SPACING_SHA : canaryV2 ? COMMERCIAL_STAINLESS_PAGE24_CANARY_V2_RENDER_REPAIR_SHA : canaryV1 ? COMMERCIAL_STAINLESS_PAGE24_CANARY_REPAIR_SHA : COMMERCIAL_STAINLESS_PUBLICATION_IMPLEMENTATION_SHA;
  if (!body || body.implementationSha !== expectedSha) return NextResponse.json({ error: "Exact authorized implementation SHA is required." }, { status: 400 });
  try {
    if (body.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE23_FINAL_V1") {
      if (Number(body.wordpressObjectId) !== 23) return NextResponse.json({ error: "Page 23 is the only authorized final publication target." }, { status: 403 });
      const receipt = await publishCommercialStainlessPage23FinalV1(site);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: true, publicationMutation: true });
    }
    if (body.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_PAGE23_FINAL_V1_PUBLIC_RENDER" && body.visual) {
      if (Number(body.wordpressObjectId) !== 23 || body.receiptId !== "csc-page23-final-publication-v1-23-be5502d4") return NextResponse.json({ error: "Exact Page 23 final receipt is required." }, { status: 403 });
      const receipt = await certifyCommercialStainlessWordPressPublishedPage(site, 23, body.visual, body.receiptId);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: false, publicationMutation: false });
    }
    if (body.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE17_RETRY_V1") {
      if (Number(body.wordpressObjectId) !== 17) return NextResponse.json({ error: "Page 17 is the only authorized retry target." }, { status: 403 });
      const receipt = await publishCommercialStainlessPage17RetryV1(site);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: true, publicationMutation: true });
    }
    if (body.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_PAGE17_RETRY_V1_PUBLIC_RENDER" && body.visual) {
      if (Number(body.wordpressObjectId) !== 17 || body.receiptId !== "csc-page17-publication-retry-v1-17-91") return NextResponse.json({ error: "Exact Page 17 retry receipt is required." }, { status: 403 });
      const receipt = await certifyCommercialStainlessWordPressPublishedPage(site, 17, body.visual, body.receiptId);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: false, publicationMutation: false });
    }
    if (body.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_WAVE1_REMAINING_PAGE") {
      if (![11, 13, 17, 23].includes(Number(body.wordpressObjectId))) return NextResponse.json({ error: "Only objects 11, 13, 17, and 23 are authorized." }, { status: 403 });
      const receipt = await publishCommercialStainlessRemainingWave1Page(site, Number(body.wordpressObjectId));
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: true, publicationMutation: true });
    }
    if (body.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_WAVE1_REMAINING_PUBLIC_RENDER" && body.visual) {
      const wordpressObjectId = Number(body.wordpressObjectId);
      const expectedReceiptId = `csc-wave1-remaining-v1-${wordpressObjectId}-${wordpressObjectId === 11 ? 89 : wordpressObjectId === 13 ? 90 : wordpressObjectId === 17 ? 91 : wordpressObjectId === 23 ? 92 : 0}`;
      if (![11, 13, 17, 23].includes(wordpressObjectId) || body.receiptId !== expectedReceiptId) return NextResponse.json({ error: "Exact remaining Wave 1 receipt is required." }, { status: 403 });
      const receipt = await certifyCommercialStainlessWordPressPublishedPage(site, wordpressObjectId, body.visual, body.receiptId);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: false, publicationMutation: false });
    }
    if (body.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_V3") {
      if (Number(body.wordpressObjectId) !== 24) return NextResponse.json({ error: "Page 24 is the only authorized V3 canary target." }, { status: 403 });
      const receipt = await publishCommercialStainlessPage24CanaryV3(site);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: true, publicationMutation: true });
    }
    if (body.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_V3_PUBLIC_RENDER" && body.visual) {
      if (Number(body.wordpressObjectId) !== 24 || body.receiptId !== "csc-page24-canary-publication-retry-v3-24-88") return NextResponse.json({ error: "Exact Page 24 V3 canary receipt is required." }, { status: 403 });
      const receipt = await certifyCommercialStainlessWordPressPublishedPage(site, 24, body.visual, body.receiptId);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: false, publicationMutation: false });
    }
    if (body.confirm === "PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_V2") {
      if (Number(body.wordpressObjectId) !== 24) return NextResponse.json({ error: "Page 24 is the only authorized V2 canary target." }, { status: 403 });
      const receipt = await publishCommercialStainlessPage24CanaryV2(site);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: true, publicationMutation: true });
    }
    if (body.confirm === "CERTIFY_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_V2_PUBLIC_RENDER" && body.visual) {
      if (Number(body.wordpressObjectId) !== 24 || body.receiptId !== "csc-page24-canary-publication-retry-v2-24-88") return NextResponse.json({ error: "Exact Page 24 V2 canary receipt is required." }, { status: 403 });
      const receipt = await certifyCommercialStainlessWordPressPublishedPage(site, 24, body.visual, body.receiptId);
      return NextResponse.json({ receipt: summarizeCommercialStainlessWordPressPublicationReceipt(receipt), mutationPerformed: false, publicationMutation: false });
    }
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