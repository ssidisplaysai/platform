import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getQuoteById, removeQuoteLine, updateQuoteLine } from "@/modules/foundation/quote-repository";
import type { UpdateQuoteLineInput } from "@/modules/foundation/quote-types";

type RouteContext = {
  params: Promise<{ quoteId: string; lineId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "quotes:update_lines");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { quoteId, lineId } = await context.params;
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

  const body = (await request.json()) as UpdateQuoteLineInput & { expectedVersion?: number };

  const result = updateQuoteLine({
    quoteId,
    lineId,
    patch: body,
    actor: actorFromRequest(request),
    expectedVersion: body.expectedVersion,
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.quote || !result.line) {
    return NextResponse.json({ error: "Unable to update line" }, { status: 400 });
  }

  return NextResponse.json({ quote: result.quote, line: result.line });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "quotes:update_lines");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { quoteId, lineId } = await context.params;
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

  const expectedVersionHeader = request.headers.get("x-gcp-expected-version");
  const expectedVersion = expectedVersionHeader ? Number(expectedVersionHeader) : undefined;

  const result = removeQuoteLine({
    quoteId,
    lineId,
    actor: actorFromRequest(request),
    expectedVersion: Number.isFinite(expectedVersion) ? expectedVersion : undefined,
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.quote) {
    return NextResponse.json({ error: "Unable to remove line" }, { status: 400 });
  }

  return NextResponse.json({ quote: result.quote });
}
