import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getQuoteById, markQuoteViewed, updateQuoteDraft } from "@/modules/foundation/quote-repository";
import type { UpdateQuoteDraftInput } from "@/modules/foundation/quote-types";

type RouteContext = {
  params: Promise<{ quoteId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

function expectedVersionFromRequest(request: NextRequest, body: { expectedVersion?: unknown }): number | undefined {
  const headerValue = request.headers.get("x-gcp-expected-version");
  if (headerValue) {
    const parsed = Number(headerValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (typeof body.expectedVersion === "number" && Number.isFinite(body.expectedVersion)) {
    return body.expectedVersion;
  }

  return undefined;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "quotes:read");
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

  markQuoteViewed({
    quoteId,
    actor: actorFromRequest(request),
    correlationId: request.headers.get("x-gcp-correlation-id"),
  });

  return NextResponse.json({ quote });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "quotes:update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { quoteId } = await context.params;
  const existing = getQuoteById(quoteId);
  if (!existing) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (!isRecordInScope({
    recordOrganizationId: existing.organizationId,
    recordSiteId: existing.siteReference,
    scope,
  })) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const body = (await request.json()) as UpdateQuoteDraftInput & {
    expectedVersion?: number;
  };

  const expectedVersion = expectedVersionFromRequest(request, body);

  const result = updateQuoteDraft({
    quoteId,
    patch: body,
    actor: actorFromRequest(request),
    expectedVersion,
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({ quote: result.quote });
}
