import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getQuoteById, submitQuote } from "@/modules/foundation/quote-repository";

type RouteContext = { params: Promise<{ quoteId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "quotes:submit");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { quoteId } = await context.params;
  const quote = getQuoteById(quoteId);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (!isRecordInScope({
    recordOrganizationId: quote.organizationId,
    recordSiteId: quote.siteReference,
    scope,
  })) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const body = (await request.json()) as { notes?: string | null; expectedVersion?: number };
  const result = submitQuote({
    quoteId,
    actor: request.headers.get("x-gcp-actor") ?? "api",
    notes: body.notes ?? null,
    expectedVersion: body.expectedVersion,
  });

  if (!result.validation.valid || !result.quote) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  return NextResponse.json({ quote: result.quote });
}
